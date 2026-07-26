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

    // Verify ownership
    const check = await query('SELECT id FROM dependents WHERE id = $1 AND user_id = $2', [id, req.user!.id])
    if (check.rows.length === 0) return res.status(404).json({ error: 'Dependent not found' })

    const result = await query(
      `UPDATE dependents
       SET name          = COALESCE($1, name),
           date_of_birth = COALESCE($2, date_of_birth),
           gender        = COALESCE($3, gender),
           relationship  = COALESCE($4, relationship)
       WHERE id = $5
       RETURNING id, name, date_of_birth, gender, relationship, created_at`,
      [data.name, data.date_of_birth || null, data.gender || null, data.relationship, id]
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
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /dependents/:id error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
