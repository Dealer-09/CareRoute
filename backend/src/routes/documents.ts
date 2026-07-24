import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { query } from '../db/connection'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { supabase, BUCKET } from '../lib/supabase'

const router = Router()

// ─── Multer — memory storage (no disk writes) ─────────────────────────────────
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only PDF, JPEG, PNG, and WEBP files are allowed'))
    }
  },
})

// POST /api/documents/upload — upload a file to Supabase Storage
router.post('/upload', requireAuth, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    const userId = req.user!.id
    const { triage_case_id } = req.body // optional — link doc to a triage case

    // 1. Get patient ID
    const patientResult = await query('SELECT id FROM patients WHERE user_id = $1', [userId])
    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient profile not found' })
    }
    const patientId = patientResult.rows[0].id

    // 2. Build a unique storage path: {patientId}/{timestamp}-{originalname}
    const ext = path.extname(req.file.originalname).toLowerCase()
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${patientId}/${Date.now()}-${safeName}`

    // 3. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return res.status(500).json({ error: 'File upload failed: ' + uploadError.message })
    }

    // 4. Save metadata to documents table
    const insertResult = await query(
      `INSERT INTO documents (patient_id, triage_case_id, file_name, storage_path, mime_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, file_name, storage_path, mime_type, created_at`,
      [patientId, triage_case_id || null, req.file.originalname, storagePath, req.file.mimetype]
    )

    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [userId, 'UPLOAD_DOCUMENT', 'documents', insertResult.rows[0].id]
    )

    res.json({ success: true, document: insertResult.rows[0] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    // multer file filter errors arrive here
    if (msg.includes('Only PDF')) {
      return res.status(400).json({ error: msg })
    }
    if (msg.includes('File too large')) {
      return res.status(400).json({ error: 'File too large (max 10 MB)' })
    }
    console.error('POST /documents/upload error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/documents — list all documents for the current user
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id

    const result = await query(
      `SELECT d.id, d.file_name, d.storage_path, d.mime_type, d.triage_case_id, d.created_at
       FROM documents d
       JOIN patients p ON d.patient_id = p.id
       WHERE p.user_id = $1
       ORDER BY d.created_at DESC`,
      [userId]
    )

    // Generate short-lived signed URLs for each file (1 hour)
    const docs = await Promise.all(
      result.rows.map(async (row) => {
        const { data } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(row.storage_path, 3600)
        return {
          id: row.id,
          file_name: row.file_name,
          mime_type: row.mime_type,
          triage_case_id: row.triage_case_id,
          created_at: row.created_at,
          url: data?.signedUrl ?? null,
        }
      })
    )

    res.json({ documents: docs })
  } catch (err) {
    console.error('GET /documents error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/documents/:id — delete a document
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const { id } = req.params

    // Verify ownership before deleting
    const result = await query(
      `SELECT d.id, d.storage_path
       FROM documents d
       JOIN patients p ON d.patient_id = p.id
       WHERE d.id = $1 AND p.user_id = $2`,
      [id, userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const { storage_path } = result.rows[0]

    // Remove from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from(BUCKET)
      .remove([storage_path])

    if (deleteError) {
      console.error('Supabase delete error:', deleteError)
      return res.status(500).json({ error: 'Failed to delete file from storage' })
    }

    // Remove metadata from DB
    await query('DELETE FROM documents WHERE id = $1', [id])

    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [userId, 'DELETE_DOCUMENT', 'documents', id]
    )

    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /documents/:id error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
