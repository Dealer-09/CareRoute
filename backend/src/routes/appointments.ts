import { Router } from 'express'
import { z } from 'zod'
import { query, transaction } from '../db/connection'
import { requireAuth, AuthRequest } from '../middleware/auth'

// ─── Doctor router — mounted at /api/doctors ──────────────────────────────────
export const doctorRouter = Router()

// GET /api/doctors — list all doctors (optionally filter by specialty)
doctorRouter.get('/', async (req, res) => {
  const { specialty } = req.query
  try {
    const result = await query(
      `SELECT id, name, specialty, location, contact, bio, experience_yrs, fee_inr, rating, available
       FROM doctors
       WHERE available = TRUE
       ${specialty ? "AND LOWER(specialty) = LOWER($1)" : ''}
       ORDER BY rating DESC NULLS LAST`,
      specialty ? [specialty] : []
    )
    res.json({ doctors: result.rows })
  } catch (err) {
    console.error('GET /doctors error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/doctors/:id/slots — available slots for next 7 days
doctorRouter.get('/:id/slots', async (req, res) => {
  const { id } = req.params
  try {
    const result = await query(
      `SELECT id, starts_at
       FROM doctor_slots
       WHERE doctor_id = $1
         AND is_booked = FALSE
         AND starts_at > NOW()
         AND starts_at < NOW() + INTERVAL '7 days'
       ORDER BY starts_at ASC`,
      [id]
    )
    res.json({ slots: result.rows })
  } catch (err) {
    console.error('GET /doctors/:id/slots error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Appointment router — mounted at /api/appointments ────────────────────────
export const appointmentRouter = Router()

// POST /api/appointments — book a slot
appointmentRouter.post('/', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    doctor_id:      z.string().uuid(),
    slot_id:        z.string().uuid(),
    triage_case_id: z.string().uuid().optional(),
    notes:          z.string().max(500).optional(),
  })

  try {
    const body = schema.parse(req.body)
    const userId = req.user!.id

    // 1. Get patient
    const patientRes = await query('SELECT id FROM patients WHERE user_id = $1', [userId])
    if (patientRes.rows.length === 0) {
      return res.status(404).json({ error: 'Patient profile not found. Complete your profile first.' })
    }
    const patientId = patientRes.rows[0].id

    // 2. Lock + verify slot inside a real transaction — FOR UPDATE holds on same connection
    const appt = await transaction(async (client) => {
      const slotRes = await client.query(
        'SELECT id, is_booked, starts_at FROM doctor_slots WHERE id = $1 AND doctor_id = $2 FOR UPDATE',
        [body.slot_id, body.doctor_id]
      )
      if (slotRes.rows.length === 0) throw new Error('Slot not found')
      if (slotRes.rows[0].is_booked)  throw new Error('Slot already booked. Please choose another.')

      const apptRes = await client.query(
        `INSERT INTO appointments (patient_id, doctor_id, slot_id, triage_case_id, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, status, created_at`,
        [patientId, body.doctor_id, body.slot_id, body.triage_case_id ?? null, body.notes ?? null]
      )
      await client.query('UPDATE doctor_slots SET is_booked = TRUE WHERE id = $1', [body.slot_id])
      return { ...apptRes.rows[0], starts_at: slotRes.rows[0].starts_at }
    })

    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [userId, 'BOOK_APPOINTMENT', 'appointments', appt.id]
    )

    res.json({ success: true, appointment: appt })
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message })
    if (err.message === 'Slot not found') return res.status(404).json({ error: err.message })
    if (err.message === 'Slot already booked. Please choose another.') return res.status(409).json({ error: err.message })
    console.error('POST /appointments error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/appointments — patient's own appointments
appointmentRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const result = await query(
      `SELECT
         a.id, a.status, a.notes, a.created_at,
         s.starts_at,
         d.name  AS doctor_name,
         d.specialty,
         d.location,
         d.contact,
         d.fee_inr,
         t.condition_guess,
         t.severity
       FROM appointments a
       JOIN doctor_slots s  ON a.slot_id   = s.id
       JOIN doctors d       ON a.doctor_id = d.id
       JOIN patients p      ON a.patient_id = p.id
       LEFT JOIN triage_cases t ON a.triage_case_id = t.id
       WHERE p.user_id = $1
       ORDER BY s.starts_at DESC`,
      [userId]
    )
    res.json({ appointments: result.rows })
  } catch (err) {
    console.error('GET /appointments error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/appointments/:id/cancel — cancel + release slot
appointmentRouter.patch('/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { id } = req.params

    const apptRes = await query(
      `SELECT a.id, a.slot_id, a.status
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       WHERE a.id = $1 AND p.user_id = $2`,
      [id, userId]
    )
    if (apptRes.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' })
    if (apptRes.rows[0].status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' })

    const slotId = apptRes.rows[0].slot_id

    await transaction(async (client) => {
      await client.query("UPDATE appointments SET status = 'cancelled' WHERE id = $1", [id])
      await client.query('UPDATE doctor_slots SET is_booked = FALSE WHERE id = $1', [slotId])
    })

    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [userId, 'CANCEL_APPOINTMENT', 'appointments', id]
    )

    res.json({ success: true })
  } catch (err) {
    console.error('PATCH /appointments/:id/cancel error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Keep default export as combined for backwards compat — but index.ts will use named exports
export default appointmentRouter
