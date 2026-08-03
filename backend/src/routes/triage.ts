import { Router } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { query } from '../db/connection'
import { requireAuth, requireClinician, AuthRequest } from '../middleware/auth'
import { sendEmergencyAlert } from '../lib/telegram'
import { addConnection, removeConnection, broadcast } from '../lib/sse'
import { scheduleFollowUp } from '../lib/followup'

import { randomUUID } from 'crypto'

const router = Router()

// Rate limit only the expensive save route — NOT the queue or SSE endpoints
const saveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many triage requests. Please wait a moment.' },
})

// Store short-lived SSE tickets (valid for 30s)
const sseTickets = new Map<string, { id: string; role: string }>()

router.post('/queue/ticket', requireAuth, requireClinician, (req: AuthRequest, res) => {
  const ticket = randomUUID()
  sseTickets.set(ticket, req.user!)
  setTimeout(() => sseTickets.delete(ticket), 30000)
  res.json({ ticket })
})


// TriageResult schema based on our frontend type
const triageCaseSchema = z.object({
  severity:              z.enum(['Green', 'Amber', 'Red']),
  emergency:             z.boolean(),
  condition_guess:       z.string(),
  summary:               z.string(),
  reasoning:             z.array(z.string()),
  redFlags:              z.array(z.string()),
  recommended_specialty: z.string(),
  specialty_reason:      z.string(),
  advice:                z.string(),
  duration:              z.string().optional(),
  symptom_text:          z.string().optional(),
  for_dependent_id:      z.string().uuid().optional(),
  for_name:              z.string().optional(),
  confidence:            z.number().int().min(0).max(100).optional(),
  decision_record:       z.record(z.unknown()).optional(),
  vitals: z.object({
    heartRateBpm: z.number().optional(),
    spo2Percent: z.number().optional(),
    temperatureCelsius: z.number().optional(),
    systolicBp: z.number().optional(),
    diastolicBp: z.number().optional(),
  }).optional(),
})

