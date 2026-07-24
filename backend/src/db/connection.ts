import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '../.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing in .env.local')
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Add SSL if needed for Supabase depending on node version and environment, but generally not required for dev if not strictly enforced.
  // We'll leave it simple for now, but usually Supabase requires SSL.
  ssl: { rejectUnauthorized: false }
})

export const query = (text: string, params?: any[]) => pool.query(text, params)
