import React, { useState } from 'react';
import { X, ShieldCheck, ShieldAlert, AlertTriangle, ArrowUpRight, Clock, User, Check, Ban } from 'lucide-react';

export default function ReviewModal({
  approval,
  onClose,
  onApprove,
  onDeny,
  isProcessing = false
}) {
  const [denyReason, setDenyReason] = useState('');
  const [showDenyInput, setShowDenyInput] = useState(false);

  if (!approval) return null;

  const isCritical = approval.riskLevel === 'CRITICAL';
  const isHigh = approval.riskLevel === 'HIGH';

  const formatTime = (isoString) => {
    if (!isoString) return 'Just now';
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoString;
    }
  };

  const handleDenyClick = () => {
    if (!showDenyInput) {
      setShowDenyInput(true);
      return;
    }
    onDeny(approval.id, denyReason || 'Security authorizer rejected suspicious transfer.');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: isCritical ? 'var(--danger-soft)' : 'var(--warning-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isCritical ? 'var(--danger)' : 'var(--warning)'
            }}>
              {isCritical ? <ShieldAlert size={18} /> : <AlertTriangle size={18} />}
            </div>
            <div>
              <div className="modal-title">Payment Approval Review</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                ID: {approval.id}
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Amount Banner */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', fontWeight: '700' }}>
            Requested Transfer Amount
          </div>
          <div style={{ fontSize: '36px', fontWeight: '800', color: '#FFFFFF', margin: '4px 0' }}>
            ₹{parseFloat(approval.amount).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            To <strong>{approval.recipient}</strong> ({approval.upiId})
          </div>
        </div>

        {/* Transaction Details */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Transaction Information
          </div>
          <div style={{ background: 'var(--bg-input)', borderRadius: '10px', padding: '12px', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Sender Account:</span>
              <strong>{approval.userId || 'SafePay User'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Payment Method:</span>
              <strong>{approval.paymentMethod || 'UPI Instant'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Requested Time:</span>
              <strong>{formatTime(approval.createdAt)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Expiry Window:</span>
              <strong style={{ color: 'var(--warning)' }}>5 minutes</strong>
            </div>
          </div>
        </div>

        {/* Safety Check Analysis */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Safety Check & Risk Engine
          </div>
          <div style={{ background: 'var(--bg-input)', borderRadius: '10px', padding: '12px', border: `1px solid ${isCritical ? 'var(--danger-border)' : 'var(--warning-border)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Assessed Risk Score:</span>
              <span className={`badge-risk ${isCritical ? 'badge-risk-critical' : isHigh ? 'badge-risk-high' : 'badge-risk-medium'}`}>
                {approval.riskLevel || 'HIGH'} RISK ({approval.riskScore || 75}/100)
              </span>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Identified Risk Factors:</span>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {approval.reasons && approval.reasons.map((r, i) => (
                  <li key={i} style={{ fontSize: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ color: isCritical ? 'var(--danger)' : 'var(--warning)' }}>•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Recent User Activity */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Recent Activity Context
          </div>
          <div style={{ background: 'var(--bg-input)', borderRadius: '10px', padding: '12px', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Last Payment:</span>
              <strong>{approval.recentActivitySummary?.lastPayment || '₹2,000 to Rahul'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Previous Payment:</span>
              <strong>{approval.recentActivitySummary?.previousPayment || '₹1,450 to Electricity'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Payments Today:</span>
              <strong>{approval.recentActivitySummary?.paymentsToday ?? 3} transfers</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Cumulative Total Today:</span>
              <strong>₹{(approval.recentActivitySummary?.totalToday ?? 3450).toLocaleString('en-IN')}</strong>
            </div>
          </div>
        </div>

        {/* Optional Deny Reason Prompt */}
        {showDenyInput && (
          <div style={{ marginBottom: '16px', animation: 'slideIn 0.2s' }}>
            <label style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
              Reason for Denying Payment:
            </label>
            <input
              type="text"
              className="auth-input"
              placeholder="e.g. Unrecognized recipient or suspected fraud"
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* Decision Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-deny"
            style={{ flex: 1, minHeight: '44px' }}
            disabled={isProcessing}
            onClick={handleDenyClick}
          >
            <Ban size={16} />
            <span>{showDenyInput ? 'Confirm Denial' : 'DENY PAYMENT'}</span>
          </button>

          {!showDenyInput && (
            <button
              className="btn-approve"
              style={{ flex: 1.2, minHeight: '44px' }}
              disabled={isProcessing}
              onClick={() => onApprove(approval.id)}
            >
              <Check size={18} />
              <span>APPROVE PAYMENT</span>
            </button>
          )}

          {showDenyInput && (
            <button
              className="btn-review"
              style={{ flex: 0.6 }}
              onClick={() => setShowDenyInput(false)}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
