"use client"
import { BACKEND_URL } from '@/lib/api'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Users, Activity, FileText, CalendarDays, AlertTriangle,
  ShieldCheck, Search, ChevronDown, Trash2, Loader2,
  LayoutDashboard, ScrollText, UserCog, RefreshCw,
} from 'lucide-react'
import { timeAgo } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Stats = {
  users: number; triage: number; documents: number
  appointments: number; emergencies: number
  by_severity: { Green: number; Amber: number; Red: number }
}

type User = {
  id: string; email: string; role: string
  patient_name: string | null; triage_count: string; created_at: string
}

type AuditEntry = {
  id: string; action: string; entity_type: string | null
  payload: unknown; created_at: string
  user_email: string | null; user_role: string | null
}

type RecentCase = {
  id: string; severity: string; emergency: boolean
  condition_guess: string; summary: string
  reviewed: boolean; created_at: string; patient_name: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roleColor(role: string) {
  if (role === 'admin')  return 'bg-purple-100 text-purple-700 border border-purple-200'
  if (role === 'doctor') return 'bg-blue-100 text-blue-700 border border-blue-200'
  return 'bg-slate-100 text-slate-600 border border-slate-200'
}

function severityColor(s: string) {
  if (s === 'Red')   return 'bg-red-100 text-red-700 border border-red-200'
  if (s === 'Amber') return 'bg-amber-100 text-amber-700 border border-amber-200'
  return 'bg-green-100 text-green-700 border border-green-200'
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</div>
        <div className="text-xs text-slate-500 font-medium mt-0.5">{label}</div>
      </div>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'users' | 'audit'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const router  = useRouter()
  const [tab,   setTab]   = useState<Tab>('overview')
  const [ready, setReady] = useState(false)
  const token = typeof window !== 'undefined' ? localStorage.getItem('careRouteToken') : null

  // ── Auth guard ──
  useEffect(() => {
    const raw = localStorage.getItem('careRouteUser')
    if (!raw || !token) { router.replace('/'); return }
    try {
      const u = JSON.parse(raw)
      if (u.role !== 'admin') { router.replace('/'); return }
      setReady(true)
    } catch { router.replace('/') }
  }, [router, token])

  // ── Stats ──
  const [stats,      setStats]      = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // ── Users ──
  const [users,        setUsers]       = useState<User[]>([])
  const [usersTotal,   setUsersTotal]  = useState(0)
  const [userSearch,   setUserSearch]  = useState('')
  const [usersLoading, setUsersLoading]= useState(false)
  const [roleChanging, setRoleChanging]= useState<string | null>(null)
  const [deleting,     setDeleting]    = useState<string | null>(null)

  // ── Audit ──
  const [audit,         setAudit]        = useState<AuditEntry[]>([])
  const [auditLoading,  setAuditLoading] = useState(false)
  const [auditFilter,   setAuditFilter]  = useState('')

  // ── Recent cases ──
  const [recent,        setRecent]       = useState<RecentCase[]>([])

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const res = await fetch(`${BACKEND_URL}/api/admin${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }, [token])

  // Load stats + recent on mount
  useEffect(() => {
    if (!ready) return
    setStatsLoading(true)
    Promise.all([api('/stats'), api('/triage/recent')])
      .then(([s, r]) => { setStats(s); setRecent(r.cases) })
      .catch(console.error)
      .finally(() => setStatsLoading(false))
  }, [ready, api])

  // Load users when tab selected or search changes
  useEffect(() => {
    if (!ready || tab !== 'users') return
    setUsersLoading(true)
    api(`/users?search=${encodeURIComponent(userSearch)}&limit=50`)
      .then(d => { setUsers(d.users); setUsersTotal(d.total) })
      .catch(console.error)
      .finally(() => setUsersLoading(false))
  }, [ready, tab, userSearch, api])

  // Load audit when tab selected or filter changes
  useEffect(() => {
    if (!ready || tab !== 'audit') return
    setAuditLoading(true)
    api(`/audit?action=${encodeURIComponent(auditFilter)}&limit=100`)
      .then(d => setAudit(d.audit))
      .catch(console.error)
      .finally(() => setAuditLoading(false))
  }, [ready, tab, auditFilter, api])

  async function changeRole(userId: string, newRole: string) {
    setRoleChanging(userId)
    try {
      const updated = await api(`/users/${userId}/role`, {
        method: 'PATCH', body: JSON.stringify({ role: newRole }),
      })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: updated.role } : u))
    } catch (e) { alert('Failed to change role') }
    finally { setRoleChanging(null) }
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`Permanently delete ${email}? This cannot be undone.`)) return
    setDeleting(userId)
    try {
      await api(`/users/${userId}`, { method: 'DELETE' })
      setUsers(prev => prev.filter(u => u.id !== userId))
      setUsersTotal(t => t - 1)
    } catch { alert('Failed to delete user') }
    finally { setDeleting(null) }
  }

  if (!ready) return null

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">C</div>
            <span className="font-bold text-slate-900">CareRoute</span>
          </Link>
          <div className="h-4 w-px bg-slate-200 mx-1" />
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={16} className="text-purple-600" />
            <span className="font-semibold text-slate-800 text-sm">Admin Panel</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/dashboard" className="text-xs text-slate-500 hover:text-slate-800 transition-colors">Dashboard</Link>
            <button
              onClick={() => { localStorage.removeItem('careRouteToken'); localStorage.removeItem('careRouteUser'); router.push('/') }}
              className="text-xs text-slate-500 hover:text-red-600 transition-colors"
            >Log Out</button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-7xl">

        {/* Tab bar */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-8 w-fit">
          {([
            { id: 'overview', label: 'Overview',     icon: LayoutDashboard },
            { id: 'users',    label: 'Users',         icon: UserCog },
            { id: 'audit',    label: 'Audit Log',     icon: ScrollText },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {/* ─── Overview ─────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-8">
            {statsLoading ? (
              <div className="flex items-center gap-2 text-slate-400"><Loader2 size={18} className="animate-spin" /> Loading stats…</div>
            ) : stats ? (
              <>
                {/* Stats grid */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <StatCard label="Total Users"    value={stats.users}        icon={Users}        color="bg-blue-50 text-blue-600" />
                  <StatCard label="Triage Cases"   value={stats.triage}       icon={Activity}     color="bg-indigo-50 text-indigo-600" />
                  <StatCard label="Documents"      value={stats.documents}    icon={FileText}     color="bg-emerald-50 text-emerald-600" />
                  <StatCard label="Appointments"   value={stats.appointments} icon={CalendarDays} color="bg-amber-50 text-amber-600" />
                  <StatCard label="Emergencies"    value={stats.emergencies}  icon={AlertTriangle}color="bg-red-50 text-red-600" />
                </div>

                {/* Severity breakdown */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <h2 className="font-bold text-slate-800 mb-4">Triage by Severity</h2>
                  <div className="flex gap-4">
                    {(['Green','Amber','Red'] as const).map(s => {
                      const count = stats.by_severity[s]
                      const pct   = stats.triage ? Math.round((count / stats.triage) * 100) : 0
                      return (
                        <div key={s} className="flex-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${severityColor(s)}`}>{s}</span>
                            <span className="text-sm font-bold text-slate-700">{count}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${s === 'Red' ? 'bg-red-500' : s === 'Amber' ? 'bg-amber-400' : 'bg-green-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-xs text-slate-400 mt-1 text-right">{pct}%</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Recent critical cases */}
                {recent.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <AlertTriangle size={16} className="text-red-500" /> Recent Red / Emergency Cases
                    </h2>
                    <div className="space-y-2">
                      {recent.map(c => (
                        <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${severityColor(c.severity)}`}>
                            {c.emergency ? '🚨' : '🔴'} {c.severity}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-800">{c.patient_name}</span>
                              <span className="text-xs text-slate-400">{timeAgo(c.created_at)}</span>
                              {c.reviewed && <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Reviewed</span>}
                            </div>
                            <p className="text-sm text-slate-600 truncate">{c.condition_guess} — {c.summary}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ─── Users ────────────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-slate-800">Users</h2>
                <p className="text-xs text-slate-400 mt-0.5">{usersTotal} total</p>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search by email…"
                  className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
                />
              </div>
            </div>

            {usersLoading ? (
              <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
                <Loader2 size={18} className="animate-spin" /> Loading…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-3 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Email</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Name</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Cases</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Joined</th>
                      <th className="text-left px-3 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-3 font-medium text-slate-800 truncate max-w-[200px]">{u.email}</td>
                        <td className="px-3 py-3 text-slate-500">{u.patient_name || '—'}</td>
                        <td className="px-3 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleColor(u.role)}`}>{u.role}</span>
                        </td>
                        <td className="px-3 py-3 text-slate-500">{u.triage_count}</td>
                        <td className="px-3 py-3 text-slate-400 text-xs">{timeAgo(u.created_at)}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            {/* Role selector */}
                            <div className="relative">
                              <select
                                value={u.role}
                                disabled={roleChanging === u.id}
                                onChange={e => changeRole(u.id, e.target.value)}
                                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 pr-6 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer"
                              >
                                <option value="patient">patient</option>
                                <option value="doctor">doctor</option>
                                <option value="admin">admin</option>
                              </select>
                              {roleChanging === u.id
                                ? <Loader2 size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />
                                : <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                              }
                            </div>
                            {/* Delete */}
                            <button
                              onClick={() => deleteUser(u.id, u.email)}
                              disabled={deleting === u.id}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                              title="Delete user"
                            >
                              {deleting === u.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── Audit Log ────────────────────────────────────────────────────── */}
        {tab === 'audit' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-800">Audit Log</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={auditFilter}
                    onChange={e => setAuditFilter(e.target.value)}
                    placeholder="Filter by action…"
                    className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                  />
                </div>
                <button
                  onClick={() => setAuditFilter('')}
                  className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            {auditLoading ? (
              <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
                <Loader2 size={18} className="animate-spin" /> Loading…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-3 py-3 font-bold text-slate-400 uppercase tracking-wider">When</th>
                      <th className="text-left px-3 py-3 font-bold text-slate-400 uppercase tracking-wider">User</th>
                      <th className="text-left px-3 py-3 font-bold text-slate-400 uppercase tracking-wider">Action</th>
                      <th className="text-left px-3 py-3 font-bold text-slate-400 uppercase tracking-wider">Entity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map(e => (
                      <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{timeAgo(e.created_at)}</td>
                        <td className="px-3 py-2.5">
                          <div className="text-slate-700 font-medium truncate max-w-[160px]">{e.user_email ?? 'system'}</div>
                          {e.user_role && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${roleColor(e.user_role)}`}>{e.user_role}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-mono">{e.action}</code>
                        </td>
                        <td className="px-3 py-2.5 text-slate-400">{e.entity_type ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {audit.length === 0 && (
                  <p className="text-center text-slate-400 py-8 text-sm">No audit entries found</p>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
