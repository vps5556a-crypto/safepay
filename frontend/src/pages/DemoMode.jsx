import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Sparkles, ShieldCheck, ShieldAlert, ArrowRight, ArrowLeft, RefreshCw, Wallet, AlertOctagon, Lock, KeyRound, MessageSquareText, CheckCircle2, Volume2 } from 'lucide-react';
import { speakText } from '../utils/voiceAssistant';

const DEMO_SCENARIOS = [
  {
    id: 1,
    badge: 'Scenario 1 • Standard Payment (< ₹20,000)',
    title: '₹500 Everyday Payment (Immediate Approval)',
    description: 'User sends ₹500 to trusted friend Rahul Kumar with note "Dinner split".',
    booleanResponse: '{ authenticated: true, authorized: true, requiresAdditionalVerification: false }',
    balanceImpact: 'Deducts ₹500 from balance (₹25,000 → ₹24,500)',
    expected: '✓ CASE 1: Immediate Approval • Backend issues authorization token automatically',
    stateType: 'approved',
    params: {
      recipient: 'Rahul Kumar',
      upiId: 'rahul@upi',
      amount: '500',
      purpose: 'Dinner split',
      isNew: false
    }
  },
  {
    id: 2,
    badge: 'Scenario 2 • Large Payment (≥ Limit Set by Authenticator)',
    title: '₹25,000 High-Value Transfer (Secondary PIN Required)',
    description: 'User enters ₹25,000. Authenticator security policy requires secondary security PIN verification before authorization.',
    booleanResponse: '{ authenticated: true, authorized: false, requiresAdditionalVerification: true }',
    balanceImpact: 'Deducts ₹25,000 ONLY after PIN 1234 is verified by backend',
    expected: '⚠️ CASE 4: Step-Up Verification • Enter PIN 1234 to obtain backend authorization token',
    stateType: 'verify',
    params: {
      recipient: 'Rahul Kumar',
      upiId: 'rahul@upi',
      amount: '25000',
      purpose: 'Annual family contribution',
      isNew: false
    }
  },
  {
    id: 3,
    badge: 'Scenario 3 • Authentication Failed',
    title: 'Verification Failed (Invalid Credentials)',
    description: 'Simulates an authentication failure where the user credentials or PIN fail backend validation.',
    booleanResponse: '{ authenticated: false, authorized: false, requiresAdditionalVerification: false }',
    balanceImpact: 'Balance unchanged (₹0 deducted) • Money remains in account',
    expected: '❌ CASE 2: Verification Failed • Frontend displays error screen, transaction stopped',
    stateType: 'failed',
    params: {
      recipient: 'Priya Sharma',
      upiId: 'priya@okhdfcbank',
      amount: '22000',
      purpose: 'Security test transaction',
      isNew: false,
      simulationMode: 'FAIL_AUTH'
    }
  },
  {
    id: 4,
    badge: 'Scenario 4 • Authenticated But Denied by Policy',
    title: 'Policy Denial (Confirmed Scam / Fraud Signals)',
    description: 'User authenticates, but SafePay backend policy denies authorization due to confirmed fraudulent patterns.',
    booleanResponse: '{ authenticated: true, authorized: false, requiresAdditionalVerification: false }',
    balanceImpact: 'Balance unchanged (₹0 deducted) • Transaction blocked by policy',
    expected: '⛔ CASE 3: Payment Not Approved • Frontend stops transaction unconditionally',
    stateType: 'denied',
    params: {
      recipient: 'Lottery Reward Verification Desk',
      upiId: 'lottery_verify@paytm',
      amount: '5000',
      purpose: 'Fee for fake prize claim',
      isNew: true,
      simulationMode: 'DENY'
    }
  },
  {
    id: 5,
    badge: 'Scenario 5 • Overdraft Protection',
    title: '₹50,000 Transfer (Exceeds Balance)',
    description: 'User attempts to send ₹50,000 which exceeds the available funds in the account.',
    booleanResponse: '{ success: false, error: "INSUFFICIENT_BALANCE" }',
    balanceImpact: 'Rejected by backend: Account balance remains untouched',
    expected: '⛔ Overdraft Guard: Backend rejects with INSUFFICIENT_BALANCE (HTTP 400)',
    stateType: 'failed',
    params: {
      recipient: 'Priya Sharma',
      upiId: 'priya@okhdfcbank',
      amount: '50000',
      purpose: 'Emergency family fund',
      isNew: false
    }
  }
];

