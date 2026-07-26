import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/connection'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// All admin routes require role === 'admin'
function requireAdmin(req: AuthRequest, res: any, next: any) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [users, triage, severities, docs, appts, emergencies] = await Promise.all([
      query('SELECT COUNT(*) AS total FROM users'),
      query('SELECT COUNT(*) AS total FROM triage_cases'),
      query(`SELECT severity, COUNT(*) AS count FROM triage_cases GROUP BY severity`),
      query('SELECT COUNT(*) AS total FROM documents'),
      query('SELECT COUNT(*) AS total FROM appointments'),
      query(`SELECT COUNT(*) AS total FROM triage_cases WHERE emergency = TRUE`),
    ])

    const severityMap: Record<string, number> = { Green: 0, Amber: 0, Red: 0 }
    severities.rows.forEach((r: any) => { severityMap[r.severity] = Number(r.count) })

    res.json({
      users:       Number(users.rows[0].total),
      triage:      Number(triage.rows[0].total),
      documents:   Number(docs.rows[0].total),
      appointments:Number(appts.rows[0].total),
      emergencies: Number(emergencies.rows[0].total),
      by_severity: severityMap,
    })
  } catch (err) {
    console.error('GET /admin/stats error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { search = '', limit = '50', offset = '0' } = req.query as Record<string, string>
    const likePattern = `%${search}%`

    const result = await query(
      `SELECT
         u.id, u.email, u.role, u.created_at,
         p.name AS patient_name,
         (SELECT COUNT(*) FROM triage_cases t JOIN patients px ON t.patient_id = px.id WHERE px.user_id = u.id) AS triage_count
       FROM users u
       LEFT JOIN patients p ON p.user_id = u.id
       WHERE u.email ILIKE $1
       ORDER BY u.created_at DESC
       LIMIT $2 OFFSET $3`,
      [likePattern, parseInt(limit), parseInt(offset)]
    )

    const countResult = await query(
      'SELECT COUNT(*) AS total FROM users WHERE email ILIKE $1',
      [likePattern]
    )

    res.json({
      users: result.rows,
      total: Number(countResult.rows[0].total),
    })
  } catch (err) {
    console.error('GET /admin/users error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── PATCH /api/admin/users/:id/role ─────────────────────────────────────────
router.patch('/users/:id/role', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const { role } = z.object({ role: z.enum(['patient', 'doctor', 'admin']) }).parse(req.body)

    // Prevent self-demotion
    if (id === req.user!.id && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change your own admin role' })
    }

    const result = await query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role',
      [role, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, payload) VALUES ($1, $2, $3, $4, $5)',
      [req.user!.id, 'ADMIN_ROLE_CHANGE', 'users', id, JSON.stringify({ new_role: role })]
    )

    res.json(result.rows[0])
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid role' })
    }
    console.error('PATCH /admin/users/:id/role error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
router.delete('/users/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' })
    }
    await query('DELETE FROM users WHERE id = $1', [id])
    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [req.user!.id, 'ADMIN_DELETE_USER', 'users', id]
    )
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /admin/users/:id error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── GET /api/admin/audit ─────────────────────────────────────────────────────
router.get('/audit', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { limit = '100', offset = '0', action = '' } = req.query as Record<string, string>

    const result = await query(
      `SELECT
         a.id, a.action, a.entity_type, a.entity_id, a.payload, a.created_at,
         u.email AS user_email, u.role AS user_role
       FROM audit_log a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE ($1 = '' OR a.action ILIKE $1)
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [action ? `%${action}%` : '', parseInt(limit), parseInt(offset)]
    )

    res.json({ audit: result.rows })
  } catch (err) {
    console.error('GET /admin/audit error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── GET /api/admin/triage/recent ────────────────────────────────────────────
// Recent Red / emergency cases for the overview dashboard
router.get('/triage/recent', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await query(
      `SELECT
         t.id, t.severity, t.emergency, t.condition_guess, t.summary,
         t.reviewed, t.created_at,
         p.name AS patient_name
       FROM triage_cases t
       JOIN patients p ON t.patient_id = p.id
       WHERE t.severity = 'Red' OR t.emergency = TRUE
       ORDER BY t.created_at DESC
       LIMIT 20`
    )
    res.json({ cases: result.rows })
  } catch (err) {
    console.error('GET /admin/triage/recent error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
