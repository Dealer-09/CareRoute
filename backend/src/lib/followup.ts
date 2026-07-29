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
       ON CONFLICT (triage_case_id) DO NOTHING`,
      [triageCaseId, patientId, dueAt.toISOString()]
    )
  } catch (err) {
    // Non-fatal — log but don't break the triage save
    console.error('scheduleFollowUp error:', err)
  }
}

// ─── Hourly checker ───────────────────────────────────────────────────────────

// TD-10: Slot Regeneration Cron
async function generateFutureSlots(): Promise<void> {
  try {
    const doctors = await query('SELECT id FROM doctors WHERE available = TRUE')
    const now = new Date()
    // Generate slots for precisely 7 days from today
    const d = 7
    let newSlots = 0
    for (const doctor of doctors.rows) {
      for (let h = 9; h < 17; h++) {
        for (const m of [0, 30]) {
          const slot = new Date(now)
          slot.setDate(now.getDate() + d)
          slot.setHours(h, m, 0, 0)
          try {
            await query(
              `INSERT INTO doctor_slots (doctor_id, starts_at)
               VALUES ($1, $2)
               ON CONFLICT (doctor_id, starts_at) DO NOTHING`,
              [doctor.id, slot.toISOString()]
            )
            newSlots++
          } catch { /* skip */ }
        }
      }
    }
    if (newSlots > 0) {
      console.log(`[scheduler] Generated ${newSlots} new doctor slots for Day 7`)
    }
  } catch (err) {
    console.error('[scheduler] Failed to generate slots:', err)
  }
}

async function processFollowUps(): Promise<void> {
  try {
    // Process in batches of 50 until all due follow-ups are sent.
    // This handles server downtime scenarios where hundreds may be due at once
    // without unbounded memory usage from a single massive query.
    const BATCH_SIZE = 50
    let totalSent = 0

    while (true) {
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
         LIMIT $1`,
        [BATCH_SIZE]
      )

      if (result.rows.length === 0) break  // No more due follow-ups

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

          // Mark as sent individually — a DB failure here doesn't block the rest
          await query(
            'UPDATE follow_ups SET sent = TRUE, sent_at = NOW() WHERE id = $1',
            [row.follow_up_id]
          )
          totalSent++
        } catch (rowErr) {
          console.error(`[follow-up] Failed for follow_up ${row.follow_up_id}:`, rowErr)
        }
      }

      // If we got fewer rows than the batch size, there are no more to process
      if (result.rows.length < BATCH_SIZE) break
    }

    if (totalSent > 0) {
      console.log(`[follow-up] Sent ${totalSent} follow-up notification(s)`)
    }
  } catch (err) {
    console.error('[follow-up] Scheduler error:', err)
  }
}

// ─── Start — call once at server boot ────────────────────────────────────────

let followUpInterval: ReturnType<typeof setInterval> | null = null

export function startFollowUpScheduler(): void {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.log('[follow-up] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — follow-up scheduler disabled')
    return
  }

  // Run immediately on boot (catches any missed follow-ups from downtime)
  processFollowUps()
  generateFutureSlots()

  // Then every hour
  followUpInterval = setInterval(() => {
    processFollowUps()
    // Run slot generation daily (approx)
    if (new Date().getHours() === 2) { // 2 AM
      generateFutureSlots()
    }
  }, 60 * 60 * 1000)
  console.log('[follow-up] Scheduler started — checks every hour')
}

export function stopFollowUpScheduler(): void {
  if (followUpInterval) {
    clearInterval(followUpInterval)
    followUpInterval = null
    console.log('[follow-up] Scheduler stopped')
  }
}
