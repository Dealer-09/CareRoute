"use client"

import React, { useState } from 'react'
import { Button } from './ui/button'
import { X, Mail, Lock, Stethoscope, User, Loader2, AlertCircle } from 'lucide-react'

type AuthMode = 'signin' | 'signup'
type UserType = 'patient' | 'provider'

export interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialUserType?: UserType
  onLogin?: (type: UserType) => void
}

export default function AuthModal({
  isOpen,
  onClose,
  initialUserType = 'patient',
  onLogin,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [userType, setUserType] = useState<UserType>(initialUserType)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  // Validation
  const validate = () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return false
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return false
    }
    return true
  }

  const handleAction = async () => {
    setError(null)
    if (!validate()) return

    setLoading(true)

    // TODO (Phase 0): Replace this mock with a real POST /api/auth/signin|signup call.
    // For now, any valid-format email/password proceeds.
    await new Promise(resolve => setTimeout(resolve, 600)) // simulate network

    if (onLogin) onLogin(userType)

    if (userType === 'patient') window.location.href = '/dashboard'
    if (userType === 'provider') window.location.href = '/clinician'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAction()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="text-center mb-7">
          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-slate-500 text-sm">
            {mode === 'signin'
              ? 'Sign in to continue your care journey'
              : 'Join CareRoute to get started'}
          </p>
        </div>

        {/* User type toggle */}
        <div className="grid grid-cols-2 gap-3 mb-7">
          {(['patient', 'provider'] as UserType[]).map(type => (
            <button
              key={type}
              id={`user-type-${type}`}
              onClick={() => setUserType(type)}
              className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${
                userType === type
                  ? 'border-blue-600 bg-blue-50/60'
                  : 'border-slate-100 bg-white hover:border-slate-200'
              }`}
            >
              <div
                className={`p-2 rounded-xl ${
                  userType === type ? 'bg-blue-100' : 'bg-slate-100'
                }`}
              >
                {type === 'patient' ? (
                  <User
                    size={20}
                    className={userType === type ? 'text-blue-600' : 'text-slate-500'}
                  />
                ) : (
                  <Stethoscope
                    size={20}
                    className={userType === type ? 'text-blue-600' : 'text-slate-500'}
                  />
                )}
              </div>
              <div className="text-left">
                <div
                  className={`font-bold text-sm ${
                    userType === type ? 'text-blue-900' : 'text-slate-900'
                  }`}
                >
                  {type === 'patient' ? 'Patient' : 'Provider'}
                </div>
                <div className="text-xs text-slate-500">
                  {type === 'patient' ? 'Get care' : 'Manage patients'}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null) }}
                placeholder="name@example.com"
                autoComplete="email"
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null) }}
                placeholder="••••••••"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <Button
            id="auth-submit-btn"
            onClick={handleAction}
            disabled={loading}
            className="w-full h-12 text-sm font-bold rounded-xl"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
              </span>
            ) : (
              mode === 'signin' ? 'Sign In' : 'Create Account'
            )}
          </Button>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-white text-slate-400">or continue with</span>
          </div>
        </div>

        {/* Social — placeholder, not wired up */}
        <div className="grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 h-11 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
          <button className="flex items-center justify-center gap-2 h-11 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700">
            <div className="w-5 h-5 bg-[#1877F2] rounded flex items-center justify-center text-white font-bold text-xs">
              f
            </div>
            Facebook
          </button>
        </div>

        {/* Toggle mode */}
        <div className="text-center mt-6">
          <p className="text-slate-500 text-sm">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
              className="text-blue-600 font-bold hover:underline"
            >
              {mode === 'signin' ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
