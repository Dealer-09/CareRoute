import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { query } from '../db/connection'

const router = Router()

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['patient', 'doctor']).default('patient'),
  name: z.string().optional() // For patient profile creation
})

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string()
})

router.post('/signup', async (req, res) => {
  try {
    const { email, password, role, name } = signupSchema.parse(req.body)
    const secret = process.env.JWT_SECRET!

    // 1. Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    // 2. Hash password and create user
    const hash = await bcrypt.hash(password, 12)
    
    // Start transaction since we're creating user + patient profile
    await query('BEGIN')
    
    const userResult = await query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, role',
      [email, hash, role]
    )
    const user = userResult.rows[0]

    // 3. Create linked profile based on role
    if (role === 'patient') {
      await query(
        'INSERT INTO patients (user_id, name) VALUES ($1, $2)',
        [user.id, name || '']
      )
    }

    // Log the event
    await query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [user.id, 'USER_SIGNUP', 'users', user.id]
    )

    await query('COMMIT')

    // 4. Issue token
    const token = jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '7d' })
    
    res.json({ token, user: { id: user.id, email, role: user.role } })

  } catch (err) {
    await query('ROLLBACK')
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    console.error('Signup error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/signin', async (req, res) => {
  try {
    const { email, password } = signinSchema.parse(req.body)
    const secret = process.env.JWT_SECRET!

    const result = await query('SELECT id, email, password_hash, role FROM users WHERE email = $1', [email])
    const user = result.rows[0]

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      // Log failed attempt
      await query(
        'INSERT INTO audit_log (action, payload) VALUES ($1, $2)',
        ['FAILED_LOGIN', JSON.stringify({ email })]
      )
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Log success
    await query(
      'INSERT INTO audit_log (user_id, action) VALUES ($1, $2)',
      [user.id, 'USER_LOGIN']
    )

    const token = jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '7d' })
    
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    console.error('Signin error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
