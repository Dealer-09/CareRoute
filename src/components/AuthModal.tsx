"use client"
import { BACKEND_URL } from '@/lib/api'

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
  const [name, setName] = useState('')
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
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your full name.')
      return false
    }
    return true
  }

  const handleAction = async () => {
    setError(null)
    if (!validate()) return

    setLoading(true)

    const endpoint = mode === 'signin' ? '/api/auth/signin' : '/api/auth/signup'
    
    try {
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          role: userType === 'provider' ? 'doctor' : 'patient',
          name: mode === 'signup' ? name.trim() : undefined,
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed')
      }

      if (!data.token || !data.user) {
        throw new Error('Invalid response from server')
      }

      // Save token
      if (typeof window !== 'undefined') {
        localStorage.setItem('careRouteToken', data.token)
        localStorage.setItem('careRouteUser', JSON.stringify(data.user))
      }

      if (onLogin) onLogin(userType)

      if (data.user.role === 'admin') window.location.href = '/admin'
      else if (data.user.role === 'doctor') window.location.href = '/clinician'
      else window.location.href = '/dashboard'
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
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

          {/* Name — signup only */}
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(null) }}
                  placeholder="Your full name"
                  autoComplete="name"
                  className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                />
              </div>
            </div>
          )}

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
