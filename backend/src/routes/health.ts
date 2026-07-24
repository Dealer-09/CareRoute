import { Router } from 'express'
import { query } from '../db/connection'

const router = Router()

router.get('/', async (req, res) => {
  try {
    // Check DB connection
    const result = await query('SELECT NOW()')
    res.json({ 
      status: 'ok', 
      db: 'connected', 
      time: result.rows[0].now 
    })
  } catch (error) {
    console.error('Health check DB error:', error)
    res.status(500).json({ status: 'error', db: 'disconnected' })
  }
})

export default router
