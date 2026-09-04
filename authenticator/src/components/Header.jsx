import React from 'react';
import { ShieldCheck, LayoutDashboard, CheckSquare, History, AlertTriangle, FileText, Settings, RefreshCw, Radio } from 'lucide-react';

export default function Header({ 
  activeTab, 
  setActiveTab, 
  pendingCount = 0, 
  anomaliesCount = 0,
  wsConnected = false,
  onRefresh = () => {},
  isRefreshing = false
}) {
  return (
    <header className="auth-header">
      <div className="auth-container">
        <div className="header-inner">
          <div className="brand-section">
            <div className="shield-icon-badge">
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="brand-title">
                SafePay Authenticator
                <span className="badge-risk badge-risk-low" style={{ fontSize: '10px', padding: '2px 8px' }}>
                  v2.0 Gatekeeper
                </span>
              </div>
              <div className="brand-subtitle">
                Protecting payment activity for <strong>vps55@safepay</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="header-status-pill" title={wsConnected ? 'Real-time WebSocket connection active' : 'Connecting to real-time event stream...'}>
              <span className={wsConnected ? 'pulse-dot-green' : 'pulse-dot'} style={!wsConnected ? { background: '#F59E0B' } : {}}></span>
              <span>{wsConnected ? 'Live Gatekeeper Active' : 'Connecting...'}</span>
            </div>

            <button 
              className="btn-review"
              style={{ padding: '8px 12px', height: '36px' }}
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh Authenticator Dashboard"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div style={{ marginTop: '16px' }}>
          <nav className="auth-nav">
            <button 
              className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <LayoutDashboard size={15} />
              <span>Overview</span>
            </button>

            <button 
              className={`nav-btn ${activeTab === 'approvals' ? 'active' : ''}`}
              onClick={() => setActiveTab('approvals')}
            >
              <CheckSquare size={15} />
              <span>Approvals</span>
              {pendingCount > 0 && (
                <span className="nav-badge">{pendingCount}</span>
              )}
            </button>

            <button 
              className={`nav-btn ${activeTab === 'transactions' ? 'active' : ''}`}
              onClick={() => setActiveTab('transactions')}
            >
              <History size={15} />
              <span>Transactions</span>
            </button>

            <button 
              className={`nav-btn ${activeTab === 'anomalies' ? 'active' : ''}`}
              onClick={() => setActiveTab('anomalies')}
            >
              <AlertTriangle size={15} />
              <span>Anomalies & Alerts</span>
              {anomaliesCount > 0 && (
                <span className="nav-badge" style={{ background: 'var(--warning)', color: '#000' }}>
                  {anomaliesCount}
                </span>
              )}
            </button>

            <button 
              className={`nav-btn ${activeTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveTab('activity')}
            >
              <FileText size={15} />
              <span>Audit Activity</span>
            </button>

            <button 
              className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={15} />
              <span>Security Policy</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
