import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/connection'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { sendEmergencyAlert } from '../lib/telegram'

const router = Router()

// TriageResult schema based on our frontend type
const triageCaseSchema = z.object({
  severity: z.enum(['Green', 'Amber', 'Red']),
  emergency: z.boolean(),
  condition_guess: z.string(),
  summary: z.string(),
  reasoning: z.array(z.string()),
  redFlags: z.array(z.string()),
  recommended_specialty: z.string(),
  specialty_reason: z.string(),
  advice: z.string(),
  duration: z.string().optional(),
  symptom_text: z.string().optional()
})

// Protected route: Save a new triage case
router.post('/save', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = triageCaseSchema.parse(req.body)
    const userId = req.user!.id

    // 1. Get the patient ID for this user
    const patientResult = await query('SELECT id FROM patients WHERE user_id = $1', [userId])
    let patientId = patientResult.rows[0]?.id

    if (!patientId) {
      // Fallback: create patient profile if missing (should be created at signup)
      const newPatient = await query(
        'INSERT INTO patients (user_id, name) VALUES ($1, $2) RETURNING id',
        [userId, 'Unknown']
      )
      patientId = newPatient.rows[0].id
    }

    // 2. Insert the triage case
    const insertResult = await query(
      `INSERT INTO triage_cases (
        patient_id, severity, emergency, condition_guess, summary, 
        reasoning, red_flags, recommended_specialty, specialty_reason, 
        advice, duration, symptom_text
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        patientId,
        data.severity,
        data.emergency,
        data.condition_guess,
        data.summary,
        JSON.stringify(data.reasoning),
        JSON.stringify(data.redFlags),
        data.recommended_specialty,
        data.specialty_reason,
        data.advice,
        data.duration,
        data.symptom_text
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
      const patientResult2 = await query(
        'SELECT name FROM patients WHERE id = $1', [patientId]
      )
      sendEmergencyAlert({
        severity:             data.severity,
        emergency:            data.emergency,
        patientName:          patientResult2.rows[0]?.name || 'Unknown Patient',
        conditionGuess:       data.condition_guess,
        summary:              data.summary,
        redFlags:             data.redFlags,
        recommendedSpecialty: data.recommended_specialty,
        triageCaseId,
      }).catch(() => { /* already logged inside */ })
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

    const historyResult = await query(
      `SELECT t.* 
       FROM triage_cases t
       JOIN patients p ON t.patient_id = p.id
       WHERE p.user_id = $1
       ORDER BY t.created_at DESC`,
      [userId]
    )

    // Map DB columns to our frontend TriageResult type
    const history = historyResult.rows.map(row => ({
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
      timestamp: new Date(row.created_at).getTime()
    }))

    res.json({ history })
  } catch (err) {
    console.error('Get history error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})


// Clinician-only route: all triage cases across all patients
router.get('/queue', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role } = req.user!
    if (role !== 'doctor' && role !== 'admin') {
      return res.status(403).json({ error: 'Clinician access required' })
    }

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
       ORDER BY
         t.reviewed ASC,          -- unreviewed first
         t.severity = 'Red' DESC, -- Red before Amber before Green
         t.created_at DESC`,
      []
    )

    const queue = result.rows.map(row => ({
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
router.patch('/:id/review', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: userId } = req.user!
    if (role !== 'doctor' && role !== 'admin') {
      return res.status(403).json({ error: 'Clinician access required' })
    }

    const { id } = req.params
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
router.patch('/:id/note', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { role, id: userId } = req.user!
    if (role !== 'doctor' && role !== 'admin') {
      return res.status(403).json({ error: 'Clinician access required' })
    }

    const { id } = req.params
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

