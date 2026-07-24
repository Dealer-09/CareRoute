import fs from 'fs'
import path from 'path'
import { pool } from './connection'

export async function runMigrations() {
  const schemaPath = path.join(__dirname, 'schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')

  console.log('⏳ Running database migrations...')
  try {
    await pool.query(sql)
    console.log('✅ Database schema is up to date.')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}
