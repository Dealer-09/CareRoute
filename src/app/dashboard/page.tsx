"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getHistory } from '@/lib/storage'
import { AnalysisResult } from '@/lib/rules'
import {
    Activity, Clock, FileText, ChevronRight, Home, Stethoscope, Calendar,
    Search, Settings, LayoutDashboard, History, User, LogOut, Menu, X
} from 'lucide-react'

type HistoryItem = AnalysisResult & { timestamp?: number; files?: string[] }

export default function Dashboard() {
    const [history, setHistory] = useState<HistoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [sidebarOpen, setSidebarOpen] = useState(false)

    useEffect(() => {
        setTimeout(() => {
            setHistory(getHistory())
            setLoading(false)
        }, 100)
    }, [])

    const filteredHistory = history.filter(item =>
        item.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.recommendedSpecialty.toLowerCase().includes(searchTerm.toLowerCase())
    )

    interface NavItemProps {
        icon: React.ElementType
        label: string
        active?: boolean
        onClick?: () => void
    }

    const NavItem = ({ icon: Icon, label, active = false, onClick }: NavItemProps) => (
        <button
            onClick={onClick}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${active
                ? 'bg-blue-50 text-blue-700 font-bold'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`}
        >
            <Icon size={20} />
            <span>{label}</span>
        </button>
    )

    return (
        <div className="min-h-screen bg-slate-50 font-sans flex">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transform transition-transform duration-200 lg:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                <div className="h-20 flex items-center px-8 border-b border-slate-100">
                    <Link href="/" className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">C</div>
                        <span className="text-xl font-bold text-slate-900">CareRoute</span>
                    </Link>
                    <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
                        <X className="text-slate-400" />
                    </button>
                </div>

                <div className="p-6 space-y-2">
                    <div className="mb-8">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-4">Menu</div>
                        <div className="space-y-1">
                            <NavItem icon={LayoutDashboard} label="Dashboard" active />
                            <Link href="/patient" className="block"><NavItem icon={Activity} label="New Assessment" /></Link>
                            <NavItem icon={History} label="My History" />
                            <NavItem icon={User} label="My Doctors" />
                        </div>
                    </div>

                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-4">Account</div>
                        <div className="space-y-1">
                            <NavItem icon={Settings} label="Settings" />
                            <Link href="/" className="block"><NavItem icon={LogOut} label="Log Out" /></Link>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 w-full p-6 border-t border-slate-100">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">JD</div>
                        <div>
                            <div className="text-sm font-bold text-slate-900">John Doe</div>
                            <div className="text-xs text-slate-500">Patient</div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8">
                    <div className="flex items-center">
                        <button className="mr-4 lg:hidden" onClick={() => setSidebarOpen(true)}>
                            <Menu className="text-slate-600" />
                        </button>
                        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="relative hidden md:block group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search symptoms..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-64 transition-all"
                            />
                        </div>
                        <Link href="/patient">
                            <Button className="rounded-full shadow-lg shadow-blue-600/20">New Assessment +</Button>
                        </Link>
                    </div>
                </header>

                <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Activity size={24} /></div>
                            <div>
                                <div className="text-2xl font-bold text-slate-900">{history.length}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Assessments</div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><Activity size={24} /></div>
                            <div>
                                <div className="text-2xl font-bold text-slate-900">92</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Health Score</div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                            <div className="p-4 bg-violet-50 text-violet-600 rounded-2xl"><Stethoscope size={24} /></div>
                            <div>
                                <div className="text-2xl font-bold text-slate-900">3</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Active Doctors</div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                            <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl"><Calendar size={24} /></div>
                            <div>
                                <div className="text-lg font-bold text-slate-900">Oct 24</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Next Visit</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-900">Recent History</h2>
                        <div className="flex space-x-2">
                            <select className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none">
                                <option>All Time</option>
                                <option>Past Week</option>
                                <option>Past Month</option>
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-20">
                            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <div className="text-slate-400">Loading your history...</div>
                        </div>
                    ) : filteredHistory.length === 0 ? (
                        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-6">
                                {searchTerm ? <Search size={40} /> : <FileText size={40} />}
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">
                                {searchTerm ? 'No results found' : 'No assessments yet'}
                            </h3>
                            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
                                {searchTerm ? `We couldn't find any assessments matching "${searchTerm}"` : "Start your first symptom assessment to get AI-powered insights and specialist recommendations."}
                            </p>
                            {!searchTerm && (
                                <Link href="/patient">
                                    <Button size="lg" className="rounded-full px-8">Start Assessment</Button>
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredHistory.map((item, i) => (
                                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden">
                                    <div className={`absolute top-0 left-0 w-1.5 h-full ${item.severity === 'Red' ? 'bg-red-500' : item.severity === 'Amber' ? 'bg-amber-500' : 'bg-green-500'
                                        }`} />

                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pl-4">
                                        <div className="flex items-start space-x-4">
                                            <div className={`mt-1 w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm
                                            ${item.severity === 'Red' ? 'bg-red-50 text-red-600'
                                                    : item.severity === 'Amber' ? 'bg-amber-50 text-amber-600'
                                                        : 'bg-green-50 text-green-600'}`}>
                                                {item.severity === 'Red' ? '!' : item.severity === 'Amber' ? '⚠️' : '✓'}
                                            </div>
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h3 className="font-bold text-slate-900 text-lg">{item.recommendedSpecialty}</h3>
                                                    <span className="text-xs font-medium text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full">
                                                        {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'Unknown Date'}
                                                    </span>
                                                </div>
                                                <p className="text-slate-600 line-clamp-2 leading-relaxed">{item.summary}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 pl-16 md:pl-0">
                                            <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide
                                            ${item.severity === 'Red' ? 'bg-red-50 text-red-700'
                                                    : item.severity === 'Amber' ? 'bg-amber-50 text-amber-700'
                                                        : 'bg-green-50 text-green-700'}`}>
                                                {item.severity} Severity
                                            </div>
                                            <Button variant="ghost" size="icon" className="text-slate-300 group-hover:text-blue-600 transition-colors">
                                                <ChevronRight />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
