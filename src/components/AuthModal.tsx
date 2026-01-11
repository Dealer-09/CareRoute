"use client"

import React, { useState } from 'react'
import { Button } from './ui/button'
import { X, Mail, Lock, Stethoscope, User, Search } from 'lucide-react'

type AuthMode = 'signin' | 'signup'
type UserType = 'patient' | 'provider'

export interface AuthModalProps {
    isOpen: boolean
    onClose: () => void
    initialUserType?: UserType
    onLogin?: (type: UserType) => void
}

export default function AuthModal({ isOpen, onClose, initialUserType = 'patient', onLogin }: AuthModalProps) {
    const [mode, setMode] = useState<AuthMode>('signin')
    const [userType, setUserType] = useState<UserType>(initialUserType)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    if (!isOpen) return null

    const handleAction = () => {
        // Mock login
        if (onLogin) onLogin(userType)
        // For now just close or redirect
        if (userType === 'patient') window.location.href = '/dashboard'
        if (userType === 'provider') window.location.href = '/clinician'
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">
                        {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
                    </h2>
                    <p className="text-slate-500">
                        {mode === 'signin'
                            ? 'Sign in to continue your care journey'
                            : 'Join CareRoute to get started'}
                    </p>
                </div>

                {/* User Type Toggles */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <button
                        onClick={() => setUserType('patient')}
                        className={`p-4 rounded-xl border-2 transition-all flex items-center space-x-3 ${userType === 'patient'
                                ? 'border-blue-600 bg-blue-50/50'
                                : 'border-slate-100 bg-white hover:border-slate-200'
                            }`}
                    >
                        <div className={`p-2 rounded-lg ${userType === 'patient' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                            <User className={userType === 'patient' ? 'text-blue-600' : 'text-slate-500'} size={24} />
                        </div>
                        <div className="text-left">
                            <div className={`font-bold ${userType === 'patient' ? 'text-blue-900' : 'text-slate-900'}`}>Patient</div>
                            <div className="text-xs text-slate-500">Get care</div>
                        </div>
                    </button>

                    <button
                        onClick={() => setUserType('provider')}
                        className={`p-4 rounded-xl border-2 transition-all flex items-center space-x-3 ${userType === 'provider'
                                ? 'border-blue-600 bg-blue-50/50'
                                : 'border-slate-100 bg-white hover:border-slate-200'
                            }`}
                    >
                        <div className={`p-2 rounded-lg ${userType === 'provider' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                            <Stethoscope className={userType === 'provider' ? 'text-blue-600' : 'text-slate-500'} size={24} />
                        </div>
                        <div className="text-left">
                            <div className={`font-bold ${userType === 'provider' ? 'text-blue-900' : 'text-slate-900'}`}>Provider</div>
                            <div className="text-xs text-slate-500">Manage patients</div>
                        </div>
                    </button>
                </div>

                {/* Form */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-900 mb-2">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="name@example.com"
                                className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-900 mb-2">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all font-medium"
                            />
                        </div>
                    </div>

                    <Button onClick={handleAction} className="w-full h-12 text-lg font-bold rounded-xl bg-blue-600 hover:bg-blue-700">
                        {mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </Button>
                </div>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-slate-500">or continue with</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button className="flex items-center justify-center space-x-2 h-12 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-medium text-slate-700">
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 opacity-75" />
                        <span>Google</span>
                    </button>
                    <button className="flex items-center justify-center space-x-2 h-12 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-medium text-slate-700">
                        <div className="w-5 h-5 bg-[#1877F2] rounded-sm text-white flex items-center justify-center font-bold text-xs">f</div>
                        <span>Facebook</span>
                    </button>
                </div>

                <div className="text-center mt-8">
                    <p className="text-slate-600">
                        {mode === 'signin' ? "Don't have an account?" : "Already have an account?"}{' '}
                        <button
                            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
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
