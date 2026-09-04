import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, Shield, AlertTriangle, Volume2, Sparkles, Send, Copy, ArrowRight, CheckCircle2, Lock, AlertOctagon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { speakText, stopSpeaking } from '../utils/voiceAssistant';

const INITIAL_MESSAGES = [
  {
    id: 'msg-1',
    sender: 'Bank Security Alert',
    text: 'Your bank account will be blocked today. Send ₹2,000 immediately to verify your account.',
    time: 'Today • 10:42 AM',
    tag: 'SMS Alert'
  },
  {
    id: 'msg-2',
    sender: 'Lucky Rewards Desk',
    text: 'Congratulations! You won ₹50,000. Send ₹500 processing fee to claim your prize.',
    time: 'Yesterday • 3:15 PM',
    tag: 'Prize Claim'
  },
  {
    id: 'msg-3',
    sender: 'Customer Support Desk',
    text: 'Share the OTP you received to complete your refund.',
    time: 'Yesterday • 11:20 AM',
    tag: 'OTP Request'
  },
  {
    id: 'msg-4',
    sender: 'Rahul Kumar (Friend)',
    text: 'Please send me ₹500 for the groceries. I\'ll return it tonight.',
    time: 'Aug 30 • 9:00 AM',
    tag: 'Personal Message'
  },
  {
    id: 'msg-5',
    sender: 'HDFC Bank',
    text: 'Your UPI payment of ₹500 to Rahul was successful.',
    time: 'Aug 29 • 2:10 PM',
    tag: 'Bank Notification'
  }
];

