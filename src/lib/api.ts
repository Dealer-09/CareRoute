/**
 * Central backend URL helper.
 * Set NEXT_PUBLIC_BACKEND_URL in .env.local for production deployments.
 * Falls back to localhost:4000 for local development.
 */
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000'

if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_BACKEND_URL) {
  console.warn('⚠️ WARNING: NEXT_PUBLIC_BACKEND_URL is not set in production! Defaulting to localhost:4000')
}
