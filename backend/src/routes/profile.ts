import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/connection'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const patchProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').optional(),
  gender: z.enum(['M', 'F', 'Other']).optional(),
  phone: z.string().max(20).optional(),
})


// GET /api/profile — get current user's patient profile
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id

    const result = await query(
      `SELECT p.id, p.name, p.date_of_birth, p.gender, p.phone, u.email, u.role
       FROM patients p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      // Patient profile missing — create a blank one and return it
      const newPatient = await query(
        'INSERT INTO patients (user_id, name) VALUES ($1, $2) RETURNING id, name, date_of_birth, gender',
        [userId, '']
      )
      const userRow = await query('SELECT email, role FROM users WHERE id = $1', [userId])
      return res.json({ ...newPatient.rows[0], ...userRow.rows[0] })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error('GET /api/profile error:', err instanceof Error ? err.message : err)
    res.status(500).json({ error: 'Failed to load profile' })
  }
})

// PATCH /api/profile — update name, DOB, gender
router.patch('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const parsed = patchProfileSchema.parse(req.body)

    // Build SET clause dynamically from provided fields only
    const fields: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (parsed.name !== undefined) {
      fields.push(`name = $${idx++}`)
      values.push(parsed.name)
    }
    if (parsed.date_of_birth !== undefined) {
      fields.push(`date_of_birth = $${idx++}`)
      values.push(parsed.date_of_birth)
    }
    if (parsed.gender !== undefined) {
      fields.push(`gender = $${idx++}`)
      values.push(parsed.gender)
    }
    if (parsed.phone !== undefined) {
      fields.push(`phone = $${idx++}`)
      values.push(parsed.phone)
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    values.push(userId)
    const result = await query(
      `UPDATE patients SET ${fields.join(', ')}
       WHERE user_id = $${idx}
       RETURNING id, name, date_of_birth, gender, phone`,
      values
    )

    if (result.rows.length === 0) {
      // Patient row missing (e.g. doctor role changed to patient, or signup transaction
      // partially failed). Auto-create it, then apply the update.
      const newPatient = await query(
        'INSERT INTO patients (user_id, name) VALUES ($1, $2) RETURNING id',
        [userId, parsed.name || '']
      )
      const patientId = newPatient.rows[0].id

      // Re-run the update now that the row exists
      const retryResult = await query(
        `UPDATE patients SET ${fields.join(', ')}
         WHERE user_id = $${idx}
         RETURNING id, name, date_of_birth, gender, phone`,
        values
      )

      await query(
        'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
        [userId, 'UPDATE_PROFILE', 'patients', patientId]
      )
      return res.json(retryResult.rows[0])
    }

    // Audit
    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [userId, 'UPDATE_PROFILE', 'patients', result.rows[0].id]
    )

    res.json(result.rows[0])
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    console.error('PATCH /api/profile error:', err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

export default router