const Messages = ({ isSimpleMode }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [analysisResults, setAnalysisResults] = useState({});
  const [analyzingIds, setAnalyzingIds] = useState(new Set());
  const [customText, setCustomText] = useState('');
  const [isScanningCustom, setIsScanningCustom] = useState(false);
  const [customResult, setCustomResult] = useState(null);

  // Proactive automatic monitoring on load (Section 14 & 30: No manual Analyze button required)
  useEffect(() => {
    messages.forEach(msg => {
      if (!analysisResults[msg.id]) {
        analyzeMessageProactively(msg.id, msg.text);
      }
    });
  }, [messages]);

  const analyzeMessageProactively = async (msgId, text) => {
    setAnalyzingIds(prev => new Set(prev).add(msgId));
    try {
      const res = await fetch('http://localhost:3001/api/messages/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msgId, text })
      });
      const data = await res.json();
      setAnalysisResults(prev => ({ ...prev, [msgId]: data }));
    } catch (err) {
      console.error('Proactive message analysis error:', err);
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(msgId);
        return next;
      });
    }
  };

  const handleCustomScan = async (e) => {
    e.preventDefault();
    if (!customText.trim()) return;

    setIsScanningCustom(true);
    try {
      const res = await fetch('http://localhost:3001/api/messages/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: customText })
      });
      const data = await res.json();
      setCustomResult(data);

      // Voice alert for high / critical (Section 31)
      if (data.voiceAlertText) {
        speakText(data.voiceAlertText);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanningCustom(false);
    }
  };

  const handlePayFromMessage = (msg, result) => {
    const match = msg.text.match(/(?:₹|rs\.?|inr)\s*([0-9,]+)/i);
    const amt = match ? match[1].replace(/,/g, '') : '500';

    navigate('/send', {
      state: {
        recipient: msg.sender,
        amount: amt,
        purpose: msg.text,
        contextMessage: msg.text,
        isNew: result?.risk?.level === 'CRITICAL' || result?.risk?.level === 'HIGH'
      }
    });
  };

  return (
    <div>
      <div className="card-title-row mb-3">
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>
            Proactive Message Safety
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            SafePay automatically classifies incoming messages using a trained NLP scam dataset + rule engine.
          </p>
        </div>
      </div>

      {/* Real-time Text & SMS Testing Scanner */}
      <div className="card" style={{ border: '1.5px solid var(--border)', background: 'var(--surface-soft)', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <Sparkles size={18} color="var(--primary)" />
          Test Any SMS or Message with Trained NLP Model
        </h3>
        
        <form onSubmit={handleCustomScan}>
          <div className="input-group" style={{ marginBottom: '12px' }}>
            <textarea
              className="input-field"
              rows={2}
              style={{ resize: 'none', fontSize: '14px', lineHeight: '1.4' }}
              placeholder="Paste any suspicious SMS, WhatsApp message, or payment request..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ minHeight: '42px', padding: '10px 16px', fontSize: '14px' }}
            disabled={isScanningCustom || !customText.trim()}
          >
            {isScanningCustom ? 'Analyzing with SafePay NLP Model...' : 'Check Message with NLP Model →'}
          </button>
        </form>

        {/* Custom Scan Result */}
        {customResult && (
          <div style={{ marginTop: '16px' }}>
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              background: customResult.risk.level === 'CRITICAL' || customResult.risk.level === 'HIGH' ? 'var(--danger-soft)' : 'var(--success-soft)',
              border: `1.5px solid ${customResult.risk.level === 'CRITICAL' || customResult.risk.level === 'HIGH' ? 'var(--danger-border)' : 'var(--success-border)'}`,
              color: customResult.risk.level === 'CRITICAL' || customResult.risk.level === 'HIGH' ? 'var(--danger)' : 'var(--success)'
            }}>
              <div className="flex justify-between items-center mb-2">
                <strong style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {customResult.classification.isScam ? '🚨 Scam Threat Detected' : '✓ Looks Normal'}
                </strong>
                <span className="badge" style={{
                  background: customResult.risk.level === 'CRITICAL' ? 'var(--danger)' : customResult.risk.level === 'HIGH' ? 'var(--warning)' : 'var(--success)',
                  color: 'white',
                  fontWeight: '800'
                }}>
                  {customResult.risk.level} RISK (Score: {customResult.risk.score}/100)
                </span>
              </div>

              <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: 'var(--text-primary)' }}>
                Classification: <strong>{customResult.classification.category.replace(/_/g, ' ')}</strong> • Model: {customResult.classification.model} (Confidence: {Math.round(customResult.classification.confidence * 100)}%)
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 10px 0', lineHeight: '1.4' }}>
                {customResult.userMessage}
              </p>

              {customResult.voiceAlertText && (
                <button
                  type="button"
                  className="btn-voice"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => speakText(customResult.voiceAlertText)}
                >
                  <Volume2 size={14} />
                  Listen to Voice Warning
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Proactive Simulated Message Inbox */}
      <h3 className="section-title mb-3">Simulated Incoming Messages (Automatically Monitored)</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {messages.map((msg) => {
          const result = analysisResults[msg.id];
          const isAnalyzing = analyzingIds.has(msg.id);
          const isScam = result?.classification?.isScam;
          const isHighOrCritical = result?.risk?.level === 'CRITICAL' || result?.risk?.level === 'HIGH';

          return (
            <div key={msg.id} className="card" style={{ padding: '18px', position: 'relative' }}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="badge" style={{ background: 'var(--surface-soft)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    {msg.tag}
                  </span>
                  <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{msg.sender}</strong>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{msg.time}</span>
              </div>

              <p style={{ fontSize: '14px', lineHeight: '1.5', margin: '10px 0', color: 'var(--text-primary)', fontStyle: 'italic', background: 'var(--surface-soft)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                "{msg.text}"
              </p>

              {/* Proactive Automatic Assessment Display */}
              {isAnalyzing ? (
                <div style={{ padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  SafePay NLP model analyzing message silently...
                </div>
              ) : result ? (
                <div style={{
                  marginTop: '12px',
                  padding: '14px',
                  borderRadius: '12px',
                  background: isHighOrCritical ? 'var(--danger-soft)' : 'var(--success-soft)',
                  border: `1.5px solid ${isHighOrCritical ? 'var(--danger-border)' : 'var(--success-border)'}`,
                  color: isHighOrCritical ? 'var(--danger)' : 'var(--success)'
                }}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      {isHighOrCritical ? (
                        <ShieldAlert size={20} color="var(--danger)" />
                      ) : (
                        <ShieldCheck size={20} color="var(--success)" />
                      )}
                      <strong style={{ fontSize: '14px' }}>
                        {isHighOrCritical ? '🚨 Scam risk detected' : '✓ Looks normal'}
                      </strong>
                    </div>

                    <span className="badge" style={{
                      background: isHighOrCritical ? 'var(--danger)' : 'var(--success)',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}>
                      {result.risk.level} RISK
                    </span>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '4px 0 8px 0', lineHeight: '1.4' }}>
                    {result.userMessage}
                  </p>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    Category: <strong>{result.classification.category.replace(/_/g, ' ')}</strong> • NLP Model Confidence: {Math.round(result.classification.confidence * 100)}%
                  </div>

                  <div className="flex gap-2 items-center">
                    {result.voiceAlertText && (
                      <button 
                        type="button" 
                        className="btn-voice"
                        style={{ padding: '4px 10px', fontSize: '12px', margin: 0 }}
                        onClick={() => speakText(result.voiceAlertText)}
                      >
                        <Volume2 size={13} />
                        Voice Warning
                      </button>
                    )}

                    <button 
                      className="btn btn-secondary"
                      style={{ padding: '8px 12px', fontSize: '12px', minHeight: '36px', marginLeft: 'auto' }}
                      onClick={() => handlePayFromMessage(msg, result)}
                    >
                      Pay from Message →
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Messages;
