"use client"

import React from 'react'
import Link from 'next/link'
import TriageWizard from '@/components/TriageWizard'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function Patient() {
    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <nav className="bg-white border-b border-slate-200">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">C</div>
                        <span className="text-xl font-bold text-slate-900">CareRoute</span>
                    </Link>
                    <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-blue-600">
                        My Dashboard
                    </Link>
                </div>
            </nav>

            <main className="container mx-auto px-4 py-8">
                <div className="max-w-3xl mx-auto mb-8 flex items-center">
                    <Button variant="ghost" asChild className="mr-4">
                        <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">New Assessment</h1>
                        <p className="text-slate-500 text-sm">Follow the steps below to analyze your symptoms</p>
                    </div>
                </div>

                <TriageWizard variant="inline" onClose={() => window.location.href = '/dashboard'} />
            </main>
        </div>
    )
}
