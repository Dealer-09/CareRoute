import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TriageWizard from '../components/TriageWizard'
import { getHistory } from '../utils/storage'

const Dashboard: React.FC = () => {
  const [showWizard, setShowWizard] = useState(false)
  const navigate = useNavigate()
  const history = getHistory()

  const handleLogout = () => {
    localStorage.removeItem('careRouteAuth')
    navigate('/')
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">⚕️ CareRoute</div>
        </div>
        <nav className="sidebar-nav">
          <a href="#" className="nav-item active">
            <span className="nav-icon">📊</span>
            Dashboard
          </a>
          <a href="#" className="nav-item" onClick={() => setShowWizard(true)}>
            <span className="nav-icon">🩺</span>
            New Assessment
          </a>
          <a href="#" className="nav-item">
            <span className="nav-icon">📝</span>
            My History
          </a>
          <a href="#" className="nav-item">
            <span className="nav-icon">👨‍⚕️</span>
            My Doctors
          </a>
          <a href="#" className="nav-item">
            <span className="nav-icon">⚙️</span>
            Settings
          </a>
        </nav>
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">JD</div>
            <div className="user-info">
              <div className="user-name">John Doe</div>
              <div className="user-email">john@email.com</div>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1>Welcome back, John 👋</h1>
            <p className="muted">Here's your health overview</p>
          </div>
          <button className="btn-primary" onClick={() => setShowWizard(true)}>
            <span>➕</span> New Assessment
          </button>
        </header>

        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon green">✓</div>
            <div className="stat-content">
              <div className="stat-label">Total Assessments</div>
              <div className="stat-value">{history.length}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue">👨‍⚕️</div>
            <div className="stat-content">
              <div className="stat-label">Active Doctors</div>
              <div className="stat-value">3</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">📅</div>
            <div className="stat-content">
              <div className="stat-label">Upcoming Appointments</div>
              <div className="stat-value">2</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">📊</div>
            <div className="stat-content">
              <div className="stat-label">Health Score</div>
              <div className="stat-value">85%</div>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <section className="dashboard-section recent-assessments">
            <div className="section-header">
              <h2>Recent Assessments</h2>
              <a href="#" className="link-small">View All</a>
            </div>
            {history.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🩺</div>
                <h3>No assessments yet</h3>
                <p>Start your first symptom assessment to get personalized care recommendations</p>
                <button className="btn-secondary" onClick={() => setShowWizard(true)}>Start Assessment</button>
              </div>
            ) : (
              <div className="assessment-list">
                {history.slice(0, 3).map((h: any, idx: number) => (
                  <div key={idx} className="assessment-item">
                    <div className="assessment-severity">
                      <span className={`badge ${h.severity.toLowerCase()}`}>{h.severity}</span>
                    </div>
                    <div className="assessment-details">
                      <div className="assessment-title">{h.summary}</div>
                      <div className="assessment-meta">
                        <span>{h.recommendedSpecialty}</span>
                        <span>•</span>
                        <span>{new Date(h.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button className="btn-icon-only">→</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-section quick-actions">
            <div className="section-header">
              <h2>Quick Actions</h2>
            </div>
            <div className="action-buttons">
              <button className="action-btn" onClick={() => setShowWizard(true)}>
                <div className="action-icon">🩺</div>
                <div className="action-text">
                  <div className="action-title">Symptom Check</div>
                  <div className="action-subtitle">Start new assessment</div>
                </div>
              </button>
              <button className="action-btn">
                <div className="action-icon">📅</div>
                <div className="action-text">
                  <div className="action-title">Book Appointment</div>
                  <div className="action-subtitle">Schedule with doctor</div>
                </div>
              </button>
              <button className="action-btn">
                <div className="action-icon">💊</div>
                <div className="action-text">
                  <div className="action-title">Prescriptions</div>
                  <div className="action-subtitle">View medications</div>
                </div>
              </button>
              <button className="action-btn">
                <div className="action-icon">📄</div>
                <div className="action-text">
                  <div className="action-title">Lab Results</div>
                  <div className="action-subtitle">Check reports</div>
                </div>
              </button>
            </div>
          </section>
        </div>
      </main>

      {showWizard && <TriageWizard onClose={() => setShowWizard(false)} />}
    </div>
  )
}

export default Dashboard
