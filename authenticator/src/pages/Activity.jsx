import React, { useState, useEffect } from 'react';
import { FileText, Clock, User, ShieldCheck, CheckCircle2, Ban, Lock, RefreshCw } from 'lucide-react';

export default function Activity() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/authenticator/activity');
      const data = await res.json();
      if (data.success && Array.isArray(data.activities)) {
        setLogs(data.activities);
      }
    } catch (e) {
      console.error('Failed to fetch activity logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getEventBadge = (eventType) => {
    if (eventType.includes('APPROVED') || eventType.includes('EXECUTED') || eventType.includes('SUCCESS')) {
      return { color: 'var(--primary)', bg: 'rgba(16, 185, 129, 0.15)', icon: <CheckCircle2 size={14} /> };
    }
    if (eventType.includes('DENIED') || eventType.includes('BLOCKED')) {
      return { color: 'var(--danger)', bg: 'var(--danger-soft)', icon: <Ban size={14} /> };
    }
    if (eventType.includes('REQUESTED') || eventType.includes('ALERT')) {
      return { color: 'var(--warning)', bg: 'var(--warning-soft)', icon: <Lock size={14} /> };
    }
    return { color: 'var(--info)', bg: 'var(--info-soft)', icon: <Clock size={14} /> };
  };

  return (
    <div style={{ margin: '24px 0' }}>
      <div className="section-header-row">
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="var(--primary)" />
            <span>Cryptographic Audit Activity Trail</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Immutable chronological record of transactions, risk analyses, authorizer actions, and token states.
          </p>
        </div>

        <button 
          className="btn-review"
          style={{ padding: '6px 12px', fontSize: '12px' }}
          onClick={fetchLogs}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh Trail</span>
        </button>
      </div>

      <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <div className="pulse-dot-green" style={{ margin: '0 auto 10px auto' }}></div>
            <span>Synchronizing audit trail...</span>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <FileText size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px auto' }} />
            <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>No Audit Events Yet</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="txn-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event Type</th>
                  <th>Actor</th>
                  <th>Event Details</th>
                  <th>Reference IDs</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((item) => {
                  const badge = getEventBadge(item.eventType);

                  return (
                    <tr key={item.id}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Now'}
                      </td>

                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: badge.bg,
                          color: badge.color,
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '800'
                        }}>
                          {badge.icon}
                          <span>{item.eventType}</span>
                        </span>
                      </td>

                      <td style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '12px' }}>
                        {item.actor}
                      </td>

                      <td style={{ color: 'var(--text-primary)', fontSize: '13px', maxWidth: '420px' }}>
                        {item.details}
                      </td>

                      <td style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {item.approvalRequestId ? <div>APR: {item.approvalRequestId.slice(0, 12)}</div> : null}
                        {item.transactionId ? <div>TXN: {item.transactionId.slice(0, 12)}</div> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
