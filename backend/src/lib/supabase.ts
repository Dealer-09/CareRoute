import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({
  path: path.join(
    __dirname,
    process.env.NODE_ENV === 'production' ? '../../../.env.production' : '../../../.env.local'
  ),
})

const supabaseUrl = process.env.SUPABASE_URL ?? ''
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY ?? ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[supabase] SUPABASE_URL or SUPABASE_SECRET_KEY not set — Storage features will be unavailable')
}

// Service-role client — bypasses RLS, server-side only, never expose to client
// Guard: createClient throws if URL is empty string, so only initialise when both vars are present
export const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null as any

export const BUCKET = 'patient-documents'

/**
 * Ensures the patient-documents storage bucket exists.
 * Call once at server startup. Safe to call on every boot — no-ops if already present.
 */
export async function ensureStorageBucket(): Promise<void> {
  try {
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets()
    if (listErr) {
      console.warn(`[storage] Could not list buckets: ${listErr.message}`)
      return
    }
    const exists = buckets?.some((b: { name: string }) => b.name === BUCKET)
    if (!exists) {
      const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
        public: false,          // signed URLs only — never public
        fileSizeLimit: 10485760, // 10 MB, matches multer limit in documents.ts
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      })
      if (createErr) {
        console.warn(`[storage] Could not create bucket "${BUCKET}": ${createErr.message}`)
      } else {
        console.log(`[storage] Created Supabase Storage bucket: ${BUCKET}`)
      }
    }
  } catch (err) {
    // Non-fatal — log and continue. Document uploads will fail with a clear error message.
    console.warn('[storage] Bucket check failed:', err)
  }
}
