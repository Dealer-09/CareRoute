import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import rateLimit from 'express-rate-limit'
import { runMigrations } from './db/migrate'
import { pool } from './db/connection'
import healthRoutes from './routes/health'
import authRoutes from './routes/auth'
import triageRoutes from './routes/triage'
import profileRoutes from './routes/profile'
import documentRoutes from './routes/documents'
import mapsRoutes from './routes/maps'
import { doctorRouter, appointmentRouter } from './routes/appointments'
import adminRoutes from './routes/admin'
import dependentRoutes from './routes/dependents'
import { startFollowUpScheduler, stopFollowUpScheduler } from './lib/followup'
import { stopHeartbeat } from './lib/sse'
import { ensureStorageBucket } from './lib/supabase'

dotenv.config({
  path: path.join(
    __dirname,
    process.env.NODE_ENV === 'production' ? '../../.env.production' : '../../.env.local'
  ),
})

// ── Fail-fast startup guards — checked before any route or middleware is registered ──
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is missing.')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL: DATABASE_URL environment variable is missing.')
  process.exit(1)
}

const app = express()
app.set('trust proxy', 1)
const PORT = process.env.PORT || 4000

// Middleware
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000', credentials: true }))
app.use(express.json())

// ── Rate limiting ────────────────────────────────────────────────────────────
// Auth routes have their own tighter limiter (10/15 min) defined in auth.ts.
// These limiters cover everything else.

// Maps: proxies Overpass API — protect against hammering the free OSM endpoint
const mapsLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 20,               // 20 map lookups per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many map requests. Please wait a moment.' },
})

// General API: covers profile, documents, appointments, dependents, admin
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 100,              // 100 requests per minute per IP (generous for normal use)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
})

// Routes
app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)                              // has its own authLimiter (10/15 min)
app.use('/api/triage', triageRoutes)   // saveLimiter applied per-route on POST /save in triage.ts
app.use('/api/profile', generalLimiter, profileRoutes)
app.use('/api/documents', generalLimiter, documentRoutes)
app.use('/api/maps', mapsLimiter, mapsRoutes)
app.use('/api/doctors', generalLimiter, doctorRouter)
app.use('/api/appointments', generalLimiter, appointmentRouter)
app.use('/api/admin', generalLimiter, adminRoutes)
app.use('/api/dependents', generalLimiter, dependentRoutes)

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON' })
  }
  console.error('Unhandled Route Error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

async function startServer() {
  console.log('🚀 Starting CareRoute backend...')
  
  // Run schema setup before accepting requests
  await runMigrations()

  // Ensure Supabase Storage bucket exists — safe to call on every boot
  await ensureStorageBucket()

  const server = app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`)
  })
  
  // Wait for listening before starting scheduler to avoid restart race condition
  server.on('listening', () => {
    startFollowUpScheduler()
  })

  // Graceful shutdown — stop dangling intervals before the process exits
  // so Docker/Kubernetes SIGTERM doesn't force a SIGKILL timeout
  function shutdown(signal: string) {
    console.log(`\n[shutdown] ${signal} received — shutting down gracefully`)
    stopHeartbeat()
    stopFollowUpScheduler()
    server.close(async () => {
      await pool.end().catch(() => {})
      console.log('[shutdown] HTTP server closed')
      process.exit(0)
    })
    // Force exit after 10s if connections don't drain
    setTimeout(() => {
      console.error('[shutdown] Forced exit after timeout')
      process.exit(1)
    }, 10_000).unref()
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))
}

startServer()
