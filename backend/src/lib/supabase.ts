import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '../.env.local' })

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL or SUPABASE_SECRET_KEY missing in .env.local')
}

// Service-role client — bypasses RLS, server-side only, never expose to client
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

export const BUCKET = 'patient-documents'
