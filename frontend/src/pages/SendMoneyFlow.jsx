import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RiskAlert from '../components/RiskAlert';
import { CheckCircle, AlertTriangle, ShieldCheck, ShieldAlert, AlertOctagon, ArrowLeft, User, Phone, AtSign, Sparkles, Wallet, Lock, KeyRound } from 'lucide-react';

const RECENT_CONTACTS = [
  {
    name: 'Rahul Kumar',
    phone: '+91 98765 43210',
    upiId: 'rahul@upi',
    isKnown: true,
    lastPayment: '₹2,000 • Yesterday'
  },
  {
    name: 'Priya Sharma',
    phone: '+91 98123 45678',
    upiId: 'priya@okhdfcbank',
    isKnown: true,
    lastPayment: '₹500 • Aug 28'
  },
  {
    name: 'Grocery Mart',
    phone: '+91 98222 11111',
    upiId: 'groceries@hdfc',
    isKnown: true,
    lastPayment: '₹450 • Aug 25'
  },
  {
    name: 'Unknown Merchant',
    phone: '+91 91999 88888',
    upiId: 'lottery_claim@paytm',
    isKnown: false,
    lastPayment: 'Never used before'
  },
  {
    name: 'Fast Cash Loan Agent',
    phone: '+91 90000 12345',
    upiId: 'loan_verification@ybl',
    isKnown: false,
    lastPayment: 'Never used before'
  }
];

