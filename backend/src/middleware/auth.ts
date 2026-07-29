import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: { id: string; role: string }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('JWT_SECRET is missing')
    return res.status(500).json({ error: 'Internal server error' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, secret) as { id: string; role: string }
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/** Middleware: requires the authenticated user to have the 'admin' role. */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

/** Middleware: requires the authenticated user to have 'doctor' or 'admin' role. */
export function requireClinician(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'doctor' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Clinician access required' })
  }
  next()
}
