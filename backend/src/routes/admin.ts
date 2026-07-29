import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/connection'
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth'
import { supabase, BUCKET } from '../lib/supabase'

const router = Router()

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [users, triageData, docs, appts] = await Promise.all([
      query('SELECT COUNT(*) AS total FROM users'),
      query(`SELECT 
              COUNT(*) AS total,
              COUNT(CASE WHEN emergency = TRUE THEN 1 END) AS emergencies,
              COUNT(CASE WHEN severity = 'Red' THEN 1 END) AS red_count,
              COUNT(CASE WHEN severity = 'Amber' THEN 1 END) AS amber_count,
              COUNT(CASE WHEN severity = 'Green' THEN 1 END) AS green_count
             FROM triage_cases`),
      query('SELECT COUNT(*) AS total FROM documents'),
      query('SELECT COUNT(*) AS total FROM appointments')
    ])

    const t = triageData.rows[0]
    const severityMap: Record<string, number> = { 
      Green: Number(t.green_count), 
      Amber: Number(t.amber_count), 
      Red: Number(t.red_count) 
    }

    res.json({
      users:       Number(users.rows[0].total),
      triage:      Number(t.total),
      documents:   Number(docs.rows[0].total),
      appointments:Number(appts.rows[0].total),
      emergencies: Number(t.emergencies),
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
         COUNT(t.id) AS triage_count
       FROM users u
       LEFT JOIN patients p ON p.user_id = u.id
       LEFT JOIN triage_cases t ON t.patient_id = p.id
       WHERE u.email ILIKE $1
       GROUP BY u.id, u.email, u.role, u.created_at, p.name
       ORDER BY u.created_at DESC
       LIMIT $2 OFFSET $3`,
      [likePattern, Math.min(Math.max(parseInt(limit) || 50, 1), 200), Math.max(parseInt(offset) || 0, 0)]
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

    // 1. Find all Supabase Storage files belonging to this user to delete later
    let paths: string[] = []
    const docsResult = await query(
      `SELECT d.storage_path FROM documents d
       JOIN patients p ON d.patient_id = p.id
       WHERE p.user_id = $1 AND d.storage_path IS NOT NULL`,
      [id]
    )
    if (docsResult.rows.length > 0) {
      paths = docsResult.rows.map((r: any) => r.storage_path)
    }

    // 2. Delete user from DB first — CASCADE removes patients, triage_cases, documents, appointments, dependents
    await query('DELETE FROM users WHERE id = $1', [id])
    
    // 3. Best-effort: delete files from Supabase Storage after DB succeeds.
    // Storage errors do NOT roll back the DB deletion (already committed) but we
    // surface them in the response so the caller knows files may be orphaned.
    let storageWarning: string | null = null
    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths)
      if (removeError) {
        console.error('Supabase remove error (files orphaned — DB already deleted):', removeError)
        storageWarning = `User deleted from DB but ${paths.length} storage file(s) could not be removed: ${removeError.message}`
      }
    }

    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [req.user!.id, 'ADMIN_DELETE_USER', 'users', id]
    )
    res.json({ success: true, ...(storageWarning ? { warning: storageWarning } : {}) })
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
      [action ? `%${action}%` : '', Math.min(Math.max(parseInt(limit) || 100, 1), 200), Math.max(parseInt(offset) || 0, 0)]
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

// "?"?"? GET /api/admin/compliance/decisions "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
router.get('/compliance/decisions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { limit = '100', offset = '0', severity = '' } = req.query as Record<string, string>

    const result = await query(
      `SELECT
         t.id, t.severity, t.emergency, t.decision_record, t.created_at,
         p.name AS patient_name,
         u.email AS patient_email
       FROM triage_cases t
       JOIN patients p ON t.patient_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE t.decision_record IS NOT NULL
         AND ($1 = '' OR t.severity = $1)
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [severity, Math.min(Math.max(parseInt(limit) || 100, 1), 200), Math.max(parseInt(offset) || 0, 0)]
    )

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM triage_cases WHERE decision_record IS NOT NULL AND ($1 = '' OR severity = $1)`,
      [severity]
    )

    res.json({
      decisions: result.rows,
      total: Number(countResult.rows[0].total)
    })
  } catch (err) {
    console.error('GET /admin/compliance/decisions error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