const SendMoneyFlow = ({ isSimpleMode, isDarkMode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state || {};

  const [step, setStep] = useState(1);
  const [recipient, setRecipient] = useState(prefill.recipient || '');
  const [upiId, setUpiId] = useState(prefill.upiId || '');
  const [phone, setPhone] = useState(prefill.phone || '');
  const [isNewRecipient, setIsNewRecipient] = useState(prefill.isNew !== undefined ? prefill.isNew : false);
  const [amount, setAmount] = useState(prefill.amount || '');
  const [purpose, setPurpose] = useState(prefill.purpose || prefill.contextMessage || '');
  
  const [account, setAccount] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState(null);
  
  // Backend-Driven Authentication & Authorization States
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authDecision, setAuthDecision] = useState(null);
  const [securityPin, setSecurityPin] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [completedTxnData, setCompletedTxnData] = useState(null);
  const [paymentComplete, setPaymentComplete] = useState(false);

  const [authenticatorThreshold, setAuthenticatorThreshold] = useState(20000);

  // Fetch authoritative account balance and authenticator threshold on mount
  useEffect(() => {
    fetch('http://localhost:3001/api/account')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAccount(data.account);
        }
      })
      .catch(err => console.error('Failed to fetch account balance:', err));

    fetch('http://localhost:3001/api/payment/config')
      .then(res => res.json())
      .then(data => {
        if (data.largePaymentThreshold) {
          setAuthenticatorThreshold(data.largePaymentThreshold);
        }
      })
      .catch(err => console.error('Failed to fetch authenticator config:', err));
  }, []);

  // Jump to review step if prefilled from Demo or Messages, or step 2 if recipient only
  useEffect(() => {
    if (prefill.recipient && prefill.amount) {
      setStep(3);
      runSafetyAndAuthFlow(prefill.recipient, prefill.amount, prefill.isNew || false, prefill.purpose || prefill.contextMessage || '', prefill.simulationMode);
    } else if (prefill.recipient && !prefill.amount) {
      setStep(2);
      if (!upiId) {
        setUpiId(prefill.recipient.includes('@') ? prefill.recipient : `${prefill.recipient.toLowerCase().replace(/\s+/g, '')}@upi`);
      }
    }
  }, [prefill]);

  const handleSelectContact = (contact) => {
    setRecipient(contact.name);
    setUpiId(contact.upiId);
    setPhone(contact.phone);
    setIsNewRecipient(!contact.isKnown);
    setStep(2);
  };

  const handleManualRecipientContinue = () => {
    if (!recipient.trim()) return;
    const isKnown = RECENT_CONTACTS.some(c => c.isKnown && (c.name.toLowerCase() === recipient.toLowerCase() || c.upiId.toLowerCase() === recipient.toLowerCase()));
    setIsNewRecipient(!isKnown);
    if (!upiId) {
      setUpiId(recipient.includes('@') ? recipient : `${recipient.toLowerCase().replace(/\s+/g, '')}@upi`);
    }
    setStep(2);
  };

  const handleAmountSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;

    if (account && parsed > account.balance) {
      setErrorMessage(`Insufficient balance. You only have ₹${account.balance.toLocaleString('en-IN')}.`);
      return;
    }

    setStep(3);
    runSafetyAndAuthFlow(recipient, amount, isNewRecipient, purpose, prefill.simulationMode);
  };

  // Run initial risk analysis followed by backend authentication request
  const runSafetyAndAuthFlow = async (rec, amt, isNew, note, simulationMode = null) => {
    setIsAnalyzing(true);
    let calculatedRisk = { riskLevel: isNew ? 'MEDIUM' : 'LOW', riskScore: isNew ? 25 : 0 };
    try {
      const response = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: rec,
          amount: amt,
          isNewRecipient: isNew,
          message: note || ''
        })
      });
      calculatedRisk = await response.json();
      setRiskAssessment(calculatedRisk);
    } catch (error) {
      console.error('Safety analysis failed', error);
      calculatedRisk = {
        riskLevel: isNew ? 'MEDIUM' : 'LOW',
        riskScore: isNew ? 25 : 0,
        reasons: isNew ? ['New recipient verification recommended'] : ['Verified transaction'],
        recommendedAction: 'Verify details before proceeding.'
      };
      setRiskAssessment(calculatedRisk);
    } finally {
      setIsAnalyzing(false);
      // Automatically request backend authentication/authorization
      await requestBackendAuthentication(rec, amt, calculatedRisk.riskLevel, calculatedRisk.riskScore, '', simulationMode);
    }
  };

  // Call the Backend Authentication Endpoint (Section 5)
  const requestBackendAuthentication = async (rec, amt, rLevel, rScore, verificationCode = '', simulationMode = null) => {
    setIsAuthenticating(true);
    setErrorMessage('');
    try {
      const res = await fetch('http://localhost:3001/api/payment/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: rec,
          upiId: upiId || `${(rec || '').toLowerCase().replace(/\s+/g, '')}@upi`,
          amount: parseFloat(amt),
          riskLevel: rLevel,
          riskScore: rScore,
          verificationCode,
          simulationMode
        })
      });

      const data = await res.json();

      // Validate strict boolean matrix schema (Section 17)
      if (
        typeof data.authenticated !== 'boolean' ||
        typeof data.authorized !== 'boolean' ||
        typeof data.requiresAdditionalVerification !== 'boolean'
      ) {
        setAuthDecision({
          authenticated: false,
          authorized: false,
          requiresAdditionalVerification: false,
          message: 'Malformed response received from backend authentication service.'
        });
      } else {
        setAuthDecision(data);
      }
    } catch (err) {
      console.error('Backend authentication network error:', err);
      // Default to DENY on network failure (Section 25)
      setAuthDecision({
        authenticated: false,
        authorized: false,
        requiresAdditionalVerification: false,
        message: "We couldn't verify this payment due to a network error. No money was moved."
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Real-time WebSocket connection & Polling fallback for Authenticator Gatekeeper
  useEffect(() => {
    if (!authDecision || authDecision.status !== 'WAITING_FOR_AUTHENTICATOR' || !authDecision.approvalRequestId) {
      return;
    }

    const approvalId = authDecision.approvalRequestId;
    let ws = null;
    let pollInterval = null;

    // 1. Establish WebSocket listener
    try {
      ws = new WebSocket('ws://localhost:3001');

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'payment:approved' && msg.data?.approvalRequestId === approvalId) {
            setAuthDecision(prev => ({
              ...prev,
              authorized: true,
              status: 'APPROVED',
              authorizationId: msg.data.authorizationToken,
              approvedBy: msg.data.approvedBy,
              message: 'Payment approved by security authenticator. Please personally confirm the transfer.'
            }));
          } else if (msg.event === 'payment:denied' && msg.data?.approvalRequestId === approvalId) {
            setAuthDecision(prev => ({
              ...prev,
              authorized: false,
              status: 'DENIED',
              message: msg.data.reason || 'Payment was not approved by the security authenticator.'
            }));
          } else if (msg.event === 'payment:expired' && msg.data?.approvalRequestId === approvalId) {
            setAuthDecision(prev => ({
              ...prev,
              authorized: false,
              status: 'EXPIRED',
              message: 'Approval request expired. Please try again.'
            }));
          }
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      ws.onerror = (e) => {
        console.warn('WS connection notice, polling active as backup:', e);
      };
    } catch (err) {
      console.warn('WebSocket init failed, relying on polling:', err);
    }

    // 2. Continuous 1.5s Polling Fallback
    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/authenticator/approval-status/${approvalId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'APPROVED' && data.authorizationToken) {
            setAuthDecision(prev => ({
              ...prev,
              authorized: true,
              status: 'APPROVED',
              authorizationId: data.authorizationToken,
              message: 'Payment approved by security authenticator. Please personally confirm the transfer.'
            }));
          } else if (data.status === 'DENIED') {
            setAuthDecision(prev => ({
              ...prev,
              authorized: false,
              status: 'DENIED',
              message: data.denialReason || 'Payment was not approved by the security authenticator.'
            }));
          } else if (data.status === 'EXPIRED') {
            setAuthDecision(prev => ({
              ...prev,
              authorized: false,
              status: 'EXPIRED',
              message: 'Approval request expired. Please try again.'
            }));
          }
        }
      } catch (e) {}
    }, 1500);

    return () => {
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [authDecision?.status, authDecision?.approvalRequestId]);

  const confirmPayment = async () => {
    // Only proceed if backend explicitly authorized the transaction (Section 11 & 12)
    if (!authDecision || !authDecision.authenticated || !authDecision.authorized) {
      setErrorMessage('Payment has not been authorized by the backend.');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage('');

    // Generate client transaction ID
    const clientTxnId = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
      const res = await fetch('http://localhost:3001/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clientTxnId,
          recipient,
          upiId: upiId || `${recipient.toLowerCase().replace(/\s+/g, '')}@upi`,
          amount: parseFloat(amount),
          type: 'DEBIT',
          status: 'SUCCESS',
          riskLevel: riskAssessment?.riskLevel || 'LOW',
          note: purpose || 'Payment',
          authorizationId: authDecision.authorizationId
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Payment could not be processed. Please check your balance.');
        setIsSubmitting(false);
        return;
      }

      setCompletedTxnData(data);
      setPaymentComplete(true);
    } catch (error) {
      console.error('Payment failed', error);
      setErrorMessage('Network error while processing payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (paymentComplete) {
    const finalBalance = completedTxnData?.account?.balance !== undefined 
      ? completedTxnData.account.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : (account?.balance ? (account.balance - parseFloat(amount)).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '20,000.00');

    return (
      <div className="card text-center" style={{ padding: '40px 20px', marginTop: '16px' }}>
        <CheckCircle size={68} color="var(--success)" style={{ margin: '0 auto 16px auto' }} />
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--success)' }}>Payment Successful</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginTop: '8px' }}>
          You safely transferred <strong style={{ color: 'var(--text-primary)' }}>₹{parseFloat(amount).toLocaleString('en-IN')}</strong> to <strong style={{ color: 'var(--text-primary)' }}>{recipient}</strong>.
        </p>

        {/* Synchronized Live Balance Card */}
        <div style={{ margin: '24px 0', background: 'var(--surface-soft)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
            Updated Available Balance
          </div>
          <div style={{ fontWeight: '800', fontSize: '26px', color: 'var(--text-primary)', marginTop: '4px' }}>
            ₹{finalBalance}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
            Transaction Reference: <strong>{completedTxnData?.transaction?.id || `TXN${Date.now()}`}</strong>
          </div>
          {completedTxnData?.transaction?.authorizationId && (
            <div style={{ fontSize: '11px', color: 'var(--success)', marginTop: '4px', fontWeight: '700' }}>
              🔐 Backend Authorization Token Verified
            </div>
          )}
        </div>

        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isInsufficient = account && amount && parseFloat(amount) > account.balance;

  return (
    <div>
      {/* Header breadcrumb & back button */}
      <div className="flex items-center gap-2 mb-4">
        {step > 1 && (
          <button 
            type="button" 
            onClick={() => { setStep(step - 1); setErrorMessage(''); setAuthDecision(null); }}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
          {step === 1 && 'Select Recipient'}
          {step === 2 && 'Enter Amount'}
          {step === 3 && 'Review Payment'}
        </h2>
      </div>

      {/* STEP 1: SELECT RECIPIENT */}
      {step === 1 && (
        <>
          <div className="input-group">
            <label className="input-label">Pay by Name, UPI ID, or Mobile Number</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. rahul@upi or 9876543210"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>

          {recipient.trim().length > 0 && (
            <button className="btn btn-primary mb-4" onClick={handleManualRecipientContinue}>
              Continue with "{recipient}" →
            </button>
          )}

          <div className="card-title-row mt-4">
            <h3 className="section-title">Saved & Recent Contacts</h3>
          </div>

          <div>
            {RECENT_CONTACTS.map((contact, i) => (
              <div 
                key={i} 
                className="recipient-item"
                onClick={() => handleSelectContact(contact)}
              >
                <div className="recipient-info">
                  <div className="avatar-circle">
                    {contact.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>{contact.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {contact.upiId} • {contact.phone}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {contact.isKnown ? (
                    <span className="badge badge-known">
                      ✓ Known Contact
                    </span>
                  ) : (
                    <span className="badge badge-new">
                      ⚠ New Recipient
                    </span>
                  )}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {contact.lastPayment}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* STEP 2: ENTER AMOUNT */}
      {step === 2 && (
        <>
          {/* Recipient summary card */}
          <div className="card">
            <div className="flex justify-between items-center">
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sending To</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>{recipient}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{upiId || `${recipient}@upi`}</div>
              </div>
              {isNewRecipient ? (
                <span className="badge badge-new">⚠ New Recipient</span>
              ) : (
                <span className="badge badge-known">✓ Known Contact</span>
              )}
            </div>

            {/* Account balance pill */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <Wallet size={15} color="var(--primary)" />
              <span>Available Account Balance: </span>
              <strong style={{ color: 'var(--text-primary)' }}>
                ₹{account?.balance !== undefined ? account.balance.toLocaleString('en-IN') : '25,000'}
              </strong>
            </div>

            {/* Additional Safety Notice if New Recipient */}
            {isNewRecipient && (
              <div style={{ 
                marginTop: '14px', 
                padding: '12px 14px', 
                borderRadius: '12px', 
                background: 'var(--warning-soft)', 
                border: '1px solid var(--warning-border)',
                fontSize: '13px',
                color: 'var(--warning)',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={18} flexShrink={0} />
                <span>
                  <strong>New Recipient Alert:</strong> You have never sent money to this account before. Always call the person directly to verify.
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleAmountSubmit}>
            <div className="input-group">
              <label className="input-label">Amount to Send</label>
              <input 
                type="number" 
                className="input-field" 
                style={{ fontSize: '36px', fontWeight: '800', textAlign: 'center', color: isInsufficient ? 'var(--danger)' : 'var(--primary)' }}
                placeholder="₹ 0"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setErrorMessage(''); }}
                autoFocus
              />
            </div>

            {/* Dynamic Authenticator Threshold Notice */}
            {amount && parseFloat(amount) >= authenticatorThreshold && (
              <div style={{ 
                marginBottom: '14px', 
                padding: '10px 14px', 
                borderRadius: '10px', 
                background: 'rgba(59, 130, 246, 0.1)', 
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: 'var(--primary)',
                fontSize: '12px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Lock size={16} />
                <span>
                  High-value payment (≥ ₹{authenticatorThreshold.toLocaleString('en-IN')}, limit set by authenticator): Secondary security PIN verification will be required.
                </span>
              </div>
            )}

            {/* Insufficient balance indicator */}
            {isInsufficient && (
              <div style={{ 
                marginBottom: '16px', 
                padding: '10px 14px', 
                borderRadius: '10px', 
                background: 'var(--danger-soft)', 
                border: '1px solid var(--danger-border)',
                color: 'var(--danger)',
                fontSize: '13px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={18} />
                <span>You don't have enough money for this payment. Available: ₹{account?.balance?.toLocaleString('en-IN')}</span>
              </div>
            )}

            {/* Quick Amount Chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
              {[100, 500, 5000, 25000].map(val => (
                <button 
                  key={val}
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: '40px', padding: '8px', fontSize: '13px', fontWeight: '700' }}
                  onClick={() => {
                    setAmount(String(val));
                    setErrorMessage('');
                  }}
                >
                  ₹{val >= 1000 ? `${val/1000}k` : val}
                </button>
              ))}
            </div>

            <div className="input-group">
              <label className="input-label">Payment Purpose / Note</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="What is this payment for? (e.g. Rent, Groceries)"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={!amount || parseFloat(amount) <= 0 || isInsufficient}
            >
              Review Payment & Safety Check →
            </button>
          </form>
        </>
      )}

      {/* STEP 3: REVIEW PAYMENT & BACKEND-DRIVEN AUTHORIZATION */}
      {step === 3 && (
        <>
          {/* Global Error Banner */}
          {errorMessage && (
            <div style={{ 
              marginBottom: '16px', 
              padding: '12px 16px', 
              borderRadius: '12px', 
              background: 'var(--danger-soft)', 
              border: '1.5px solid var(--danger-border)',
              color: 'var(--danger)',
              fontSize: '14px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertTriangle size={20} flexShrink={0} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Exact review display: WHO -> HOW MUCH -> WHY */}
          <div className="card text-center payment-review-card" style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>
              You are about to send
            </div>
            
            <div className="balance-amount" style={{ justifyContent: 'center', color: 'var(--text-primary)', margin: '8px 0 12px 0' }}>
              ₹{parseFloat(amount || '0').toLocaleString('en-IN')}
            </div>

            <div style={{ height: '1px', background: 'var(--border)', margin: '14px 0' }} />

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>To</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>{recipient}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{upiId || `${recipient.toLowerCase().replace(/\s+/g, '')}@upi`}</div>

            {purpose && (
              <div style={{ marginTop: '14px', background: 'var(--surface)', padding: '8px 14px', borderRadius: '10px', display: 'inline-block', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Purpose: </span>
                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>"{purpose}"</strong>
              </div>
            )}
          </div>

          {/* STATE 0: Analyzing or Authenticating in progress (Section 6) */}
          {(isAnalyzing || isAuthenticating) ? (
            <div className="card text-center" style={{ padding: '36px 20px' }}>
              <div className="pulse-dot" style={{ width: '18px', height: '18px', margin: '0 auto 16px auto' }}></div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                🔐 Verifying Payment Authorization
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>
                We're checking this payment with the backend security engine for your protection...
              </p>
            </div>
          ) : !authDecision ? null : (
            /* RESPONSE-DRIVEN STATES FROM BACKEND BOOLEAN MATRIX */

            /* CASE 2: Verification Failed (Section 8: authenticated=false, authorized=false) */
            (!authDecision.authenticated && !authDecision.authorized) ? (
              <div className="card text-center" style={{ padding: '32px 20px', border: '1.5px solid var(--danger-border)', background: 'var(--danger-soft)' }}>
                <AlertOctagon size={52} color="var(--danger)" style={{ margin: '0 auto 14px auto' }} />
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--danger)' }}>❌ Verification Failed</h3>
                <p style={{ color: 'var(--text-primary)', fontSize: '14px', marginTop: '8px', lineHeight: '1.5' }}>
                  {authDecision.message || "We couldn't verify this payment."}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px', fontWeight: '600' }}>
                  Your money has not been taken from your account.
                </p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={() => { setSecurityPin(''); requestBackendAuthentication(recipient, amount, riskAssessment?.riskLevel, riskAssessment?.riskScore, '', null); }}
                  >
                    Try Again
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    style={{ flex: 1, background: 'var(--danger)' }}
                    onClick={() => navigate('/')}
                  >
                    Cancel Payment
                  </button>
                </div>
              </div>
            ) :

            /* CASE 4: Additional Verification Required via SafePay Authenticator Gatekeeper */
            (authDecision.status === 'WAITING_FOR_AUTHENTICATOR' || (authDecision.authenticated && !authDecision.authorized && authDecision.requiresAdditionalVerification)) ? (
              <div className="card" style={{ border: '1.5px solid var(--warning-border)', background: 'var(--warning-soft)', padding: '28px 20px', textAlign: 'center' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(234, 88, 12, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px auto',
                  color: '#EA580C',
                  boxShadow: '0 4px 14px rgba(234, 88, 12, 0.2)'
                }}>
                  <Lock size={30} />
                </div>

                <div className="badge badge-new mb-2" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 12px' }}>
                  <span className="pulse-dot" style={{ background: '#EA580C' }}></span>
                  <span>Awaiting Security Authenticator Approval</span>
                </div>

                <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: '6px 0 8px 0' }}>
                  Additional Security Approval Required
                </h3>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', maxWidth: '380px', margin: '0 auto 16px auto' }}>
                  Your payment request of <strong>₹{parseFloat(amount).toLocaleString('en-IN')}</strong> to <strong>{recipient}</strong> has been forwarded to your trusted SafePay Authenticator for verification.
                </p>

                <div style={{ background: 'var(--surface)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border)', textAlign: 'left', marginBottom: '16px' }}>
                  <div className="flex justify-between items-center mb-2">
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Approval Request ID:</span>
                    <strong style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--primary)' }}>{authDecision.approvalRequestId || 'APR-PENDING'}</strong>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Risk Level:</span>
                    <span className="badge" style={{
                      background: authDecision.riskLevel === 'CRITICAL' ? 'var(--danger-soft)' : 'var(--warning-soft)',
                      color: authDecision.riskLevel === 'CRITICAL' ? 'var(--danger)' : 'var(--warning)',
                      border: `1px solid ${authDecision.riskLevel === 'CRITICAL' ? 'var(--danger-border)' : 'var(--warning-border)'}`,
                      fontSize: '11px',
                      fontWeight: '800'
                    }}>
                      {authDecision.riskLevel || 'HIGH'} RISK
                    </span>
                  </div>
                  {authDecision.reasons && authDecision.reasons.length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Trigger: </span>
                      <strong>{authDecision.reasons[0]}</strong>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>
                  <span className="pulse-dot"></span>
                  <span>Listening for Authenticator decision in real time...</span>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', minHeight: '42px' }}
                  onClick={() => navigate('/')}
                >
                  Cancel & Return to Dashboard
                </button>
              </div>
            ) :

            /* CASE 3: Authenticated but Not Authorized / Denied / Expired */
            (authDecision.status === 'DENIED' || authDecision.status === 'EXPIRED' || (authDecision.authenticated && !authDecision.authorized && !authDecision.requiresAdditionalVerification)) ? (
              <div className="card text-center" style={{ padding: '32px 20px', border: '1.5px solid var(--danger-border)', background: 'var(--danger-soft)' }}>
                <ShieldAlert size={52} color="var(--danger)" style={{ margin: '0 auto 14px auto' }} />
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--danger)' }}>
                  {authDecision.status === 'EXPIRED' ? '⏰ Approval Request Expired' : '⛔ Payment Not Approved'}
                </h3>
                <p style={{ color: 'var(--text-primary)', fontSize: '14px', marginTop: '8px', lineHeight: '1.5' }}>
                  {authDecision.message || "Payment was not approved by the security authenticator."}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px', fontWeight: '600' }}>
                  No money has been taken from your account. Your balance is safe.
                </p>
                <button 
                  type="button"
                  className="btn btn-secondary mt-4" 
                  style={{ width: '100%' }}
                  onClick={() => navigate('/')}
                >
                  Return to Dashboard
                </button>
              </div>
            ) :

            /* CASE 1 & 5: Full Approval (Section 7 & 11: authenticated=true, authorized=true, requiresAdditionalVerification=false) */
            (authDecision.authenticated && authDecision.authorized) ? (
              <>
                <div style={{ 
                  padding: '12px 16px', 
                  borderRadius: '12px', 
                  background: 'var(--success-soft)', 
                  border: '1px solid var(--success-border)', 
                  color: 'var(--success)', 
                  fontSize: '13px', 
                  fontWeight: '700', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  marginBottom: '16px' 
                }}>
                  <ShieldCheck size={20} />
                  <span>✓ Payment Approved by Security Authenticator • Please Personally Confirm Below</span>
                </div>

                <RiskAlert 
                  riskAssessment={riskAssessment}
                  recipient={recipient}
                  amount={amount}
                  purpose={purpose}
                  onConfirm={confirmPayment}
                  onCancel={() => navigate('/')}
                />
              </>
            ) : null
          )}
        </>
      )}
    </div>
  );
};

export default SendMoneyFlow;
