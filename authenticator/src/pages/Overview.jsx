import React from 'react';
import { Shield, AlertTriangle, CheckSquare, TrendingUp, DollarSign, Clock, ArrowRight, Eye, Check, Ban, Activity } from 'lucide-react';

export default function Overview({
  stats = {},
  pendingApprovals = [],
  onSelectReview,
  onQuickApprove,
  onQuickDeny,
  setActiveTab
}) {
  return (
    <div>
      {/* Top Greeting Banner */}
      <div style={{ margin: '20px 0 8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '-0.5px' }}>
            Good evening, Security Controller
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            SafePay Payment Protection is <strong style={{ color: 'var(--primary)' }}>ACTIVE & SYNCHRONIZED</strong> with user <strong>vps55@safepay</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="nav-btn"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', fontSize: '12px' }}
            onClick={() => setActiveTab('settings')}
          >
            Policy: Large ≥ ₹{(stats.config?.largePaymentThreshold || 20000).toLocaleString('en-IN')}
          </button>
        </div>
      </div>

      {/* 5 Core Dashboard Cards (Section 11) */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">TOTAL TRANSACTIONS TODAY</div>
          <div className="metric-value">{stats.totalTransactionsToday ?? 0}</div>
          <div className="metric-subtitle">
            Volume: ₹{(stats.todayVolume ?? 0).toLocaleString('en-IN')}
          </div>
        </div>

        <div className="metric-card" style={{ borderColor: pendingApprovals.length > 0 ? 'var(--warning-border)' : 'var(--border)' }}>
          <div className="metric-title" style={{ color: pendingApprovals.length > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
            PENDING APPROVALS
          </div>
          <div className="metric-value" style={{ color: pendingApprovals.length > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
            {pendingApprovals.length}
          </div>
          <div className="metric-subtitle">
            {pendingApprovals.length > 0 ? 'Action required immediately' : 'All transactions reviewed'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-title">HIGH-RISK EVENTS</div>
          <div className="metric-value" style={{ color: stats.highRiskEventsCount > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
            {stats.highRiskEventsCount ?? 0}
          </div>
          <div className="metric-subtitle">Threats blocked & intercepted</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">ANOMALIES DETECTED</div>
          <div className="metric-value" style={{ color: stats.anomaliesCount > 0 ? '#F59E0B' : 'var(--text-primary)' }}>
            {stats.anomaliesCount ?? 0}
          </div>
          <div className="metric-subtitle">Velocity & pattern breaches</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">TOTAL VALUE PROTECTED</div>
          <div className="metric-value" style={{ color: 'var(--primary)' }}>
            ₹{(stats.totalValueProtected ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="metric-subtitle">Safeguarded by Gatekeeper</div>
        </div>
      </div>

      {/* Prominent Pending Approvals Section (Section 12) */}
      <div className="section-card">
        <div className="section-header-row">
          <div className="section-heading">
            <CheckSquare size={18} color="var(--warning)" />
            <span>Pending Approvals</span>
            {pendingApprovals.length > 0 && (
              <span className="badge-risk badge-risk-high" style={{ marginLeft: '8px' }}>
                {pendingApprovals.length} Awaiting Decision
              </span>
            )}
          </div>

          <button 
            className="nav-btn"
            style={{ fontSize: '12px', padding: '6px 12px' }}
            onClick={() => setActiveTab('approvals')}
          >
            View All Approvals →
          </button>
        </div>

        {pendingApprovals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: 'var(--primary)' }}>
              <Shield size={24} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
              No Pending Approval Requests
            </div>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>
              Whenever SafePay users attempt a high-value payment (≥ ₹{(stats.config?.largePaymentThreshold || 20000).toLocaleString('en-IN')}) or trigger velocity anomalies, it will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="pending-grid">
            {pendingApprovals.map((req) => (
              <div key={req.id} className="pending-card">
                <div className="pending-card-top">
                  <span className={`badge-risk ${req.riskLevel === 'CRITICAL' ? 'badge-risk-critical' : 'badge-risk-high'}`}>
                    🚨 {req.riskLevel || 'HIGH'} RISK
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    <span>Requested recently</span>
                  </span>
                </div>

                <div className="pending-amount">
                  ₹{parseFloat(req.amount).toLocaleString('en-IN')}
                </div>

                <div className="pending-recipient" style={{ marginTop: '4px' }}>
                  To: <strong>{req.recipient}</strong> ({req.upiId})
                </div>

                <div className="pending-reasons">
                  <strong>Trigger:</strong> {req.reasons ? req.reasons[0] : 'Large payment policy'}
                </div>

                <div className="card-actions-row">
                  <button 
                    className="btn-review"
                    onClick={() => onSelectReview(req)}
                  >
                    <Eye size={14} />
                    <span>Review</span>
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Security Status Banner */}
      <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <strong style={{ fontSize: '14px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={16} color="var(--primary)" />
            Real-Time Gatekeeper Architecture
          </strong>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Payments requiring authorization remain in <code>WAITING_FOR_AUTHENTICATOR</code> state until you approve. The user must personally confirm payment after approval.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn-review"
            style={{ fontSize: '12px', padding: '8px 14px' }}
            onClick={() => setActiveTab('anomalies')}
          >
            Check Anomalies →
          </button>
        </div>
      </div>
    </div>
  );
}
