import { Pool, PoolClient } from 'pg'
import dotenv from 'dotenv'
import path from 'path'

// Use __dirname so this works regardless of where the process is started from
// (e.g. Docker, monorepo scripts, or running ts-node from a different cwd)
dotenv.config({ path: path.join(__dirname, '../../../.env.local') })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing in .env.local')
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Prevent pool exhaustion under load — Supabase free tier allows ~15 concurrent connections
  max: 10,
  // Release idle connections after 30s to avoid holding Supabase connection slots unnecessarily
  idleTimeoutMillis: 30_000,
  // Fail fast if the pool is saturated rather than queuing indefinitely
  connectionTimeoutMillis: 5_000,
})

// Prevent Node crash on unexpected Postgres connection drops
pool.on('error', (err) => {
  console.error('[db] Unexpected pool client error:', err.message)
})

export const query = (text: string, params?: unknown[]) => {
  return pool.query(text, params)
}

export const transaction = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
