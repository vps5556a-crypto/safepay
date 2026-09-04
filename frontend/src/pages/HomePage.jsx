import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, QrCode, Shield, MessageSquare, Eye, EyeOff, CheckCircle2, AlertTriangle, X, Copy, Check, ShieldCheck, PlusCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const HomePage = ({ isSimpleMode, isDarkMode }) => {
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [receiveSuccess, setReceiveSuccess] = useState(false);

  const fetchAccountAndTransactions = async () => {
    try {
      const [accRes, txnRes] = await Promise.all([
        fetch('http://localhost:3001/api/account'),
        fetch('http://localhost:3001/api/transactions')
      ]);
      const accData = await accRes.json();
      const txnData = await txnRes.json();
      if (accData.success) {
        setAccount(accData.account);
      }
      setTransactions(txnData);
    } catch (err) {
      console.error('Failed to load account or transactions:', err);
    }
  };

  useEffect(() => {
    fetchAccountAndTransactions();
  }, []);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(account?.upiId || 'vps55@safepay');
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleSimulateReceive = async (amount = 3000) => {
    setIsReceiving(true);
    setReceiveSuccess(false);
    try {
      const res = await fetch('http://localhost:3001/api/transactions/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'Priya Sharma (UPI)',
          amount,
          note: 'Project consultation fee'
        })
      });
      const data = await res.json();
      if (data.success) {
        setAccount(prev => ({ ...prev, balance: data.account.balance }));
        setReceiveSuccess(true);
        // Refresh transaction list
        fetch('http://localhost:3001/api/transactions')
          .then(r => r.json())
          .then(list => setTransactions(list));
      }
    } catch (err) {
      console.error('Receive money simulation failed:', err);
    } finally {
      setIsReceiving(false);
    }
  };

  const formattedBalance = account?.balance !== undefined
    ? `₹${account.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '₹25,000.00';

  return (
    <div>
      {/* Friendly User Greeting */}
      <div className="greeting-text">
        <span>Good morning 👋</span>
      </div>

      {/* Polished Balance Card */}
      <div id="balance-card" className="balance-card">
        <div className="balance-label">
          <span>{isSimpleMode ? 'Money Left' : 'Available Balance'}</span>
          <button 
            type="button" 
            onClick={() => setShowBalance(!showBalance)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
            title={showBalance ? 'Hide Balance' : 'Show Balance'}
          >
            {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <div className="balance-amount">
          {showBalance ? formattedBalance : '••••••••'}
        </div>

        <div className="flex justify-between items-center mt-2">
          <div className="upi-id-tag">
            <span>UPI ID: {account?.upiId || 'vps55@safepay'}</span>
            <button 
              type="button" 
              onClick={handleCopyUpi} 
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
              title="Copy UPI ID"
            >
              {copiedUpi ? <Check size={14} color="#15803D" /> : <Copy size={14} />}
            </button>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span>
            Bank Linked
          </span>
        </div>
      </div>

      {/* Primary Action Grid */}
      <div className="quick-action-grid">
        <button id="action-send-money" className="action-btn" onClick={() => navigate('/send')}>
          <div className="action-icon-wrap action-icon-send">
            <ArrowUpRight size={22} />
          </div>
          <span className="action-label">Send Money</span>
        </button>

        <button className="action-btn" onClick={() => { setShowQrModal(true); setReceiveSuccess(false); }}>
          <div className="action-icon-wrap action-icon-req">
            <ArrowDownLeft size={22} />
          </div>
          <span className="action-label">Request</span>
        </button>

        <button className="action-btn" onClick={() => setShowScanModal(true)}>
          <div className="action-icon-wrap action-icon-scan">
            <QrCode size={22} />
          </div>
          <span className="action-label">Scan & Pay</span>
        </button>

        <button className="action-btn" onClick={() => navigate('/messages')}>
          <div className="action-icon-wrap action-icon-msg">
            <MessageSquare size={22} />
          </div>
          <span className="action-label">Messages</span>
        </button>
      </div>

      {/* Safety Protection Card */}
      <Link to="/safety" style={{ textDecoration: 'none' }}>
        <div className="safety-banner">
          <div className="safety-banner-icon">
            <ShieldCheck size={26} />
          </div>
          <div className="safety-banner-text" style={{ flex: 1 }}>
            <h4>🛡️ SafePay Active Protection</h4>
            <p style={{ marginBottom: '6px' }}>You're protected by our intelligent payment safety system.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: 'var(--success)', fontWeight: '700' }}>
              <span>✓ Scam detection active</span>
              <span>•</span>
              <span>✓ Payment safety enabled</span>
              <span>•</span>
              <span>✓ Recipient verification</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Recent Activity */}
      <div id="recent-transactions" className="card-title-row">
        <h3 className="section-title">{isSimpleMode ? 'Money You Sent' : 'Recent Transactions'}</h3>
        <Link to="/safety" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', fontWeight: '700' }}>
          Safety Log →
        </Link>
      </div>

      <div>
        {transactions.map(t => {
          const isHighRisk = t.riskLevel === 'CRITICAL' || t.riskLevel === 'HIGH';
          const isBlocked = t.status === 'BLOCKED' || t.status === 'Blocked by User';
          const isCredit = t.type === 'CREDIT';

          return (
            <div key={t.id} className="recipient-item">
              <div className="recipient-info">
                <div className="avatar-circle" style={{ 
                  background: isBlocked ? 'var(--danger-soft)' : isCredit ? 'var(--success-soft)' : isHighRisk ? 'var(--warning-soft)' : 'var(--primary-gradient)',
                  color: isBlocked ? 'var(--danger)' : isCredit ? 'var(--success)' : isHighRisk ? 'var(--warning)' : 'white'
                }}>
                  {isCredit ? '+' : (t.recipient || 'U').charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>
                    {isCredit ? `From: ${t.sender || 'Sender'}` : t.recipient}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {t.note || 'Payment'}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  fontWeight: '800', 
                  fontSize: '16px', 
                  color: isBlocked ? 'var(--text-muted)' : isCredit ? 'var(--success)' : 'var(--text-primary)' 
                }}>
                  {isBlocked ? '' : isCredit ? '+' : '-'}₹{t.amount?.toLocaleString('en-IN')}
                </div>
                {isBlocked ? (
                  <span className="badge" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>
                    🛡️ Blocked
                  </span>
                ) : isHighRisk ? (
                  <span className="badge badge-new">
                    ⚠️ Warning Shown
                  </span>
                ) : (
                  <span className="badge badge-known">
                    ✓ Successful
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Receive Money QR Modal */}
      {showQrModal && (
        <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="modal-content text-center" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowQrModal(false)}>
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
              Receive Money via UPI
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
              Anyone can scan this QR code to transfer directly to your bank account.
            </p>

            <div style={{ 
              background: 'white', 
              padding: '20px', 
              borderRadius: '16px', 
              display: 'inline-block',
              boxShadow: 'var(--shadow-card)',
              border: '1px solid var(--border)'
            }}>
              {/* Simulated QR Pattern */}
              <div style={{
                width: '170px',
                height: '170px',
                background: 'repeating-conic-gradient(#10233F 0% 25%, #FFFFFF 0% 50%) 50% / 20px 20px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{ background: 'white', padding: '8px 12px', borderRadius: '8px', fontWeight: '800', fontSize: '14px', color: 'var(--primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                  SafePay
                </div>
              </div>
            </div>

            <div className="upi-id-tag mt-4" style={{ justifyContent: 'center', width: 'fit-content', margin: '14px auto 0 auto' }}>
              <span>{account?.upiId || 'vps55@safepay'}</span>
              <button 
                type="button" 
                onClick={handleCopyUpi} 
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                {copiedUpi ? <Check size={14} color="#15803D" /> : <Copy size={14} />}
              </button>
            </div>

            <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--success)', fontWeight: '700' }}>
              🛡️ SafePay Guarantee: You NEVER need to enter your PIN to receive money!
            </div>

            {/* Simulated Payment Receipt Tool (for verification & demonstrations) */}
            <div style={{ marginTop: '18px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Simulate Receiving a Transfer (Credits Account)
              </div>
              <button 
                type="button"
                className="btn btn-primary"
                style={{ minHeight: '40px', padding: '10px 16px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => handleSimulateReceive(3000)}
                disabled={isReceiving}
              >
                <PlusCircle size={16} />
                {isReceiving ? 'Processing Transfer...' : 'Simulate Receiving +₹3,000 via UPI'}
              </button>
              {receiveSuccess && (
                <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--success)', fontWeight: '700' }}>
                  ✓ ₹3,000 credited successfully! New Balance: {formattedBalance}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Simulated Scan & Pay Modal */}
      {showScanModal && (
        <div className="modal-overlay" onClick={() => setShowScanModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowScanModal(false)}>
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
              Scan & Pay
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
              Select a demo QR code or enter recipient to simulate scanning.
            </p>

            <div style={{
              height: '150px',
              border: '2px dashed var(--primary)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--primary-light)',
              marginBottom: '16px'
            }}>
              <QrCode size={44} color="var(--primary)" style={{ marginBottom: '8px' }} />
              <span style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: '600' }}>Camera Viewfinder Active</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="btn btn-secondary"
                style={{ padding: '12px', fontSize: '13px', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}
                onClick={() => {
                  setShowScanModal(false);
                  navigate('/send', { state: { recipient: 'Grocery Mart (groceries@hdfc)', amount: '450', purpose: 'Store QR Purchase' } });
                }}
              >
                <span>🛒 Grocery Mart QR (Safe Store)</span>
                <span style={{ color: 'var(--success)', fontWeight: '700' }}>₹450</span>
              </button>

              <button 
                className="btn btn-secondary"
                style={{ padding: '12px', fontSize: '13px', borderColor: 'var(--danger-border)', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}
                onClick={() => {
                  setShowScanModal(false);
                  navigate('/send', { state: { recipient: 'Fast Cash Prize Agent', amount: '2000', purpose: 'Prize Verification QR', isNew: true } });
                }}
              >
                <span>⚠️ Suspicious Lottery QR (Scam QR)</span>
                <span style={{ color: 'var(--danger)', fontWeight: '700' }}>₹2,000</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
