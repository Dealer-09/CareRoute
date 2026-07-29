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

function escapeHTML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function buildMessage(p: AlertPayload): string {
  const flag   = p.emergency ? '🚨' : '🔴'
  const badge  = p.emergency ? 'EMERGENCY' : 'RED — HIGH PRIORITY'
  const flags  = p.redFlags.length > 0 ? p.redFlags.map(f => `  • ${escapeHTML(f)}`).join('\n') : '  None'

  return [
    `${flag} <b>CareRoute Alert — ${badge}</b>`,
    '',
    `<b>Patient:</b> ${escapeHTML(p.patientName)}`,
    `<b>Condition:</b> ${escapeHTML(p.conditionGuess)}`,
    `<b>Specialty:</b> ${escapeHTML(p.recommendedSpecialty)}`,
    '',
    `<b>Summary:</b>`,
    escapeHTML(p.summary),
    '',
    `<b>Red Flags:</b>`,
    flags,
    '',
    `<b>Case ID:</b> <code>${escapeHTML(p.triageCaseId)}</code>`,
    `<i>Review immediately in the clinician dashboard.</i>`,
  ].join('\n')
}

export async function sendTelegramMessage(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return
  const url  = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
    })
    if (!res.ok) console.error(`Telegram failed [${res.status}]:`, await res.text())
  } catch (err) {
    console.error('Telegram network error:', err)
  }
}

export async function sendEmergencyAlert(payload: AlertPayload): Promise<void> {
  // Fire-and-forget — delegates to shared sendTelegramMessage
  await sendTelegramMessage(buildMessage(payload))
    .then(() => console.log(`📣 Telegram alert sent for case ${payload.triageCaseId}`))
    .catch(err => console.error('Telegram alert error:', err))
}
