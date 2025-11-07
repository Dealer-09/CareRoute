import React from 'react'
import { getHistory } from '../utils/storage'
import { AnalysisResult } from '../rules'

const Clinician: React.FC = () => {
  const history = getHistory()

  return (
    <div className="clinician-page">
      <div className="clinician-header">
        <div className="header-content">
          <h1>Clinician Portal</h1>
          <p className="muted">Manage patient assessments and triage results</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary">
            <span>📊</span> Export Data
          </button>
          <button className="btn-primary">
            <span>➕</span> Add Patient
          </button>
        </div>
      </div>

      <div className="clinician-stats">
        <div className="stat-card">
          <div className="stat-icon red">🚨</div>
          <div className="stat-content">
            <div className="stat-label">Critical Cases</div>
            <div className="stat-value">{history.filter(h => h.severity === 'Red').length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">⚠️</div>
          <div className="stat-content">
            <div className="stat-label">Moderate Cases</div>
            <div className="stat-value">{history.filter(h => h.severity === 'Amber').length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✓</div>
          <div className="stat-content">
            <div className="stat-label">Low Priority</div>
            <div className="stat-value">{history.filter(h => h.severity === 'Green').length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">📋</div>
          <div className="stat-content">
            <div className="stat-label">Total Assessments</div>
            <div className="stat-value">{history.length}</div>
          </div>
        </div>
      </div>

      <div className="clinician-main">
        <div className="section-card">
          <div className="section-header">
            <h2>Recent Patient Assessments</h2>
            <div className="filter-buttons">
              <button className="filter-btn active">All</button>
              <button className="filter-btn">Critical</button>
              <button className="filter-btn">Today</button>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🩺</div>
              <h3>No Patient Assessments</h3>
              <p>Patient triage data will appear here once assessments are completed</p>
            </div>
          ) : (
            <div className="patient-list">
              {history.map((h: AnalysisResult & { timestamp?: number }, idx: number) => (
                <div key={idx} className="patient-card">
                  <div className="patient-header">
                    <div className="patient-info">
                      <div className="patient-id">Patient #{String(idx + 1).padStart(4, '0')}</div>
                      <div className="patient-time">
                        {new Date(h.timestamp || Date.now()).toLocaleString()}
                      </div>
                    </div>
                    <span className={`badge ${h.severity.toLowerCase()}`}>{h.severity}</span>
                  </div>

                  <div className="patient-details">
                    <div className="detail-row">
                      <span className="detail-label">Chief Complaint:</span>
                      <span className="detail-value">{h.summary}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Recommended:</span>
                      <span className="detail-value specialty">{h.recommendedSpecialty}</span>
                    </div>
                    {h.redFlags && h.redFlags.length > 0 && (
                      <div className="detail-row">
                        <span className="detail-label">Red Flags:</span>
                        <div className="red-flags">
                          {h.redFlags.map((r, i) => (
                            <span key={i} className="red-flag-chip">{r}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(h as any).files?.length > 0 && (
                      <div className="detail-row">
                        <span className="detail-label">Attachments:</span>
                        <span className="detail-value files">
                          📎 {(h as any).files.length} file(s)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="patient-actions">
                    <button className="action-btn primary">
                      <span>📞</span> Contact Patient
                    </button>
                    <button className="action-btn">
                      <span>📋</span> View Full Record
                    </button>
                    <button className="action-btn">
                      <span>👨‍⚕️</span> Assign Doctor
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="info-notice">
        <span className="notice-icon">ℹ️</span>
        <div>
          <strong>Demo Mode:</strong> In production, patients are identity-verified and data is encrypted. 
          This demo uses local storage for demonstration purposes only.
        </div>
      </div>
    </div>
  )
}

export default Clinician
