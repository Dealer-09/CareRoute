"use client"
import { BACKEND_URL } from '@/lib/api'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  User,
  Save,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Users,
  Plus,
  Trash2,
} from 'lucide-react'

type Profile = {
  id: string
  name: string
  date_of_birth: string | null
  gender: 'M' | 'F' | 'Other' | null
  phone: string | null
  email: string
  role: string
}

type Dependent = {
  id: string
  name: string
  date_of_birth: string | null
  gender: 'M' | 'F' | 'Other' | null
  relationship: string
}

type Status = 'idle' | 'saving' | 'saved' | 'error'

export default function ProfilePage() {
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [name, setName]         = useState('')
  const [dob, setDob]           = useState('')
  const [gender, setGender]     = useState<'M' | 'F' | 'Other' | ''>('')
  const [phone, setPhone]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [status, setStatus]     = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const [dependents,  setDependents]  = useState<Dependent[]>([])
  const [depName,     setDepName]     = useState('')
  const [depDob,      setDepDob]      = useState('')
  const [depGender,   setDepGender]   = useState<'M' | 'F' | 'Other' | ''>('')
  const [depRelation, setDepRelation] = useState('')
  const [addingDep,   setAddingDep]   = useState(false)
  const [depStatus,   setDepStatus]   = useState<'idle' | 'saving' | 'error'>('idle')

  async function fetchDependents(token: string) {
    try {
      const r = await fetch(`${BACKEND_URL}/api/dependents`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const d = await r.json()
      if (d.dependents) setDependents(d.dependents)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    async function loadProfile() {
      const token = localStorage.getItem('careRouteToken')
      if (!token) { window.location.href = '/'; return }
      try {
        const res = await fetch(`${BACKEND_URL}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to load profile')
        const data: Profile = await res.json()
        setProfile(data)
        setName(data.name || '')
        setDob(data.date_of_birth ? data.date_of_birth.split('T')[0] : '')
        setGender(data.gender || '')
        setPhone(data.phone || '')
        fetchDependents(token)
      } catch {
        setErrorMsg('Could not load your profile. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const token = localStorage.getItem('careRouteToken')
    if (!token) return
    setStatus('saving'); setErrorMsg('')
    try {
      const body: Record<string, string> = {}
      if (name.trim()) body.name = name.trim()
      if (dob) body.date_of_birth = dob
      if (gender) body.gender = gender
      if (phone.trim()) body.phone = phone.trim()

      const res = await fetch(`${BACKEND_URL}/api/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Update failed') }
      const updated: Profile = await res.json()
      setProfile(prev => prev ? { ...prev, ...updated } : prev)
      const storedUser = localStorage.getItem('careRouteUser')
      if (storedUser) {
        const user = JSON.parse(storedUser)
        localStorage.setItem('careRouteUser', JSON.stringify({ ...user, name: updated.name }))
      }
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Update failed')
      setStatus('error')
    }
  }

  async function addDependent() {
    if (!depName.trim() || !depRelation.trim()) return
    setDepStatus('saving')
    const token = localStorage.getItem('careRouteToken') ?? ''
    const r = await fetch(`${BACKEND_URL}/api/dependents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: depName,
        date_of_birth: depDob || null,
        gender: depGender || null,
        relationship: depRelation,
      }),
    })
    if (r.ok) {
      await fetchDependents(token)
      setDepName(''); setDepDob(''); setDepGender(''); setDepRelation('')
      setAddingDep(false); setDepStatus('idle')
    } else {
      setDepStatus('error')
    }
  }

  async function removeDependent(id: string) {
    const token = localStorage.getItem('careRouteToken') ?? ''
    await fetch(`${BACKEND_URL}/api/dependents/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setDependents(prev => prev.filter(d => d.id !== id))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* Header */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">C</div>
            <span className="text-lg font-bold text-slate-900">CareRoute</span>
          </div>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600 font-medium text-sm">My Profile</span>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-10 max-w-2xl space-y-6">

        {/* Page header */}
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl uppercase">
            {name.charAt(0) || profile?.email?.charAt(0) || '?'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{name || 'Your Profile'}</h1>
            <p className="text-slate-500 text-sm">{profile?.email}</p>
          </div>
        </div>

        {/* Profile form */}
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">

          <div className="flex items-center gap-2 mb-2">
            <User size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800">Personal Information</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="name">Full Name</label>
            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Archisman Roy"
              className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white transition" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="dob">Date of Birth</label>
            <input id="dob" type="date" value={dob} onChange={e => setDob(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white transition" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="phone">Phone Number</label>
            <input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white transition" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Gender</label>
            <div className="flex gap-3">
              {(['M', 'F', 'Other'] as const).map(g => (
                <button key={g} type="button" onClick={() => setGender(g)}
                  className={`flex-1 h-11 rounded-xl border text-sm font-medium transition-all ${
                    gender === g
                      ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}>
                  {g === 'M' ? 'Male' : g === 'F' ? 'Female' : 'Other'}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Account</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Email</p>
                <p className="text-sm font-medium text-slate-700">{profile?.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Role</p>
                <p className="text-sm font-medium text-slate-700 capitalize">{profile?.role}</p>
              </div>
            </div>
          </div>

          {status === 'saved' && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
              <CheckCircle size={16} /> Profile saved successfully.
            </div>
          )}
          {status === 'error' && errorMsg && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}

          <Button type="submit" disabled={status === 'saving'} className="w-full h-11 gap-2">
            {status === 'saving'
              ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
              : <><Save size={16} /> Save Profile</>}
          </Button>
        </form>

        {/* ─── Dependents ─── */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <h2 className="font-semibold text-slate-800">Dependent Profiles</h2>
            </div>
            <button onClick={() => setAddingDep(v => !v)}
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition">
              <Plus size={14} /> Add
            </button>
          </div>

          {dependents.length === 0 && !addingDep && (
            <p className="text-sm text-slate-400 text-center py-4">
              No dependents yet. Add a child or family member to triage on their behalf.
            </p>
          )}

          <ul className="space-y-2 mb-3">
            {dependents.map(dep => (
              <li key={dep.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{dep.name}</p>
                  <p className="text-xs text-slate-500">
                    {dep.relationship}
                    {dep.date_of_birth
                      ? ` • ${new Date(dep.date_of_birth).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}`
                      : ''}
                  </p>
                </div>
                <button onClick={() => removeDependent(dep.id)} className="text-slate-300 hover:text-red-500 transition p-1">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>

          {addingDep && (
            <div className="space-y-3 border border-blue-100 bg-blue-50 rounded-xl p-4">
              <input value={depName} onChange={e => setDepName(e.target.value)}
                placeholder="Full name *"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-2">
                <input value={depDob} onChange={e => setDepDob(e.target.value)} type="date"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={depGender} onChange={e => setDepGender(e.target.value as 'M' | 'F' | 'Other' | '')}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Gender</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <input value={depRelation} onChange={e => setDepRelation(e.target.value)}
                placeholder="Relationship (e.g. Son, Mother) *"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <Button onClick={addDependent} disabled={depStatus === 'saving'} className="w-full gap-2" size="sm">
                {depStatus === 'saving'
                  ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                  : <><Plus size={14} /> Save Dependent</>}
              </Button>
              {depStatus === 'error' && <p className="text-xs text-red-600">Failed to save. Please try again.</p>}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-slate-400 mt-2">
          Your data is encrypted and stored securely. It is only used to improve your care routing.
        </p>
      </main>
    </div>
  )
}
