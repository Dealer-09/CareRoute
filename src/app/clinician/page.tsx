"use client"

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Users, FileText, Calendar, Bell, Search, Settings } from 'lucide-react'

export default function Clinician() {
    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Navbar */}
            <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-8">
                        <Link href="/" className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">C</div>
                            <span className="text-xl font-bold text-slate-900">CareRoute</span>
                        </Link>
                        <div className="hidden md:flex space-x-1">
                            <a href="#" className="px-3 py-2 rounded-md bg-blue-50 text-blue-700 font-medium text-sm">Patients</a>
                            <a href="#" className="px-3 py-2 rounded-md text-slate-600 hover:bg-slate-50 font-medium text-sm">Schedule</a>
                            <a href="#" className="px-3 py-2 rounded-md text-slate-600 hover:bg-slate-50 font-medium text-sm">Analytics</a>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Bell className="text-slate-500 hover:text-slate-700 cursor-pointer" size={20} />
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                        </div>
                        <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
                            Dr
                        </div>
                    </div>
                </div>
            </nav>

            <main className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Patient Queue</h1>
                        <p className="text-slate-500">You have 3 new triage assessments awaiting review</p>
                    </div>
                    <div className="flex space-x-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input type="text" placeholder="Search patients..." className="h-10 pl-9 pr-4 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 w-64 text-sm" />
                        </div>
                        <Button variant="outline"><Settings className="mr-2 h-4 w-4" /> Filter</Button>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-4">Patient</th>
                                <th className="px-6 py-4">Status / Severity</th>
                                <th className="px-6 py-4">Symptoms</th>
                                <th className="px-6 py-4">Time</th>
                                <th className="px-6 py-4">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs mr-3">AS</div>
                                        <div>
                                            <div className="font-medium text-slate-900">Alex Smith</div>
                                            <div className="text-xs text-slate-500">M, 34</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        Red Severity
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm text-slate-600">Chest pain, sweating</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">
                                    10 mins ago
                                </td>
                                <td className="px-6 py-4">
                                    <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700">Review</Button>
                                </td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-xs mr-3">JD</div>
                                        <div>
                                            <div className="font-medium text-slate-900">Jane Doe</div>
                                            <div className="text-xs text-slate-500">F, 28</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                        Amber Severity
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm text-slate-600">Persistent cough, fever</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">
                                    45 mins ago
                                </td>
                                <td className="px-6 py-4">
                                    <Button size="sm" variant="outline">Review</Button>
                                </td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs mr-3">MR</div>
                                        <div>
                                            <div className="font-medium text-slate-900">Mike Ross</div>
                                            <div className="text-xs text-slate-500">M, 42</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Green Severity
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm text-slate-600">Sore throat, mild headache</span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">
                                    2 hrs ago
                                </td>
                                <td className="px-6 py-4">
                                    <Button size="sm" variant="outline">Review</Button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    )
}
