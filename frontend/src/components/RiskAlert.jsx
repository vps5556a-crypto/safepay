import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertOctagon, ShieldCheck, Info, Volume2, VolumeX, CheckCircle, XCircle } from 'lucide-react';
import { speakText, stopSpeaking } from '../utils/voiceAssistant';

const RiskAlert = ({ riskAssessment, onConfirm, onCancel, recipient, amount, purpose }) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!riskAssessment) return null;

  const { riskLevel, reasons, recommendedAction, isSuspicious, scamType, engineUsed } = riskAssessment;

  const isHighRisk = riskLevel === 'CRITICAL' || riskLevel === 'HIGH';
  const isMediumRisk = riskLevel === 'MEDIUM';

  let alertClass = 'alert-low';
  let Icon = ShieldCheck;
  let title = 'Payment Safety Check: Safe';
  let simpleExplanation = 'Everything looks normal. Please verify the recipient and amount before continuing.';
  let tagClass = 'risk-tag-low';
  let tagText = '✓ Low Risk';

  if (riskLevel === 'CRITICAL') {
    alertClass = 'alert-critical';
    Icon = AlertOctagon;
    title = '⛔ Critical Scam Warning';
    simpleExplanation = 'This payment request contains severe signs of financial fraud. Sending money is extremely dangerous.';
    tagClass = 'risk-tag-critical';
    tagText = '⛔ Critical Risk';
  } else if (riskLevel === 'HIGH') {
    alertClass = 'alert-high';
    Icon = AlertTriangle;
    title = '⚠️ This payment may be unsafe';
    simpleExplanation = 'The message asking you to make this payment contains signs commonly associated with scams.';
    tagClass = 'risk-tag-high';
    tagText = '⚠ High Risk';
  } else if (riskLevel === 'MEDIUM') {
    alertClass = 'alert-medium';
    Icon = AlertTriangle;
    title = '⚠ Attention: Verify Recipient';
    simpleExplanation = 'This is a new recipient. Please make sure you know this person before sending money.';
    tagClass = 'risk-tag-medium';
    tagText = '⚠ Medium Risk';
  }

  // Speech narration
  const speechNarration = `
    ${title}.
    You are about to send ${amount || ''} rupees to ${recipient || 'recipient'}.
    ${simpleExplanation}
    ${reasons && reasons.length > 0 ? `Flagged reasons: ${reasons.join('. ')}` : ''}
    ${recommendedAction ? `Recommended action: ${recommendedAction}` : ''}
  `;

  const toggleVoice = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      speakText(speechNarration);
      setIsSpeaking(true);
      setTimeout(() => setIsSpeaking(false), 9000);
    }
  };

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  return (
    <div className={`risk-alert-box ${alertClass}`}>
      <div className="alert-header">
        <Icon size={26} />
        <div>
          <h3>{title}</h3>
          <div style={{ fontSize: '11px', fontWeight: '600', opacity: 0.85, marginTop: '2px' }}>
            AI Engine: {engineUsed || 'Hybrid Safety Engine'}
          </div>
        </div>
        <span className={`risk-tag ${tagClass}`}>{tagText}</span>
      </div>

      <p style={{ fontSize: '14px', lineHeight: '1.5', marginTop: '4px', fontWeight: '500' }}>
        {simpleExplanation}
      </p>

      {/* Voice Readout Button */}
      <button 
        type="button" 
        className="btn-voice"
        onClick={toggleVoice}
      >
        {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
        <span>{isSpeaking ? 'Stop Audio' : '🔊 Listen to Warning'}</span>
      </button>

      {/* Reasons breakdown */}
      {reasons && reasons.length > 0 && (
        <div className="reasons-box">
          <strong style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
            Why SafePay flagged this:
          </strong>
          <ul className="reasons-list" style={{ color: 'var(--text-secondary)' }}>
            {reasons.map((reason, index) => (
              <li key={index} style={{ marginBottom: '4px' }}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended Action */}
      {recommendedAction && (
        <div style={{ marginTop: '14px', fontSize: '13px', fontWeight: '700', color: 'inherit' }}>
          💡 <span>Recommended Action</span>: {recommendedAction}
        </div>
      )}

      {/* Explicit Acknowledgment Checkbox for High/Critical Risk */}
      {isHighRisk && (
        <label className="checkbox-ack-container">
          <input 
            type="checkbox" 
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span className="checkbox-ack-label">
            I understand the risk and want to continue
          </span>
        </label>
      )}

      {/* Action Buttons: Confirm is visually dominant, Cancel is clean */}
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {isHighRisk ? (
          <>
            <button 
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              style={{ fontWeight: '700', fontSize: '15px' }}
            >
              Cancel Payment (Recommended)
            </button>

            <button 
              type="button"
              className="btn btn-danger"
              disabled={!acknowledged}
              style={{ opacity: acknowledged ? 1 : 0.45, cursor: acknowledged ? 'pointer' : 'not-allowed' }}
              onClick={onConfirm}
            >
              I Understand the Risk & Continue
            </button>
          </>
        ) : (
          <>
            <div style={{ background: 'var(--background)', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              👉 <strong>Final Step:</strong> Please check the name and amount above. If everything is correct, press the blue <strong>Confirm Payment</strong> button below yourself.
            </div>

            <button 
              id="action-confirm-payment"
              type="button"
              className="btn btn-primary"
              onClick={onConfirm}
            >
              Confirm Payment
            </button>

            <button 
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default RiskAlert;
