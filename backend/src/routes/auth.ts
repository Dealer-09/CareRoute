import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { query, transaction } from '../db/connection'

import rateLimit from 'express-rate-limit'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
})

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  role: z.enum(['patient', 'doctor']).default('patient'),
  name: z.string().optional() // For patient profile creation
}).superRefine((data, ctx) => {
  if (data.role === 'doctor' && (!data.name || data.name.trim() === '')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Name is required for doctors', path: ['name'] })
  }
})

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string()
})

router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { email, password, role, name } = signupSchema.parse(req.body)
    const secret = process.env.JWT_SECRET
    if (!secret) return res.status(500).json({ error: 'Internal server error' })

    // 1. Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    // 2. Hash password and create user
    const hash = await bcrypt.hash(password, 12)
    
    // Start transaction since we're creating user + patient profile
    const user = await transaction(async (client) => {
      const userResult = await client.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, role',
        [email, hash, role]
      )
      const u = userResult.rows[0]

      // 3. Create linked profile based on role
      if (role === 'patient') {
        await client.query(
          'INSERT INTO patients (user_id, name) VALUES ($1, $2)',
          [u.id, name || '']
        )
      } else if (role === 'doctor') {
        await client.query(
          'INSERT INTO doctors (user_id, name, specialty) VALUES ($1, $2, $3)',
          [u.id, name || '', 'General Practice'] // Default specialty, can be updated later
        )
      }

      // Log the event
      await client.query(
        'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
        [u.id, 'USER_SIGNUP', 'users', u.id]
      )

      return u
    })

    // 4. Issue token
    const token = jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '7d' })
    
    res.json({ token, user: { id: user.id, email, role: user.role } })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    console.error('Signup error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/signin', authLimiter, async (req, res) => {
  try {
    const { email, password } = signinSchema.parse(req.body)
    const secret = process.env.JWT_SECRET
    if (!secret) return res.status(500).json({ error: 'Internal server error' })

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
