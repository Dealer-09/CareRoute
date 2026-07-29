import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/connection'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const dependentSchema = z.object({
  name:          z.string().min(1).max(100),
  date_of_birth: z.string().optional(), // YYYY-MM-DD
  gender:        z.enum(['M', 'F', 'Other']).optional(),
  relationship:  z.enum(['Child', 'Parent', 'Spouse', 'Sibling', 'Other']).default('Child'),
})

// GET /api/dependents — list all dependents for the logged-in user
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, name, date_of_birth, gender, relationship, created_at
       FROM dependents
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [req.user!.id]
    )
    res.json({ dependents: result.rows })
  } catch (err) {
    console.error('GET /dependents error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/dependents — add a dependent
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = dependentSchema.parse(req.body)
    const result = await query(
      `INSERT INTO dependents (user_id, name, date_of_birth, gender, relationship)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, date_of_birth, gender, relationship, created_at`,
      [req.user!.id, data.name, data.date_of_birth || null, data.gender || null, data.relationship]
    )
    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [req.user!.id, 'CREATE_DEPENDENT', 'dependents', result.rows[0].id]
    )
    res.status(201).json({ dependent: result.rows[0] })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message })
    }
    console.error('POST /dependents error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/dependents/:id — update a dependent
router.patch('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = dependentSchema.partial().parse(req.body)
    const { id } = req.params

    const updates: string[] = []
    const values: unknown[] = []
    let i = 1

    if (data.name !== undefined) { updates.push(`name = $${i++}`); values.push(data.name) }
    if (data.date_of_birth !== undefined) { updates.push(`date_of_birth = $${i++}`); values.push(data.date_of_birth || null) }
    if (data.gender !== undefined) { updates.push(`gender = $${i++}`); values.push(data.gender || null) }
    if (data.relationship !== undefined) { updates.push(`relationship = $${i++}`); values.push(data.relationship) }

    // No fields to update — verify ownership and return current row
    if (updates.length === 0) {
      const current = await query(
        'SELECT id, name, date_of_birth, gender, relationship, created_at FROM dependents WHERE id = $1 AND user_id = $2',
        [id, req.user!.id]
      )
      if (current.rows.length === 0) return res.status(404).json({ error: 'Dependent not found' })
      return res.json({ dependent: current.rows[0] })
    }

    // Single atomic UPDATE that combines ownership check + write — no SELECT/UPDATE race condition
    values.push(id, req.user!.id)
    const result = await query(
      `UPDATE dependents
       SET ${updates.join(', ')}
       WHERE id = $${i} AND user_id = $${i + 1}
       RETURNING id, name, date_of_birth, gender, relationship, created_at`,
      values
    )

    if (result.rows.length === 0) return res.status(404).json({ error: 'Dependent not found' })

    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [req.user!.id, 'UPDATE_DEPENDENT', 'dependents', id]
    )
    res.json({ dependent: result.rows[0] })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message })
    console.error('PATCH /dependents/:id error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/dependents/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const result = await query(
      'DELETE FROM dependents WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user!.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dependent not found' })
    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [req.user!.id, 'DELETE_DEPENDENT', 'dependents', id]
    )
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /dependents/:id error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
