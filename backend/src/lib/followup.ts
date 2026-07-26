/**
 * Follow-up Engine
 *
 * After a Red or Amber triage case is saved, a follow_up record is inserted
 * with due_at = NOW() + 24 hours.
 *
 * This module exports:
 *   scheduleFollowUp(triageCaseId, patientId) — call from the triage save route
 *   startFollowUpScheduler()                   — call once on server startup
 *
 * The scheduler runs every hour, finds due follow-ups, and sends a Telegram
 * notification to the clinic channel asking the clinician to check in on the patient.
 * No paid services required — reuses the existing TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.
 */

import { query } from '../db/connection'
import { sendTelegramMessage } from './telegram'

const FOLLOW_UP_HOURS = 24

// ─── Schedule a follow-up after saving a Red/Amber case ──────────────────────

export async function scheduleFollowUp(triageCaseId: string, patientId: string): Promise<void> {
  try {
    const dueAt = new Date(Date.now() + FOLLOW_UP_HOURS * 60 * 60 * 1000)
    await query(
      `INSERT INTO follow_ups (triage_case_id, patient_id, due_at)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [triageCaseId, patientId, dueAt.toISOString()]
    )
  } catch (err) {
    // Non-fatal — log but don't break the triage save
    console.error('scheduleFollowUp error:', err)
  }
}

// ─── Hourly checker ───────────────────────────────────────────────────────────

async function processFollowUps(): Promise<void> {
  try {
    // Fetch all due, unsent follow-ups with patient + case details
    const result = await query(
      `SELECT
         f.id              AS follow_up_id,
         f.triage_case_id,
         p.name            AS patient_name,
         t.severity,
         t.condition_guess,
         t.summary,
         t.for_name
       FROM follow_ups f
       JOIN patients p      ON f.patient_id      = p.id
       JOIN triage_cases t  ON f.triage_case_id  = t.id
       WHERE f.sent = FALSE AND f.due_at <= NOW()
       LIMIT 20`
    )

    for (const row of result.rows) {
      try {
        const displayName = row.for_name || row.patient_name || 'Unknown Patient'
        const message = [
          `⏰ <b>24-Hour Follow-Up Due</b>`,
          ``,
          `Patient: <b>${displayName}</b>`,
          `Last Assessment: <b>${row.severity}</b> — ${row.condition_guess}`,
          `Summary: ${row.summary}`,
          ``,
          `Please check in with the patient to see if their condition has improved, worsened, or if they need escalation.`,
          ``,
          `#CareRoute #FollowUp`,
        ].join('\n')

        await sendTelegramMessage(message)

        // Mark as sent — in its own try so a DB failure doesn't re-send
        await query(
          'UPDATE follow_ups SET sent = TRUE, sent_at = NOW() WHERE id = $1',
          [row.follow_up_id]
        )
      } catch (rowErr) {
        // Log and continue — don't let one patient's failure block the rest
        console.error(`[follow-up] Failed for follow_up ${row.follow_up_id}:`, rowErr)
      }
    }

    if (result.rows.length > 0) {
      console.log(`[follow-up] Sent ${result.rows.length} follow-up notification(s)`)
    }
  } catch (err) {
    console.error('[follow-up] Scheduler error:', err)
  }
}

// ─── Start — call once at server boot ────────────────────────────────────────

export function startFollowUpScheduler(): void {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.log('[follow-up] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — follow-up scheduler disabled')
    return
  }

  // Run immediately on boot (catches any missed follow-ups from downtime)
  processFollowUps()

  // Then every hour
  setInterval(processFollowUps, 60 * 60 * 1000)
  console.log('[follow-up] Scheduler started — checks every hour')
}