// 6 Canonical NLP Model Demonstrations from Section 33
const NLP_TEST_CASES = [
  {
    type: 'Legitimate Banking',
    text: 'Your UPI payment of ₹500 was successful.',
    expectedStatus: '✓ Looks normal',
    expectedRisk: 'LOW',
    category: 'LEGITIMATE',
    isScam: false
  },
  {
    type: 'Bank Phishing',
    text: 'Your account will be blocked today. Send ₹2,000 immediately.',
    expectedStatus: '🚨 Scam risk detected',
    expectedRisk: 'CRITICAL',
    category: 'BANK_PHISHING',
    isScam: true
  },
  {
    type: 'OTP Theft',
    text: 'Share your OTP to complete the refund.',
    expectedStatus: '🚨 Scam risk detected',
    expectedRisk: 'CRITICAL',
    category: 'OTP_THEFT',
    isScam: true,
    voice: 'Warning. Scam risk detected. Never share your OTP or PIN.'
  },
  {
    type: 'Prize Scam',
    text: 'You won ₹50,000. Pay ₹500 processing fee.',
    expectedStatus: '🚨 Scam risk detected',
    expectedRisk: 'HIGH',
    category: 'PRIZE_SCAM',
    isScam: true
  },
  {
    type: 'Job Scam',
    text: 'Earn ₹5,000 daily from home. Pay ₹999 registration fee.',
    expectedStatus: '⚠️ Potential scam',
    expectedRisk: 'HIGH',
    category: 'JOB_SCAM',
    isScam: true
  },
  {
    type: 'Legitimate Personal',
    text: 'Please send me ₹500 for groceries. I\'ll return it tonight.',
    expectedStatus: '✓ Looks normal',
    expectedRisk: 'LOW',
    category: 'LEGITIMATE',
    isScam: false
  }
];

// 7 Canonical Multilingual Voice-Guided Assistant Scenarios (Section 50)
const ASSISTANT_DEMO_SCENARIOS = [
  {
    id: 'demo-1',
    num: 'DEMO 1',
    title: 'Hindi Voice Payment Guidance',
    userQuery: 'मुझे पैसे भेजने हैं',
    language: 'Hindi (हिन्दी)',
    expectedBehavior: 'Assistant responds in Hindi, explains Step 1 ("Send Money दबाएं"), and asks who to pay.',
    voiceScript: 'हाँ, मैं मदद करूँगा। पहले होम स्क्रीन पर Send Money बटन दबाएं। आप किसे पैसे भेजना चाहते हैं?'
  },
  {
    id: 'demo-2',
    num: 'DEMO 2',
    title: 'Tamil Voice Guidance',
    userQuery: 'எப்படி பணம் அனுப்புவது?',
    language: 'Tamil (தமிழ்)',
    expectedBehavior: 'Assistant responds in Tamil and explains how to send money step-by-step.',
    voiceScript: 'கண்டிப்பாக நான் உதவுகிறேன். முகப்புத் திரையில் Send Money என்பதைத் தொடவும். யாருக்கு பணம் அனுப்ப வேண்டும்?'
  },
  {
    id: 'demo-3',
    num: 'DEMO 3',
    title: 'Tanglish Payment Preparation',
    userQuery: 'Ravi ku 500 send pannanum',
    language: 'Tanglish / Code-mixed',
    expectedBehavior: 'Understands colloquial Tanglish, extracts Recipient: Ravi, Amount: ₹500, prepares payment, and asks for physical user confirmation.',
    voiceScript: 'Neenga Ravi ku ₹500 anuppa poringa. Details check pannitu neengale Confirm Payment press pannunga.'
  },
  {
    id: 'demo-4',
    num: 'DEMO 4',
    title: 'OTP Theft Scam Interception',
    userQuery: 'Someone is asking for OTP',
    language: 'English',
    expectedBehavior: 'Immediately intercepts OTP sharing with a critical safety alert and instructs user to hang up.',
    voiceScript: 'DANGER! Never share your OTP code with anyone. Hang up immediately.'
  },
  {
    id: 'demo-5',
    num: 'DEMO 5',
    title: 'Lottery / Advance-Fee Scam Warning',
    userQuery: 'I won ₹50,000 but they want ₹500',
    language: 'English',
    expectedBehavior: 'Identifies advance-fee scam, warns that genuine lotteries never require fees upfront, and advises blocking the sender.',
    voiceScript: 'Warning! This message is a scam. Genuine lotteries never ask for fee upfront.'
  },
  {
    id: 'demo-6',
    num: 'DEMO 6',
    title: 'Large-Payment Authentication Warning',
    userQuery: 'Send ₹25,000 to Ravi',
    language: 'English',
    expectedBehavior: 'Detects transfer exceeds threshold, warns of high-value payment, prepares review details, and states secondary verification will be required.',
    voiceScript: 'You are sending ₹25,000 to Ravi. This is a large payment. Please check details carefully.'
  },
  {
    id: 'demo-7',
    num: 'DEMO 7',
    title: 'Screen & Risk Explanation',
    userQuery: 'What does this red warning mean?',
    language: 'English',
    expectedBehavior: 'Explains that red warning indicates severe risk/scam, and advises user not to confirm payment unless personally verified.',
    voiceScript: 'Red warning means DANGER. Stop and do not pay unless you personally know this person.'
  }
];

