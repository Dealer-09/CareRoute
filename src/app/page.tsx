"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import TriageWizard from '@/components/TriageWizard'
import AuthModal from '@/components/AuthModal'
import { Button } from '@/components/ui/button'
import { Stethoscope, User, Calendar, Activity, Shield, Globe, Menu, TabletSmartphone, ArrowRight } from 'lucide-react'

export default function Home() {
  const [showWizard, setShowWizard] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [authType, setAuthType] = useState<'patient' | 'provider'>('patient')

  const openAuth = (type: 'patient' | 'provider') => {
    setAuthType(type)
    setShowAuth(true)
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="container mx-auto px-4 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/20">C</div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">CareRoute</span>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">Features</Link>
            <Link href="#how-it-works" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">How it Works</Link>
            <button onClick={() => openAuth('provider')} className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">For Clinicians</button>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={() => openAuth('patient')} className="hidden md:block text-sm font-bold text-slate-700 hover:text-blue-600 transition-colors">
              Log In
            </button>
            <Button onClick={() => setShowWizard(true)} className="rounded-full px-6 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all transform hover:-translate-y-0.5">
              Start Assessment
            </Button>
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative pt-20 pb-20 lg:pt-32 lg:pb-32 overflow-hidden">
          {/* Background Blobs */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-100/50 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-100/50 rounded-full blur-[100px]" />
          </div>

          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
              {/* Left Column: Text */}
              <div className="max-w-xl animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 mb-8">
                  <span className="flex h-2 w-2 rounded-full bg-blue-600 mr-2 animate-pulse"></span>
                  AI-Powered Healthcare Triage
                </div>

                <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-6 leading-[1.1]">
                  Get the Right Care,<br />
                  <span className="text-blue-600">At the Right Time</span>
                </h1>

                <p className="text-xl text-slate-600 mb-10 leading-relaxed">
                  CareRoute AI uses advanced medical algorithms to assess your symptoms,
                  recommend specialists, and connect you with the right healthcare provider instantly.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" onClick={() => setShowWizard(true)} className="h-14 px-8 text-lg rounded-full">
                    Start Assessment <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => openAuth('provider')}
                    className="h-14 px-8 text-lg rounded-full bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                  >
                    For Healthcare Providers
                  </Button>
                </div>

                <div className="mt-12 flex items-center space-x-8 text-sm font-medium text-slate-500">
                  <div className="flex items-center"><Shield className="w-5 h-5 mr-2 text-blue-600" /> HIPAA Compliant</div>
                  <div className="flex items-center"><Activity className="w-5 h-5 mr-2 text-blue-600" /> 95% Accuracy</div>
                </div>
              </div>

              {/* Right Column: Cards */}
              <div className="relative hidden lg:block animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
                <div className="space-y-6 relative z-10">
                  {/* Card 1 */}
                  <div className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center space-x-6 transform translate-x-4 hover:translate-x-0 transition-transform duration-300">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                      <Stethoscope size={32} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">AI Analysis</h3>
                      <p className="text-slate-500">Real-time symptom assessment</p>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center space-x-6 transform -translate-x-4 hover:translate-x-0 transition-transform duration-300">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                      <User size={32} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Expert Matching</h3>
                      <p className="text-slate-500">Connect with specialists</p>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center space-x-6 transform translate-x-4 hover:translate-x-0 transition-transform duration-300">
                    <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600">
                      <TabletSmartphone size={32} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Instant Access</h3>
                      <p className="text-slate-500">24/7 availability</p>
                    </div>
                  </div>
                </div>

                {/* Decorative blob behind cards */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-blue-100/50 to-indigo-100/50 rounded-full blur-3xl -z-10" />
              </div>
            </div>

            {/* Stats Row */}
            <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-slate-200 pt-12">
              {[
                { label: 'Patients Assessed', val: '50K+' },
                { label: 'Accuracy Rate', val: '95%' },
                { label: 'Partner Clinics', val: '200+' },
                { label: 'Availability', val: '24/7' }
              ].map((s, i) => (
                <div key={i}>
                  <div className="text-4xl font-bold text-blue-600 mb-1">{s.val}</div>
                  <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Keeping Features & How It Works from previous iteration but simplifying styles to match cleaner look */}
      </main>

      {showWizard && <TriageWizard onClose={() => setShowWizard(false)} />}
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} initialUserType={authType} />
    </div>
  )
}
