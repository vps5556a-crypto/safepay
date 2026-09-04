import React, { useState, useEffect } from 'react';
import { History, Filter, ArrowUpRight, ArrowDownLeft, ShieldCheck, ShieldAlert, AlertOctagon, Search } from 'lucide-react';

export default function Transactions() {
  const [filter, setFilter] = useState('all');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTransactions = async (selectedFilter) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/authenticator/transactions?filter=${selectedFilter}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(filter);
  }, [filter]);

  const filteredList = transactions.filter(t => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (t.recipient && t.recipient.toLowerCase().includes(query)) ||
      (t.upiId && t.upiId.toLowerCase().includes(query)) ||
      (t.note && t.note.toLowerCase().includes(query)) ||
      (t.id && t.id.toLowerCase().includes(query))
    );
  });

  return (
    <div style={{ margin: '24px 0' }}>
      <div className="section-header-row">
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF' }}>
            User Transaction Overview & Monitor
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Real-time ledger of all payments, authorizations, blocks, and receipts for <strong>vps55@safepay</strong>.
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '240px' }}>
          <input
            type="text"
            className="auth-input"
            style={{ paddingLeft: '34px', fontSize: '13px', padding: '8px 12px 8px 34px' }}
            placeholder="Search by recipient or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        </div>
      </div>

      {/* Filter Tabs (Section 23) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: 'All Transactions' },
          { id: 'successful', label: 'Successful' },
          { id: 'pending', label: 'Pending Approval' },
          { id: 'denied', label: 'Denied / Blocked' },
          { id: 'high_risk', label: 'High Risk' }
        ].map((btn) => (
          <button
            key={btn.id}
            type="button"
            className={`nav-btn ${filter === btn.id ? 'active' : ''}`}
            style={{ padding: '6px 14px', fontSize: '12px', background: filter === btn.id ? 'var(--primary)' : 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
            onClick={() => setFilter(btn.id)}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <div className="pulse-dot-green" style={{ margin: '0 auto 12px auto' }}></div>
            <span>Loading synchronized ledger...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <History size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px auto' }} />
            <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>No transactions found</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>No payment entries match the selected filter.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="txn-table">
              <thead>
                <tr>
                  <th>Recipient / Counterparty</th>
                  <th>Amount</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                  <th>Risk Level</th>
                  <th>Authorization</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((t) => {
                  const isSuccess = t.status === 'SUCCESS' || t.status === 'SUCCESSFUL';
                  const isBlocked = t.status === 'BLOCKED' || t.status === 'DENIED';
                  const isCredit = t.type === 'CREDIT';

                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '10px',
                            background: isCredit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isCredit ? 'var(--primary)' : 'var(--text-primary)',
                            fontWeight: '800'
                          }}>
                            {isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                              {t.recipient}
                            </strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {t.upiId} {t.note ? `• "${t.note}"` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <strong style={{ 
                          fontSize: '15px', 
                          color: isCredit ? 'var(--primary)' : isBlocked ? 'var(--text-muted)' : '#FFFFFF' 
                        }}>
                          {isCredit ? '+' : '-'}₹{parseFloat(t.amount || 0).toLocaleString('en-IN')}
                        </strong>
                      </td>

                      <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {t.date ? new Date(t.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recent'}
                      </td>

                      <td>
                        <span className="badge-risk" style={{
                          background: isSuccess ? 'rgba(16, 185, 129, 0.15)' : isBlocked ? 'var(--danger-soft)' : 'var(--warning-soft)',
                          color: isSuccess ? 'var(--primary)' : isBlocked ? 'var(--danger)' : 'var(--warning)',
                          border: `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.3)' : isBlocked ? 'var(--danger-border)' : 'var(--warning-border)'}`
                        }}>
                          {t.status}
                        </span>
                      </td>

                      <td>
                        <span className={`badge-risk ${t.riskLevel === 'CRITICAL' ? 'badge-risk-critical' : t.riskLevel === 'HIGH' ? 'badge-risk-high' : 'badge-risk-low'}`}>
                          {t.riskLevel || 'LOW'}
                        </span>
                      </td>

                      <td style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {t.authorizationId ? (
                          <span style={{ color: 'var(--primary)' }} title={`Token: ${t.authorizationId}`}>
                            ✓ {t.authorizationId.slice(0, 14)}...
                          </span>
                        ) : (
                          <span>Direct Payment</span>
                        )}
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