const DemoMode = () => {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const [nlpTestingResults, setNlpTestingResults] = useState({});
  const [assistantDemoResults, setAssistantDemoResults] = useState({});
  const [assistantTestingLoading, setAssistantTestingLoading] = useState({});
  const [activeTab, setActiveTab] = useState('assistant'); // 'assistant', 'nlp', or 'payment'

  const fetchAccount = () => {
    fetch('http://localhost:3001/api/account')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAccount(data.account);
        }
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchAccount();
  }, []);

  const handleResetBalance = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('http://localhost:3001/api/account/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAccount(data.account);
      }
    } catch (err) {
      console.error('Failed to reset account:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const runNlpTest = async (testCase, index) => {
    try {
      const res = await fetch('http://localhost:3001/api/messages/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testCase.text })
      });
      const data = await res.json();
      setNlpTestingResults(prev => ({ ...prev, [index]: data }));

      if (data.voiceAlertText) {
        speakText(data.voiceAlertText);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const runAssistantDemo = async (scenario, index) => {
    setAssistantTestingLoading(prev => ({ ...prev, [index]: true }));
    try {
      const res = await fetch('http://localhost:3001/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: scenario.userQuery })
      });
      const data = await res.json();
      setAssistantDemoResults(prev => ({ ...prev, [index]: data }));

      if (data.voiceScript) {
        speakText(data.voiceScript, { lang: data.language });
      }
    } catch (e) {
      console.error('Assistant demo failed:', e);
    } finally {
      setAssistantTestingLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  const runScenario = (scenario) => {
    navigate('/send', { state: scenario.params });
  };

  return (
    <div>
      <div className="card-title-row mb-3">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <Sparkles size={22} color="var(--primary)" />
            SafePay Interactive Demo Suite
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Live interactive demonstrations of the Voice-Guided Financial Assistant, Trained NLP Classifier & Authorization Engine.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'assistant' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, minWidth: '160px', minHeight: '42px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          onClick={() => setActiveTab('assistant')}
        >
          <Sparkles size={16} />
          Voice Assistant (7 Demos)
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'nlp' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, minWidth: '160px', minHeight: '42px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          onClick={() => setActiveTab('nlp')}
        >
          <MessageSquareText size={16} />
          NLP Scam Test Bench
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'payment' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, minWidth: '160px', minHeight: '42px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          onClick={() => setActiveTab('payment')}
        >
          <Lock size={16} />
          Boolean Authorization
        </button>
      </div>

      {/* TAB 0: MULTILINGUAL VOICE-GUIDED ASSISTANT DEMOS (Section 50) */}
      {activeTab === 'assistant' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="card" style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              <strong>Multilingual Voice-Guided Financial Assistant:</strong> Designed for low digital literacy users. 
              Supports English, Hindi, Tamil, Hinglish, and Tanglish. Click any demo below to test intent understanding, scam interception, and real-time voice synthesis aloud.
            </div>
          </div>

          {ASSISTANT_DEMO_SCENARIOS.map((demo, idx) => {
            const result = assistantDemoResults[idx];
            const isLoading = assistantTestingLoading[idx];

            return (
              <div key={demo.id} className="card demo-scenario-card scenario-safe">
                <div className="flex justify-between items-center mb-2">
                  <span className="badge" style={{ background: 'var(--primary-gradient)', color: '#FFFFFF', fontWeight: '800' }}>
                    {demo.num} • {demo.title}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                    {demo.language}
                  </span>
                </div>

                <div style={{ background: 'var(--surface-soft)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', margin: '8px 0' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>USER SAYS / SPEAKS:</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                    "{demo.userQuery}"
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 12px 0' }}>
                  <strong>Expected:</strong> {demo.expectedBehavior}
                </p>

                {result ? (
                  <div style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: result.safetyWarning ? 'var(--danger-soft)' : 'var(--background)',
                    border: `1.5px solid ${result.safetyWarning ? 'var(--danger-border)' : 'var(--primary)'}`,
                    marginBottom: '12px',
                    animation: 'slideDown 0.2s ease-out'
                  }}>
                    {result.safetyWarning && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', fontWeight: '800', fontSize: '13px', marginBottom: '8px' }}>
                        <ShieldAlert size={16} />
                        <span>{result.safetyWarning}</span>
                      </div>
                    )}

                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.5', marginBottom: '8px' }}>
                      💬 <strong>Assistant Reply:</strong> {result.reply}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                      <span><strong>Language:</strong> {result.language?.toUpperCase()}</span>
                      <span><strong>Intent:</strong> {result.intent}</span>
                      {result.actionData?.amount && <span><strong>Amount:</strong> ₹{result.actionData.amount}</span>}
                      {result.actionData?.recipient && <span><strong>Recipient:</strong> {result.actionData.recipient}</span>}
                      {result.nextAction && <span><strong>Next Action:</strong> {result.nextAction}</span>}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button 
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => speakText(result.voiceScript || result.reply, { lang: result.language })}
                      >
                        <Volume2 size={14} /> Replay Audio
                      </button>

                      {result.nextAction === 'PREPARE_PAYMENT' && result.actionData && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => navigate('/send', { state: { recipient: result.actionData.recipient, amount: result.actionData.amount } })}
                        >
                          👉 Open in Payment Screen
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', minHeight: '38px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  disabled={isLoading}
                  onClick={() => runAssistantDemo(demo, idx)}
                >
                  <Play size={14} />
                  {isLoading ? 'Running Assistant AI...' : '🚀 Test Assistant Voice Flow'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 1: NLP MODEL TEST BENCH */}
      {activeTab === 'nlp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="card" style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              <strong>Trained NLP Classifier Active (v1.0):</strong> Tested against 895 labeled samples (97.8% Accuracy, 100% Scam Recall). 
              Click below to test the canonical scam and legitimate messages.
            </div>
          </div>

          {NLP_TEST_CASES.map((tc, idx) => {
            const result = nlpTestingResults[idx];

            return (
              <div key={idx} className={`card demo-scenario-card ${tc.isScam ? 'scenario-scam' : 'scenario-safe'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="badge" style={{
                    background: tc.isScam ? 'var(--danger-soft)' : 'var(--success-soft)',
                    color: tc.isScam ? 'var(--danger)' : 'var(--success)',
                    border: `1px solid ${tc.isScam ? 'var(--danger-border)' : 'var(--success-border)'}`
                  }}>
                    {tc.type}
                  </span>

                  <span style={{ fontSize: '12px', fontWeight: '700', color: tc.isScam ? 'var(--danger)' : 'var(--success)' }}>
                    Expected: {tc.expectedStatus}
                  </span>
                </div>

                <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontStyle: 'italic', background: 'var(--surface-soft)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', margin: '6px 0 10px 0' }}>
                  "{tc.text}"
                </p>

                {result ? (
                  <div style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: result.classification.isScam ? 'var(--danger-soft)' : 'var(--success-soft)',
                    border: `1px solid ${result.classification.isScam ? 'var(--danger-border)' : 'var(--success-border)'}`,
                    marginBottom: '10px'
                  }}>
                    <div className="flex justify-between items-center mb-1">
                      <strong style={{ fontSize: '13px', color: result.classification.isScam ? 'var(--danger)' : 'var(--success)' }}>
                        {result.classification.isScam ? '🚨 Scam risk detected' : '✓ Looks normal'}
                      </strong>
                      <span className="badge" style={{
                        background: result.risk.level === 'CRITICAL' ? 'var(--danger)' : result.risk.level === 'HIGH' ? 'var(--warning)' : 'var(--success)',
                        color: 'white'
                      }}>
                        {result.risk.level} RISK (Score: {result.risk.score}/100)
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                      {result.userMessage}
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Category: <strong>{result.classification.category}</strong> • Confidence: {Math.round(result.classification.confidence * 100)}%
                    </div>
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 2, minHeight: '38px', fontSize: '13px' }}
                    onClick={() => runNlpTest(tc, idx)}
                  >
                    <Play size={14} />
                    Run NLP Prediction →
                  </button>

                  {tc.voice && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ flex: 1, minHeight: '38px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      onClick={() => speakText(tc.voice)}
                    >
                      <Volume2 size={14} />
                      Voice
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: BOOLEAN AUTHORIZATION FLOW */}
      {activeTab === 'payment' && (
        <>
          {/* Live Account Balance Synchronization Card */}
          <div className="card" style={{ background: 'var(--surface-soft)', border: '1.5px solid var(--border)', marginBottom: '18px' }}>
            <div className="flex justify-between items-center">
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wallet size={15} color="var(--primary)" />
                  <span>Current Authoritative Balance</span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                  ₹{account?.balance !== undefined 
                    ? account.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                    : '25,000.00'}
                </div>
              </div>

              <button 
                type="button" 
                className="btn btn-secondary"
                style={{ padding: '8px 14px', fontSize: '12px', minHeight: '38px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={handleResetBalance}
                disabled={isResetting}
                title="Reset account balance back to ₹25,000.00"
              >
                <RefreshCw size={14} className={isResetting ? 'spin' : ''} />
                <span>{isResetting ? 'Resetting...' : 'Reset to ₹25,000'}</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {DEMO_SCENARIOS.map((scenario) => {
              const isScam = scenario.stateType === 'denied';
              const isVerify = scenario.stateType === 'verify';
              const isFailed = scenario.stateType === 'failed';

              return (
                <div 
                  key={scenario.id}
                  className={`card demo-scenario-card ${isScam || isFailed ? 'scenario-scam' : isVerify ? 'scenario-medium' : 'scenario-safe'}`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="badge" style={{
                      background: isScam || isFailed ? 'var(--danger-soft)' : isVerify ? 'var(--warning-soft)' : 'var(--success-soft)',
                      color: isScam || isFailed ? 'var(--danger)' : isVerify ? 'var(--warning)' : 'var(--success)',
                      border: `1px solid ${isScam || isFailed ? 'var(--danger-border)' : isVerify ? 'var(--warning-border)' : 'var(--success-border)'}`
                    }}>
                      {scenario.badge}
                    </span>

                    {isScam || isFailed ? (
                      <ShieldAlert size={18} color="var(--danger)" />
                    ) : isVerify ? (
                      <Lock size={18} color="var(--warning)" />
                    ) : (
                      <ShieldCheck size={18} color="var(--success)" />
                    )}
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px', color: 'var(--text-primary)' }}>
                    {scenario.title}
                  </h3>

                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: '1.4' }}>
                    {scenario.description}
                  </p>

                  <div style={{ background: 'var(--surface-soft)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Backend Response: </span>
                    {scenario.booleanResponse}
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    <strong>Balance Impact:</strong> {scenario.balanceImpact}
                  </div>

                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: '700', 
                    color: isScam || isFailed ? 'var(--danger)' : isVerify ? 'var(--warning)' : 'var(--success)',
                    background: isScam || isFailed ? 'var(--danger-soft)' : isVerify ? 'var(--warning-soft)' : 'var(--success-soft)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    marginBottom: '14px'
                  }}>
                    {scenario.expected}
                  </div>

                  <button 
                    className={`btn ${isScam || isFailed ? 'btn-danger' : isVerify ? 'btn-primary' : 'btn-primary'}`}
                    style={{ minHeight: '44px', padding: '10px 14px', fontSize: '14px' }}
                    onClick={() => runScenario(scenario)}
                  >
                    <Play size={16} />
                    Run This Scenario →
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <button 
        className="btn btn-secondary mt-4 mb-4" 
        onClick={() => navigate('/')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>
    </div>
  );
};

export default DemoMode;
