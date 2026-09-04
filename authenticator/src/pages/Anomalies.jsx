import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, AlertOctagon, RefreshCw, Zap, TrendingUp, HelpCircle } from 'lucide-react';

export default function Anomalies() {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      const url = severityFilter === 'ALL' 
        ? 'http://localhost:3001/api/authenticator/anomalies'
        : `http://localhost:3001/api/authenticator/anomalies?severity=${severityFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.anomalies)) {
        setAnomalies(data.anomalies);
      }
    } catch (e) {
      console.error('Failed to fetch anomalies:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, [severityFilter]);

  return (
    <div style={{ margin: '24px 0' }}>
      <div className="section-header-row">
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} color="var(--warning)" />
            <span>Anomalies & Threat Alerts</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Behavioral analysis, transaction velocity breaches, outlier amounts, and scam-context correlations.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map((sev) => (
            <button
              key={sev}
              className={`nav-btn ${severityFilter === sev ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '11px' }}
              onClick={() => setSeverityFilter(sev)}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="section-card text-center" style={{ padding: '40px' }}>
          <div className="pulse-dot-green" style={{ margin: '0 auto 10px auto' }}></div>
          <span>Loading anomaly telemetry...</span>
        </div>
      ) : anomalies.length === 0 ? (
        <div className="section-card text-center" style={{ padding: '48px', color: 'var(--text-muted)' }}>
          <ShieldAlert size={36} color="var(--primary)" style={{ margin: '0 auto 12px auto' }} />
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
            No Anomalies Detected
          </div>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>
            All user transaction behavior falls strictly within normal historical velocity baselines.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {anomalies.map((anom) => {
            const isCritical = anom.severity === 'CRITICAL';
            const isHigh = anom.severity === 'HIGH';

            return (
              <div 
                key={anom.id}
                className="section-card"
                style={{ 
                  margin: 0, 
                  borderLeft: `4px solid ${isCritical ? 'var(--danger)' : isHigh ? 'var(--warning)' : 'var(--info)'}`,
                  background: 'var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: isCritical ? 'var(--danger-soft)' : isHigh ? 'var(--warning-soft)' : 'var(--info-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isCritical ? 'var(--danger)' : isHigh ? 'var(--warning)' : 'var(--info)'
                    }}>
                      {isCritical ? <AlertOctagon size={20} /> : <AlertTriangle size={20} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '15px', color: '#FFFFFF' }}>{anom.title}</strong>
                        <span className={`badge-risk ${isCritical ? 'badge-risk-critical' : isHigh ? 'badge-risk-high' : 'badge-risk-medium'}`}>
                          {anom.severity} SEVERITY
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Type: <code>{anom.type}</code> • Detected: {new Date(anom.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#FFFFFF' }}>
                      ₹{parseFloat(anom.amount || 0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Target: {anom.recipient || 'N/A'}
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)', margin: '14px 0 10px 0', fontSize: '13px', color: 'var(--text-primary)' }}>
                  <strong>Trigger Reason: </strong> {anom.reason}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: '700' }}>💡 Recommended Action:</span>
                  <span>{anom.recommendedAction}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
