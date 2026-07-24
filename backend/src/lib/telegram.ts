/**
 * Telegram emergency alert utility.
 * Fire-and-forget — never throws, never blocks the save response.
 * Silently skips if TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID are not configured.
 */

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID    = process.env.TELEGRAM_CHAT_ID

export type AlertPayload = {
  severity: string
  emergency: boolean
  patientName: string
  conditionGuess: string
  summary: string
  redFlags: string[]
  recommendedSpecialty: string
  triageCaseId: string
}

function buildMessage(p: AlertPayload): string {
  const flag   = p.emergency ? '🚨' : '🔴'
  const badge  = p.emergency ? 'EMERGENCY' : 'RED — HIGH PRIORITY'
  const flags  = p.redFlags.length > 0 ? p.redFlags.map(f => `  • ${f}`).join('\n') : '  None'

  return [
    `${flag} <b>CareRoute Alert — ${badge}</b>`,
    '',
    `<b>Patient:</b> ${p.patientName}`,
    `<b>Condition:</b> ${p.conditionGuess}`,
    `<b>Specialty:</b> ${p.recommendedSpecialty}`,
    '',
    `<b>Summary:</b>`,
    p.summary,
    '',
    `<b>Red Flags:</b>`,
    flags,
    '',
    `<b>Case ID:</b> <code>${p.triageCaseId}</code>`,
    `<i>Review immediately in the clinician dashboard.</i>`,
  ].join('\n')
}

export async function sendEmergencyAlert(payload: AlertPayload): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) {
    // Not configured — skip silently (dev/test environment)
    return
  }

  const url  = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
  const body = JSON.stringify({
    chat_id:    CHAT_ID,
    text:       buildMessage(payload),
    parse_mode: 'HTML',
  })

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (!res.ok) {
      const err = await res.text()
      console.error(`Telegram alert failed [${res.status}]:`, err)
    } else {
      console.log(`📣 Telegram alert sent for case ${payload.triageCaseId}`)
    }
  } catch (err) {
    // Network failure — log and continue, never crash the save flow
    console.error('Telegram alert network error:', err)
  }
}
