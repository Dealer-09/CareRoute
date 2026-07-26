"use client"
import { BACKEND_URL } from '@/lib/api'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getHistory } from '@/lib/storage'
import type { TriageResult } from '@/types/triage'
import DocumentManager from '@/components/DocumentManager'
import {
  Activity,
  FileText,
  ChevronRight,
  Search,
  Settings,
  LayoutDashboard,
  History,
  CalendarDays,
  User,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react'

// ─── Sidebar Nav Item ─────────────────────────────────────────────────────────

interface NavItemProps {
  icon: React.ElementType
  label: string
  active?: boolean
  onClick?: () => void
}

const NavItem = ({ icon: Icon, label, active = false, onClick }: NavItemProps) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
      active
        ? 'bg-blue-50 text-blue-700 font-bold'
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
    }`}
  >
    <Icon size={19} />
    <span className="text-sm">{label}</span>
  </button>
)

// ─── Severity helpers ─────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: TriageResult['severity'] }) {
  if (severity === 'Red') return <AlertTriangle size={22} className="text-red-500" />
  if (severity === 'Amber') return <AlertCircle size={22} className="text-amber-500" />
  return <CheckCircle size={22} className="text-green-500" />
}

function severityBadgeClass(severity: TriageResult['severity']) {
  if (severity === 'Red') return 'bg-red-50 text-red-700 border-red-200'
  if (severity === 'Amber') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-green-50 text-green-700 border-green-200'
}

function severityBarClass(severity: TriageResult['severity']) {
  if (severity === 'Red') return 'bg-red-500'
  if (severity === 'Amber') return 'bg-amber-500'
  return 'bg-green-500'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [history, setHistory] = useState<TriageResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<{ id: string, email: string, role: string } | null>(null)

  useEffect(() => {
    async function loadData() {
      const token = localStorage.getItem('careRouteToken')
      const storedUser = localStorage.getItem('careRouteUser')
      
      if (storedUser) {
        setUser(JSON.parse(storedUser))
      }

      if (token) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/triage/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (res.ok) {
            const data = await res.json()
            setHistory(data.history)
            setLoading(false)
            return
          }
        } catch (e) {
          console.error('Failed to load DB history', e)
        }
      }
      
      // Fallback to local storage
      setHistory(getHistory())
      setLoading(false)
    }
    
    // Small delay to avoid hydration mismatch
    const t = setTimeout(loadData, 80)
    return () => clearTimeout(t)
  }, [])

  const filteredHistory = history.filter(
    item =>
      item.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.recommended_specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.condition_guess.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Real counts from actual history
  const redCount = history.filter(h => h.severity === 'Red').length
  const amberCount = history.filter(h => h.severity === 'Amber').length

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-68 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ width: '17rem' }}
      >
        {/* Logo */}
        <div className="h-20 flex items-center px-7 border-b border-slate-100 shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
              C
            </div>
            <span className="text-xl font-bold text-slate-900">CareRoute</span>
          </Link>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Nav */}
        <div className="flex-1 p-4 space-y-6 overflow-y-auto">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-3">
              Menu
            </div>
            <div className="space-y-1">
              <NavItem icon={LayoutDashboard} label="Dashboard" active />
              <Link href="/patient" className="block">
                <NavItem icon={Activity} label="New Assessment" />
              </Link>
              <Link href="/timeline" className="block">
                <NavItem icon={TrendingUp} label="Symptom Timeline" />
              </Link>
              <NavItem icon={History} label="My History" />
              <NavItem icon={User} label="My Doctors" />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-3">
              Account
            </div>
            <div className="space-y-1">
              <Link href="/profile" className="block">
                <NavItem icon={Settings} label="My Profile" />
              </Link>
              <Link href="/appointments" className="block">
                <NavItem icon={CalendarDays} label="My Appointments" />
              </Link>
              <Link 
                href="/" 
                className="block"
                onClick={() => {
                  localStorage.removeItem('careRouteToken')
                  localStorage.removeItem('careRouteUser')
                }}
              >
                <NavItem icon={LogOut} label="Log Out" />
              </Link>
            </div>
          </div>
        </div>

        {/* User footer */}
        <div className="p-5 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm uppercase">
              {user ? user.email.charAt(0) : '?'}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-slate-800 truncate">
                {user ? user.email : 'Guest User'}
              </div>
              <div className="text-xs text-slate-400">
                {user ? 'Logged in' : 'Sign in to save progress'}
              </div>
            </div>

          {user?.role === 'admin' && (
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-3">
                Admin
              </div>
              <div className="space-y-1">
                <Link href="/admin" className="block">
                  <NavItem icon={ShieldCheck} label="Admin Panel" />
                </Link>
              </div>
            </div>
          )}          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu size={22} className="text-slate-600" />
            </button>
            <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search assessments…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-60 text-sm transition-all"
              />
            </div>
            <Link href="/patient">
              <Button id="new-assessment-btn" className="rounded-full shadow-sm shadow-blue-600/20">
                New Assessment +
              </Button>
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">

          {/* Stats — only real data, no fake numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
                <Activity size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{history.length}</div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-0.5">
                  Total Assessments
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-2xl shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{redCount}</div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-0.5">
                  Red Severity
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                <AlertCircle size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{amberCount}</div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-0.5">
                  Amber Severity
                </div>
              </div>
            </div>
          </div>

          {/* History section */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-slate-900">Assessment History</h2>
            <span className="text-xs text-slate-400">Last 10 saved locally</span>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
              <div className="text-slate-400 text-sm">Loading your history…</div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-14 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-5">
                {searchTerm ? <Search size={36} /> : <FileText size={36} />}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {searchTerm ? 'No results found' : 'No assessments yet'}
              </h3>
              <p className="text-slate-500 text-sm mb-7 max-w-sm mx-auto">
                {searchTerm
                  ? `No assessments match "${searchTerm}"`
                  : 'Start your first symptom assessment to get AI-powered triage and specialist recommendations.'}
              </p>
              {!searchTerm && (
                <Link href="/patient">
                  <Button size="lg" className="rounded-full px-8">
                    Start Assessment
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item, i) => {
                const specialty = item.recommended_specialty
                return (
                  <div
                    key={i}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
                  >
                    {/* Severity bar */}
                    <div
                      className={`absolute top-0 left-0 w-1.5 h-full ${severityBarClass(item.severity)}`}
                    />

                    <div className="pl-6 pr-5 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 shrink-0">
                          <SeverityIcon severity={item.severity} />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-bold text-slate-900">
                              {item.condition_guess ?? specialty}
                            </h3>
                            {item.timestamp && (
                              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                {new Date(item.timestamp).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed">
                            {item.summary}
                          </p>
                          <div className="text-xs text-slate-400 mt-1.5 font-medium">
                            → {specialty}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pl-7 md:pl-0 shrink-0">
                        <span
                          className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${severityBadgeClass(item.severity)}`}
                        >
                          {item.severity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-300 group-hover:text-blue-600 transition-colors"
                        >
                          <ChevronRight size={18} />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Documents */}
          <div className="mt-8">
            <DocumentManager />
          </div>
        </main>
      </div>
    </div>
  )
}
