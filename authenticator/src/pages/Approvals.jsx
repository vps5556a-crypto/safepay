import React, { useState } from 'react';
import { CheckSquare, Clock, Eye, Check, Ban, ShieldAlert, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function Approvals({
  pendingApprovals = [],
  historicalApprovals = [],
  onSelectReview,
  onQuickApprove,
  onQuickDeny
}) {
  const [filter, setFilter] = useState('pending'); // 'pending' | 'all' | 'history'

  const allList = [...pendingApprovals, ...historicalApprovals];
  const displayed = filter === 'pending' 
    ? pendingApprovals 
    : filter === 'history' 
    ? historicalApprovals 
    : allList;

  return (
    <div style={{ margin: '24px 0' }}>
      <div className="section-header-row">
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF' }}>
            Authorization & Approvals Manager
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Inspect, approve, or reject payment requests requiring elevated security clearance.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <button 
            className={`nav-btn ${filter === 'pending' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => setFilter('pending')}
          >
            Pending ({pendingApprovals.length})
          </button>
          <button 
            className={`nav-btn ${filter === 'history' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => setFilter('history')}
          >
            Decided History ({historicalApprovals.length})
          </button>
          <button 
            className={`nav-btn ${filter === 'all' ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => setFilter('all')}
          >
            All ({allList.length})
          </button>
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="section-card text-center" style={{ padding: '48px 20px', color: 'var(--text-muted)' }}>
          <CheckSquare size={36} color="var(--primary)" style={{ margin: '0 auto 12px auto' }} />
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
            No Approvals Matching Filter
          </div>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>
            {filter === 'pending' ? 'Zero transactions currently waiting for authorization.' : 'No historical approvals logged yet.'}
          </p>
        </div>
      ) : (
        <div className="pending-grid">
          {displayed.map((req) => {
            const isPending = req.status === 'PENDING';
            const isApproved = req.status === 'APPROVED';
            const isDenied = req.status === 'DENIED';
            const isExpired = req.status === 'EXPIRED';

            return (
              <div 
                key={req.id} 
                className="pending-card"
                style={{ 
                  borderColor: isPending ? 'var(--warning-border)' : isApproved ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)' 
                }}
              >
                <div className="pending-card-top">
                  <span className={`badge-risk ${isPending ? 'badge-risk-high' : isApproved ? 'badge-risk-low' : 'badge-risk-critical'}`}>
                    {isPending ? '🟠 AWAITING APPROVAL' : isApproved ? '🟢 APPROVED' : isDenied ? '🔴 DENIED' : '⚪ EXPIRED'}
                  </span>

                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {req.createdAt ? new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                  </span>
                </div>

                <div className="pending-amount">
                  ₹{parseFloat(req.amount).toLocaleString('en-IN')}
                </div>

                <div className="pending-recipient">
                  To: <strong>{req.recipient}</strong> ({req.upiId})
                </div>

                <div className="pending-reasons">
                  <div><strong>Risk Level:</strong> {req.riskLevel || 'HIGH'} ({req.riskScore || 75}/100)</div>
                  <div style={{ marginTop: '4px' }}><strong>Reason:</strong> {req.reasons ? req.reasons[0] : 'High value transfer'}</div>
                  {req.denialReason && (
                    <div style={{ marginTop: '4px', color: 'var(--danger)' }}>
                      <strong>Denial Note:</strong> {req.denialReason}
                    </div>
                  )}
                  {req.authorizationToken && (
                    <div style={{ marginTop: '4px', color: 'var(--primary)', fontFamily: 'monospace', fontSize: '11px' }}>
                      Token: {req.authorizationToken.slice(0, 20)}...
                    </div>
                  )}
                </div>

                {isPending ? (
                  <div className="card-actions-row">
                    <button 
                      className="btn-review"
                      onClick={() => onSelectReview(req)}
                    >
                      <Eye size={14} />
                      <span>Review Details</span>
                    </button>

                    <button 
                      className="btn-approve"
                      onClick={() => onQuickApprove(req.id)}
                    >
                      <Check size={14} />
                      <span>Approve</span>
                    </button>

                    <button 
                      className="btn-deny"
                      onClick={() => onQuickDeny(req.id)}
                    >
                      <Ban size={14} />
                      <span>Deny</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                    <span>Decided by: <strong>{req.decisionBy || 'AUTH-001'}</strong></span>
                    <span>ID: {req.id.slice(0, 12)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
