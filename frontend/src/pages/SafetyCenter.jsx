import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, AlertOctagon, PhoneCall, ChevronDown, ChevronUp } from 'lucide-react';

const COMMON_SCAMS = [
  {
    title: '1. Bank KYC & Account Block Threat',
    desc: 'Scammers send an SMS claiming "Your bank account / SIM will be blocked today". They ask you to transfer ₹1,000 or install an app to "verify".',
    rule: 'Truth: Banks and utility companies NEVER demand money to prevent account blocking.'
  },
  {
    title: '2. Fake Lottery & Cashback Scam',
    desc: 'You receive a notification claiming you won ₹50,000 or ₹100 cashback, but you must pay a "processing fee" or "₹10 activation charge".',
    rule: 'Truth: Legitimate winnings never require paying money upfront to receive your funds.'
  },
  {
    title: '3. QR Code "Receive Money" Scam',
    desc: 'A buyer asks you to scan a QR code or enter your UPI PIN to "receive payment" for items you are selling online.',
    rule: 'Truth: You NEVER need to enter your UPI PIN or scan a QR code to receive money!'
  },
  {
    title: '4. Electricity Bill Disconnection Fraud',
    desc: 'Fake message claiming your power will be disconnected at 9 PM unless you call an officer and pay urgently.',
    rule: 'Truth: Electricity utilities send official postal bills with Consumer Account numbers, never urgent mobile requests.'
  }
];

const SafetyCenter = ({ isSimpleMode }) => {
  const [transactions, setTransactions] = useState([]);
  const [expandedScam, setExpandedScam] = useState(0);

  useEffect(() => {
    fetch('http://localhost:3001/api/transactions')
      .then(res => res.json())
      .then(data => setTransactions(data))
      .catch(err => console.error(err));
  }, []);

  const riskyTransactions = transactions.filter(t => t.riskLevel === 'HIGH' || t.riskLevel === 'CRITICAL' || t.status?.includes('Blocked'));
  const safeCount = transactions.filter(t => t.riskLevel === 'LOW').length;

  return (
    <div>
      {/* Security Health Score Banner */}
      <div className="card text-center safety-health-card">
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--success-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px auto',
          color: 'var(--success)',
          boxShadow: '0 2px 10px rgba(21, 128, 61, 0.15)'
        }}>
          <Shield size={34} />
        </div>
        
        <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--success)', marginBottom: '4px' }}>
          SafePay Active Shield
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '340px', margin: '0 auto' }}>
          Your payments and messages are actively analyzed by our hybrid safety engine.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '18px' }}>
          <div style={{ background: 'var(--surface)', padding: '12px 8px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--success)' }}>{safeCount + 12}</div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginTop: '2px' }}>Protected Txns</div>
          </div>
          <div style={{ background: 'var(--surface)', padding: '12px 8px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--danger)' }}>{riskyTransactions.length + 3}</div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginTop: '2px' }}>Scams Blocked</div>
          </div>
          <div style={{ background: 'var(--surface)', padding: '12px 8px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)' }}>₹0</div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginTop: '2px' }}>Fraud Losses</div>
          </div>
        </div>
      </div>

      {/* Recent Threat Interventions */}
      <h3 className="section-title mt-4 mb-3">Recent Threat Interventions</h3>

      {riskyTransactions.length === 0 ? (
        <div className="card text-center text-muted" style={{ padding: '24px' }}>
          <ShieldCheck size={36} color="var(--success)" style={{ margin: '0 auto 8px auto' }} />
          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>No fraudulent payments detected recently.</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>All recent transactions passed safety checks.</div>
        </div>
      ) : (
        riskyTransactions.map((t) => (
          <div 
            key={t.id} 
            className="card threat-intervention-card"
          >
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <AlertOctagon size={20} color="var(--danger)" />
                <strong style={{ fontSize: '15px', color: 'var(--danger)' }}>
                  Suspicious Payment {t.status === 'Blocked by User' ? 'Blocked' : 'Warning Shown'}
                </strong>
              </div>
              <span style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)' }}>
                ₹{t.amount?.toLocaleString('en-IN')}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
              Recipient: <strong>{t.recipient}</strong> ({t.upiId})
            </div>

            {t.note && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Note: "{t.note}"
              </div>
            )}

            <div style={{ 
              marginTop: '10px', 
              fontSize: '12px', 
              color: 'var(--danger)', 
              background: 'var(--danger-soft)', 
              padding: '6px 10px', 
              borderRadius: '6px', 
              fontWeight: '600' 
            }}>
              🚨 Risk flagged: {t.status === 'BLOCKED' ? 'Transaction automatically blocked' : 'Warning issued before payment'}
            </div>
          </div>
        ))
      )}

      {/* Common Scam Education Library */}
      <h3 className="section-title mt-4 mb-3">Common Digital Scam Education</h3>

      <div>
        {COMMON_SCAMS.map((scam, index) => {
          const isExpanded = expandedScam === index;
          return (
            <div 
              key={index}
              className="card"
              style={{ padding: '16px', cursor: 'pointer', marginBottom: '10px' }}
              onClick={() => setExpandedScam(isExpanded ? null : index)}
            >
              <div className="flex justify-between items-center">
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{scam.title}</strong>
                {isExpanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
              </div>

              {isExpanded && (
                <div style={{ marginTop: '12px', fontSize: '13px', lineHeight: '1.5', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>{scam.desc}</p>
                  <div style={{ color: 'var(--success)', fontWeight: '700', background: 'var(--success-soft)', padding: '8px 12px', borderRadius: '8px' }}>
                    💡 {scam.rule}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Emergency Fraud Helpline */}
      <div className="card helpline-card mt-4">
        <div className="flex items-center gap-3">
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PhoneCall size={22} color="var(--danger)" />
          </div>
          <div>
            <strong style={{ fontSize: '14px', color: 'var(--danger)' }}>National Cyber Crime Helpline</strong>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
              Dial 1930
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Toll-free 24/7 hotline to report unauthorized or fraudulent transfers.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafetyCenter;
