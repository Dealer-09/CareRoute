import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { runMigrations } from './db/migrate'
import healthRoutes from './routes/health'
import authRoutes from './routes/auth'
import triageRoutes from './routes/triage'
import profileRoutes from './routes/profile'
import documentRoutes from './routes/documents'
import mapsRoutes from './routes/maps'
import appointmentRoutes from './routes/appointments'

dotenv.config({ path: '../.env.local' })

const app = express()
const PORT = process.env.PORT || 4000

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/triage', triageRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/maps', mapsRoutes)
app.use('/api/doctors', appointmentRoutes)      // GET /api/doctors, GET /api/doctors/:id/slots
app.use('/api/appointments', appointmentRoutes)  // GET|POST|PATCH /api/appointments


async function startServer() {
  console.log('🚀 Starting CareRoute backend...')
  
  // Run schema setup before accepting requests
  await runMigrations()

  app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`)
  })
}

startServer()