// Protected route: Save a new triage case
router.post('/save', saveLimiter, requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = triageCaseSchema.parse(req.body)
    const userId = req.user!.id

    // 1. Get the patient ID and name for this user
    const patientResult = await query('SELECT id, name, gender, date_of_birth FROM patients WHERE user_id = $1', [userId])
    let patientId = patientResult.rows[0]?.id
    let patientName = patientResult.rows[0]?.name
    let patientGender = patientResult.rows[0]?.gender
    let patientDob = patientResult.rows[0]?.date_of_birth

    if (!patientId) {
      // Fallback: create patient profile if missing (should be created at signup)
      const newPatient = await query(
        'INSERT INTO patients (user_id, name) VALUES ($1, $2) RETURNING id',
        [userId, 'Unknown']
      )
      patientId = newPatient.rows[0].id
    }

    if (data.for_dependent_id) {
      // Verify the dependent belongs to the requesting user before using their demographics.
      // Without this check, a patient could submit a triage attributed to any dependent by UUID.
      const depResult = await query(
        'SELECT gender, date_of_birth FROM dependents WHERE id = $1 AND user_id = $2',
        [data.for_dependent_id, userId]
      )
      if (depResult.rows.length === 0) {
        return res.status(403).json({ error: 'Dependent not found or does not belong to your account' })
      }
      patientGender = depResult.rows[0].gender
      patientDob = depResult.rows[0].date_of_birth
    }

    // 2. Insert the triage case
    const insertResult = await query(
      `INSERT INTO triage_cases (
        patient_id, severity, emergency, condition_guess, summary,
        reasoning, red_flags, recommended_specialty, specialty_reason,
        advice, duration, symptom_text, for_dependent_id, for_name, confidence, decision_record
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`,
      [
        patientId,
        data.severity,
        data.emergency,
        data.condition_guess,
        data.summary,
        JSON.stringify(data.reasoning),   // must stringify for JSONB columns
        JSON.stringify(data.redFlags),    // must stringify for JSONB columns
        data.recommended_specialty,
        data.specialty_reason,
        data.advice,
        data.duration,
        data.symptom_text,
        data.for_dependent_id ?? null,
        data.for_name ?? null,
        data.confidence ?? null,
        (data as any).decision_record ? JSON.stringify((data as any).decision_record) : null
      ]
    )

    const triageCaseId = insertResult.rows[0].id

    // 3. Log the action
    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [userId, 'SAVE_TRIAGE', 'triage_cases', triageCaseId]
    )

    // 4. Fire Telegram alert for Red / emergency cases (non-blocking)
    if (data.severity === 'Red' || data.emergency) {
      sendEmergencyAlert({
        severity:             data.severity,
        emergency:            data.emergency,
        patientName:          patientName || 'Unknown Patient',
        conditionGuess:       data.condition_guess,
        summary:              data.summary,
        redFlags:             data.redFlags,
        recommendedSpecialty: data.recommended_specialty,
        triageCaseId,
      }).catch(() => { /* already logged inside */ })
    }

    // 5. Broadcast to all connected clinician SSE streams
    broadcast('new_case', {
      id:                    triageCaseId,
      severity:              data.severity,
      emergency:             data.emergency,
      condition_guess:       data.condition_guess,
      summary:               data.summary,
      recommended_specialty: data.recommended_specialty,
      patient_name:          patientName || 'Unknown Patient',
      gender:                patientGender,
      date_of_birth:         patientDob,
      created_at:            new Date().toISOString(),
    })

    // 6. Schedule 24h follow-up for Red and Amber cases
    if (data.severity === 'Red' || data.severity === 'Amber') {
      scheduleFollowUp(triageCaseId, patientId)
    }

    res.json({ success: true, triageCaseId })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    console.error('Save triage error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Protected route: Get triage history for a user
router.get('/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const limit  = Math.min(Math.max(parseInt(req.query.limit  as string) || 20, 1), 100)
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0)

    const [historyResult, countResult] = await Promise.all([
      query(
        `SELECT t.id, t.severity, t.emergency, t.condition_guess, t.summary, 
                t.reasoning, t.red_flags, t.duration,
                t.recommended_specialty, t.specialty_reason, t.advice, t.created_at,
                t.for_dependent_id, t.for_name
         FROM triage_cases t
         JOIN patients p ON t.patient_id = p.id
         WHERE p.user_id = $1
         ORDER BY t.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      query(
        `SELECT COUNT(*) AS total
         FROM triage_cases t
         JOIN patients p ON t.patient_id = p.id
         WHERE p.user_id = $1`,
        [userId]
      ),
    ])

    // Map DB columns to our frontend TriageResult type
    const history = historyResult.rows.map((row: any) => ({
      id: row.id,
      severity: row.severity,
      emergency: row.emergency,
      condition_guess: row.condition_guess,
      summary: row.summary,
      reasoning: row.reasoning,
      redFlags: row.red_flags,
      recommended_specialty: row.recommended_specialty,
      specialty_reason: row.specialty_reason,
      advice: row.advice,
      duration: row.duration,
      for_dependent_id: row.for_dependent_id,
      for_name: row.for_name,
      timestamp: new Date(row.created_at).getTime()
    }))

    res.json({
      history,
      pagination: {
        total:  Number(countResult.rows[0].total),
        limit,
        offset,
        has_more: offset + history.length < Number(countResult.rows[0].total),
      },
    })
  } catch (err) {
    console.error('Get history error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})


// Clinician-only route: live queue stream (Server-Sent Events)
router.get('/queue/stream', (req, res, next) => {
  const ticket = req.query.ticket as string
  if (ticket) {
    const user = sseTickets.get(ticket)
    if (user) {
      sseTickets.delete(ticket) // Single-use
      ;(req as AuthRequest).user = user
      return next()
    }
  }
  return res.status(401).json({ error: 'Invalid or expired SSE ticket' })
}, (req: AuthRequest, res) => {
  const { role } = req.user!
  if (role !== 'doctor' && role !== 'admin') {
    return res.status(403).json({ error: 'Clinician access required' })
  }

  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.flushHeaders()

  // Send a heartbeat immediately so the client knows it's connected
  res.write('event: connected\ndata: {}\n\n')

  addConnection(res)

  // Clean up when the client disconnects
  req.on('close', () => removeConnection(res))
})

// Clinician-only route: all triage cases across all patients
router.get('/queue', requireAuth, requireClinician, async (req: AuthRequest, res) => {
  try {
    const sinceDate = req.query.since && !isNaN(new Date(req.query.since as string).getTime())
      ? new Date(req.query.since as string).toISOString()
      : null

    const result = await query(
      `SELECT
         t.id, t.severity, t.emergency, t.condition_guess, t.summary,
         t.reasoning, t.red_flags, t.recommended_specialty,
         t.advice, t.symptom_text, t.reviewed, t.reviewed_at,
         t.clinician_note, t.created_at,
         p.name  AS patient_name,
         p.gender,
         p.date_of_birth
       FROM triage_cases t
       JOIN patients p ON t.patient_id = p.id
       ${sinceDate ? 'WHERE t.created_at > $1' : ''}
       ORDER BY
         t.reviewed ASC,
         CASE t.severity WHEN 'Red' THEN 1 WHEN 'Amber' THEN 2 ELSE 3 END ASC,
         t.created_at DESC`,
      sinceDate ? [sinceDate] : []
    )

    const queue = result.rows.map((row: any) => ({
      id: row.id,
      severity: row.severity,
      emergency: row.emergency,
      condition_guess: row.condition_guess,
      summary: row.summary,
      reasoning: row.reasoning,
      redFlags: row.red_flags,
      recommended_specialty: row.recommended_specialty,
      advice: row.advice,
      symptom_text: row.symptom_text,
      reviewed: row.reviewed,
      reviewed_at: row.reviewed_at,
      clinician_note: row.clinician_note,
      created_at: row.created_at,
      patient_name: row.patient_name || 'Unknown Patient',
      gender: row.gender,
      date_of_birth: row.date_of_birth,
    }))

    res.json({ queue })
  } catch (err) {
    console.error('GET /queue error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Clinician-only route: mark a case as reviewed
router.patch('/:id/review', requireAuth, requireClinician, async (req: AuthRequest, res) => {
  try {
    const { id: userId } = req.user!

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const result = await query(
      `UPDATE triage_cases
       SET reviewed = TRUE, reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2
       RETURNING id, reviewed, reviewed_at`,
      [userId, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Triage case not found' })
    }

    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [userId, 'CLINICIAN_REVIEW', 'triage_cases', id]
    )

    res.json(result.rows[0])
  } catch (err) {
    console.error('PATCH /:id/review error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Clinician-only route: save/update clinical note on a case
router.patch('/:id/note', requireAuth, requireClinician, async (req: AuthRequest, res) => {
  try {
    const { id: userId } = req.user!

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const { note } = z.object({ note: z.string().max(2000) }).parse(req.body)

    const result = await query(
      `UPDATE triage_cases SET clinician_note = $1 WHERE id = $2 RETURNING id, clinician_note`,
      [note, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Triage case not found' })
    }

    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [userId, 'CLINICIAN_NOTE', 'triage_cases', id]
    )

    res.json(result.rows[0])
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Note too long (max 2000 chars)' })
    }
    console.error('PATCH /:id/note error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

