import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Patient from './pages/Patient'
import Clinician from './pages/Clinician'
import './styles.css'
import './modern-styles.css'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuth = localStorage.getItem('careRouteAuth')
  return isAuth ? <>{children}</> : <Navigate to="/" />
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const hideNavbar = location.pathname === '/' || location.pathname === '/dashboard'

  return (
    <div className="app-root">
      {!hideNavbar && (
        <nav className="navbar">
          <Link to="/" className="brand">CareRoute AI</Link>
          <div className="nav-links">
            <Link to="/patient">Patient</Link>
            <Link to="/clinician">Clinician</Link>
          </div>
        </nav>
      )}
      {children}
      {!hideNavbar && (
        <footer className="footer">
          AI-supported triage only. Not a medical diagnosis. If symptoms are severe or worsening, call 112.
        </footer>
      )}
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/patient" element={<Patient />} />
          <Route path="/clinician" element={<Clinician />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
