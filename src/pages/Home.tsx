import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const Home: React.FC = () => {
  const [showLogin, setShowLogin] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [userRole, setUserRole] = useState<'patient' | 'doctor'>('patient')
  const navigate = useNavigate()

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault()
    // Mock authentication
    localStorage.setItem('careRouteAuth', 'true')
    localStorage.setItem('careRouteRole', userRole)
    if (userRole === 'doctor') {
      navigate('/clinician')
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-dot"></span>
            AI-Powered Healthcare Triage
          </div>
          <h1 className="hero-title">
            Get the Right Care,
            <br />
            <span className="gradient-text">At the Right Time</span>
          </h1>
          <p className="hero-subtitle">
            CareRoute AI uses advanced medical algorithms to assess your symptoms,
            recommend specialists, and connect you with the right healthcare provider instantly.
          </p>
          <div className="hero-actions">
            <button className="btn-primary-large" onClick={() => setShowLogin(true)}>
              Start Assessment
              <span className="btn-icon">→</span>
            </button>
            <button className="btn-secondary-large" onClick={() => navigate('/clinician')}>
              For Healthcare Providers
            </button>
          </div>
          <div className="hero-trust">
            <div className="trust-item">
              <span className="trust-number">50K+</span>
              <span className="trust-label">Patients Assessed</span>
            </div>
            <div className="trust-item">
              <span className="trust-number">95%</span>
              <span className="trust-label">Accuracy Rate</span>
            </div>
            <div className="trust-item">
              <span className="trust-number">200+</span>
              <span className="trust-label">Partner Clinics</span>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-card card-1">
            <div className="card-icon">🩺</div>
            <div className="card-text">
              <div className="card-title">AI Analysis</div>
              <div className="card-subtitle">Real-time symptom assessment</div>
            </div>
          </div>
          <div className="visual-card card-2">
            <div className="card-icon">👨‍⚕️</div>
            <div className="card-text">
              <div className="card-title">Expert Matching</div>
              <div className="card-subtitle">Connect with specialists</div>
            </div>
          </div>
          <div className="visual-card card-3">
            <div className="card-icon">📱</div>
            <div className="card-text">
              <div className="card-title">Instant Access</div>
              <div className="card-subtitle">24/7 availability</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="section-header">
          <h2>Why Choose CareRoute AI?</h2>
          <p>Advanced technology meets compassionate care</p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Accurate Triage</h3>
            <p>Our AI analyzes symptoms using medical guidelines to determine urgency and recommend the right specialist.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Instant Results</h3>
            <p>Get immediate assessment results and specialist recommendations within seconds of completing your input.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Secure & Private</h3>
            <p>Your health data is encrypted and protected. We comply with HIPAA and GDPR regulations.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🌐</div>
            <h3>24/7 Access</h3>
            <p>Access care guidance anytime, anywhere. No appointments needed for initial assessment.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">👥</div>
            <h3>Network of Specialists</h3>
            <p>Connected to 200+ verified healthcare providers across multiple specialties.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Track Your Health</h3>
            <p>Keep a history of assessments and monitor your health journey over time.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="section-header">
          <h2>How It Works</h2>
          <p>Get connected to care in three simple steps</p>
        </div>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Describe Your Symptoms</h3>
              <p>Tell us what you're experiencing in your own words. Our AI understands natural language.</p>
            </div>
          </div>
          <div className="step-connector"></div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Get AI Assessment</h3>
              <p>Receive instant triage results with severity level and recommended specialty.</p>
            </div>
          </div>
          <div className="step-connector"></div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Connect with Specialists</h3>
              <p>Browse matched healthcare providers and book appointments or consult immediately.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to Get Started?</h2>
          <p>Join thousands of patients who trust CareRoute AI for their healthcare needs</p>
          <button className="btn-cta" onClick={() => setShowLogin(true)}>
            Begin Your Assessment
            <span className="btn-icon">→</span>
          </button>
        </div>
      </section>

      {/* Login/Signup Modal */}
      {showLogin && (
        <div className="modal-overlay" onClick={() => setShowLogin(false)}>
          <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowLogin(false)}>×</button>
            <div className="auth-header">
              <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
              <p>{isLogin ? 'Sign in to continue your care journey' : 'Join thousands of patients today'}</p>
            </div>

            {/* Role Selection */}
            <div className="role-selection">
              <button 
                type="button"
                className={`role-btn ${userRole === 'patient' ? 'active' : ''}`}
                onClick={() => setUserRole('patient')}
              >
                <span className="role-icon">🏥</span>
                <div>
                  <div className="role-title">Patient</div>
                  <div className="role-desc">Get care and assessments</div>
                </div>
              </button>
              <button 
                type="button"
                className={`role-btn ${userRole === 'doctor' ? 'active' : ''}`}
                onClick={() => setUserRole('doctor')}
              >
                <span className="role-icon">👨‍⚕️</span>
                <div>
                  <div className="role-title">Healthcare Provider</div>
                  <div className="role-desc">Manage patients</div>
                </div>
              </button>
            </div>

            <form onSubmit={handleAuth} className="auth-form">
              {!isLogin && (
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" placeholder="John Doe" required />
                </div>
              )}
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" placeholder="your@email.com" required />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" placeholder="••••••••" required />
              </div>
              {!isLogin && (
                <div className="form-group checkbox-group">
                  <input type="checkbox" id="terms" required />
                  <label htmlFor="terms">I agree to the Terms of Service and Privacy Policy</label>
                </div>
              )}
              <button type="submit" className="btn-auth">
                {isLogin ? 'Sign In' : 'Create Account'}
              </button>
            </form>
            <div className="auth-divider">
              <span>or continue with</span>
            </div>
            <div className="auth-social">
              <button className="btn-social">
                <span>🔍</span> Google
              </button>
              <button className="btn-social">
                <span>📘</span> Facebook
              </button>
            </div>
            <div className="auth-switch">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button type="button" onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
