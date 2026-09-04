const { analyzeMessageWithOllama, checkOllamaAvailability } = require('./ollamaService');
const { classifyMessage } = require('./nlpClassifier');

// Configurable Risk Thresholds (Section 9)
const RISK_THRESHOLDS = {
  LOW_MAX: 24,
  MEDIUM_MAX: 49,
  HIGH_MAX: 74,
  CRITICAL_MIN: 75
};

// Comprehensive Rule-Based Detection Patterns (Layer 2)
const RULES = [
  {
    category: 'BANK_PHISHING',
    name: 'Account Suspension Threat',
    patterns: [
      /account (will be|is) blocked/i,
      /block(ed)? today/i,
      /kyc (expired|pending|update)/i,
      /pan (card )?update/i,
      /electricity bill (due|disconnect)/i,
      /sim (card )?deactivat/i,
      /yono.*(suspend|block)/i
    ],
    score: 45,
    reason: 'Threatens that your bank account, SIM, or utility service will be blocked immediately',
    urgency: true,
    suspicious: true
  },
  {
    category: 'PAYMENT_REQUEST_SCAM',
    name: 'Verification / Processing Fee',
    patterns: [
      /send .* to verify/i,
      /verification fee/i,
      /processing fee/i,
      /activation fee/i,
      /refund fee/i,
      /pay .* to receive/i,
      /send .* to activate/i,
      /deposit .* (charge|fee)/i
    ],
    score: 40,
    reason: 'Asks you to pay money to verify, activate, or release funds',
    urgency: false,
    suspicious: true
  },
  {
    category: 'PRIZE_SCAM',
    name: 'Fake Prize / Lottery / Cashback',
    patterns: [
      /congratulations/i,
      /you (have )?won/i,
      /lottery/i,
      /cashback.*activate/i,
      /claim your prize/i,
      /lucky draw/i,
      /reward.*expire/i,
      /gift voucher/i
    ],
    score: 40,
    reason: 'Offers an unexpected prize, lottery, or reward requiring an advance fee',
    urgency: false,
    suspicious: true
  },
  {
    category: 'SOCIAL_ENGINEERING',
    name: 'Artificial Urgency / Panic',
    patterns: [
      /\b(immediately|urgently)\b/i,
      /within (10|15|30|5|2) (minutes|hours)/i,
      /act now/i,
      /arrest warrant/i,
      /police/i,
      /legal action/i,
      /cbi officer/i
    ],
    score: 35,
    reason: 'Creates urgent pressure or legal coercion to force an immediate transfer',
    urgency: true,
    suspicious: true
  },
  {
    category: 'OTP_THEFT',
    name: 'OTP / Security Code Theft',
    patterns: [
      /share (the |your )?otp/i,
      /tell (the |your )?otp/i,
      /\botp\b.*(verify|refund|cancel|reverse)/i,
      /read out the.*otp/i,
      /otp batayein/i
    ],
    score: 55,
    reason: 'Requests your confidential OTP or SMS security verification code',
    urgency: true,
    suspicious: true
  },
  {
    category: 'PIN_THEFT',
    name: 'UPI / ATM PIN Phishing',
    patterns: [
      /enter (your )?(upi )?pin to receive/i,
      /share (the |your )?pin/i,
      /type (your )?(upi )?pin/i,
      /pin dalein/i
    ],
    score: 60,
    reason: 'Falsely claims you need to enter your UPI PIN to receive money',
    urgency: true,
    suspicious: true
  },
  {
    category: 'MALICIOUS_LINK',
    name: 'Remote Access / Malicious Link',
    patterns: [
      /download (anydesk|teamviewer|quicksupport)/i,
      /install.*(anydesk|apk)/i,
      /http:\/\/\S+/i
    ],
    score: 40,
    reason: 'Directs you to install remote-access apps or visit untrusted links',
    urgency: false,
    suspicious: true
  }
];

// Context exceptions for genuine transfers to prevent false alarms
const LEGITIMATE_RECEIPT_PATTERNS = [
    /payment of .* was successful/i,
    /credited with/i,
    /sent to .* available balance/i,
    /recharge of .* successful/i,
    /order #.* delivered/i,
    /monthly statement.*generated/i
];

function ruleBasedAnalysis(message, recipient, amount, isNewRecipient) {
  if (!message && !recipient) {
    return {
      is_suspicious: false,
      risk_level: 'LOW',
      score: 0,
      reasons: [],
      scam_type: 'none',
      confidence: 0.5,
      payment_request_detected: false,
      sensitive_information_requested: false,
      recommended_action: 'Verify recipient before paying'
    };
  }

  const text = (message || '').trim();

  // Explicit check for routine banking receipts to avoid false alarms
  const isNormalReceipt = LEGITIMATE_RECEIPT_PATTERNS.some(p => p.test(text));
  if (isNormalReceipt) {
    return {
      is_suspicious: false,
      risk_level: 'LOW',
      risk_score: 0,
      reasons: ['Verified routine banking notification'],
      scam_type: 'none',
      confidence: 0.98,
      payment_request_detected: false,
      sensitive_information_requested: false,
      recommended_action: 'Standard transaction record.'
    };
  }

  let score = 0;
  const reasons = [];
  let detectedCategories = [];
  let isSensitive = false;
  let hasUrgency = false;

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        score += rule.score;
        reasons.push(rule.reason);
        detectedCategories.push(rule.category);
        if (rule.category === 'OTP_THEFT' || rule.category === 'PIN_THEFT') isSensitive = true;
        if (rule.urgency) hasUrgency = true;
        break;
      }
    }
  }

  // Factor in New Recipient
  if (isNewRecipient) {
    score += 20;
    reasons.push('First-time transfer to this recipient');
  }

  // Factor in Unusual/Large Amounts
  const parsedAmt = parseFloat(amount || 0);
  if (parsedAmt >= 20000) {
    score += 15;
    reasons.push(`High-value transaction (₹${parsedAmt.toLocaleString('en-IN')})`);
  }

  const isSuspicious = score >= 25 || isSensitive;
  let riskLevel = 'LOW';
  if (score >= RISK_THRESHOLDS.CRITICAL_MIN || isSensitive) riskLevel = 'CRITICAL';
  else if (score >= 50) riskLevel = 'HIGH';
  else if (score >= 25) riskLevel = 'MEDIUM';

  let scamType = detectedCategories.length > 0 ? detectedCategories[0] : (isSuspicious ? 'OTHER_FINANCIAL_SCAM' : 'none');

  let recommendedAction = 'Verify recipient details before proceeding.';
  if (isSensitive) {
    recommendedAction = 'NEVER share OTP, PIN, or install remote access apps.';
  } else if (hasUrgency) {
    recommendedAction = 'Pause and contact official support. Banks never demand immediate payments.';
  }

  return {
    is_suspicious: isSuspicious,
    risk_level: riskLevel,
    risk_score: Math.min(100, score),
    reasons,
    scam_type: scamType,
    confidence: isSuspicious ? 0.88 : 0.92,
    payment_request_detected: score > 0,
    sensitive_information_requested: isSensitive,
    recommended_action: recommendedAction
  };
}

/**
 * Proactive Hybrid Message Analyzer (Section 28)
 * Combines:
 * 1. Trained NLP Dataset Model (Pattern Recognition)
 * 2. Deterministic Rule Engine (Safety Invariants)
 * 3. Ollama / Gemini (Context & Intent Reasoning)
 */
async function analyzeMessageNLP(text, messageId = null) {
  const msgId = messageId || `msg-${Date.now()}`;
  const cleanMsg = (text || '').trim();

  // 1. Layer 1: NLP Trained Model Classification
  const nlpClassification = classifyMessage(cleanMsg);

  // 2. Layer 2: Deterministic Rule Analysis
  const ruleAnalysis = ruleBasedAnalysis(cleanMsg, null, 0, false);

  // 3. Layer 3: Contextual AI Analysis (Ollama / Gemini)
  let ollamaAnalysis = null;
  try {
    const isOllamaUp = await checkOllamaAvailability(400);
    if (isOllamaUp.available) {
      ollamaAnalysis = await analyzeMessageWithOllama({
        message: cleanMsg,
        recipient: '',
        amount: 0,
        isNewRecipient: false
      }, 1500);
    }
  } catch (err) {
    // Silent fallback to ML + Rules
  }

  // 4. Multi-Signal Hybrid Scoring (Section 8: 0–100)
  let nlpScore = 0;
  if (nlpClassification.is_scam) {
    nlpScore = Math.round(nlpClassification.confidence * 75);
    // Severities for critical theft
    if (nlpClassification.category === 'OTP_THEFT' || nlpClassification.category === 'PIN_THEFT') {
      nlpScore = Math.max(nlpScore, 85);
    }
  }

  const ruleScore = ruleAnalysis.risk_score;
  let aiScore = 0;
  if (ollamaAnalysis && ollamaAnalysis.is_suspicious) {
    aiScore = Math.round((ollamaAnalysis.confidence || 0.8) * 40);
  }

  // Combined score with balanced weighting
  let combinedScore = 0;
  if (!nlpClassification.is_scam && !ruleAnalysis.is_suspicious && (!ollamaAnalysis || !ollamaAnalysis.is_suspicious)) {
    // Both ML model and rules agreed it's legitimate
    combinedScore = 0;
  } else {
    combinedScore = Math.min(100, Math.round(nlpScore * 0.55 + ruleScore * 0.35 + aiScore * 0.10));
    if (nlpClassification.category === 'OTP_THEFT' || nlpClassification.category === 'PIN_THEFT') {
      combinedScore = Math.max(combinedScore, 85);
    } else if (nlpClassification.is_scam && combinedScore < 50) {
      combinedScore = 55;
    }
  }

  // Determine Final Risk Level
  let riskLevel = 'LOW';
  if (combinedScore >= RISK_THRESHOLDS.CRITICAL_MIN) riskLevel = 'CRITICAL';
  else if (combinedScore >= 50) riskLevel = 'HIGH';
  else if (combinedScore >= 25) riskLevel = 'MEDIUM';

  // User-facing simple explanation (Section 29)
  let userMessage = 'This message looks normal. No safety risk detected.';
  let category = nlpClassification.category;

  if (category === 'OTP_THEFT') {
    userMessage = 'Scam risk detected. Never share your OTP or security code with anyone.';
  } else if (category === 'PIN_THEFT') {
    userMessage = 'Scam risk detected. You NEVER need to enter your UPI PIN to receive money.';
  } else if (category === 'BANK_PHISHING') {
    userMessage = 'Potential bank phishing. This message threatens account blocking to force payment.';
  } else if (category === 'PRIZE_SCAM' || category === 'LOTTERY_SCAM') {
    userMessage = 'Fake prize alert. Legitimate rewards never ask you to pay a processing fee.';
  } else if (category === 'KYC_SCAM') {
    userMessage = 'Suspicious KYC request. Banks never threaten account deactivation via SMS links.';
  } else if (category === 'JOB_SCAM') {
    userMessage = 'Potential employment fraud. Legitimate jobs do not require advance registration fees.';
  } else if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
    userMessage = 'This message may be a scam. Do not send money until you verify the sender.';
  }

  return {
    messageId: msgId,
    classification: {
      isScam: nlpClassification.is_scam,
      category: nlpClassification.category,
      confidence: nlpClassification.confidence,
      model: nlpClassification.model
    },
    risk: {
      level: riskLevel,
      score: combinedScore
    },
    signals: {
      mlScore: nlpScore,
      ruleScore: ruleScore,
      aiScore: aiScore
    },
    userMessage,
    voiceAlertText: (riskLevel === 'HIGH' || riskLevel === 'CRITICAL')
      ? (category === 'OTP_THEFT' || category === 'PIN_THEFT'
          ? 'Warning. Scam risk detected. Never share your OTP or PIN.'
          : 'Warning. This message may be a scam. Do not send money.')
      : null
  };
}

/**
 * End-to-end Transaction Risk Calculator combining ML + Rules + Context
 */
async function calculateTransactionRisk(context) {
  const { message, recipient, amount, isNewRecipient } = context;

  // 1. NLP Classification of context/purpose message
  const nlpResult = classifyMessage(message || '');

  // 2. Deterministic Rule Analysis
  const ruleResult = ruleBasedAnalysis(message, recipient, amount, isNewRecipient);

  // 3. Ollama AI Context Analysis
  let ollamaResult = null;
  let engineUsed = `SafePay NLP Model (${nlpResult.model}) + Heuristics`;

  if (message && message.trim().length > 0) {
    try {
      ollamaResult = await analyzeMessageWithOllama(context);
      if (ollamaResult) {
        engineUsed = `SafePay NLP Model (${nlpResult.model}) + Rules + Ollama AI`;
      }
    } catch (e) {
      // Graceful fallback
    }
  }

  // 4. Combine Signals
  let combinedScore = ruleResult.risk_score;
  const combinedReasons = [...ruleResult.reasons];
  let finalScamType = ruleResult.scam_type;
  let finalRecommended = ruleResult.recommended_action;
  let finalSuspicious = ruleResult.is_suspicious;

  // Integrate NLP model prediction
  if (nlpResult.is_scam) {
    finalSuspicious = true;
    finalScamType = nlpResult.category;
    const nlpWeight = Math.round(nlpResult.confidence * 45);
    combinedScore = Math.min(100, combinedScore + nlpWeight);
    combinedReasons.unshift(`NLP Model detected pattern matching ${nlpResult.category.replace(/_/g, ' ')} (${Math.round(nlpResult.confidence * 100)}% confidence)`);
    
    if (nlpResult.category === 'OTP_THEFT' || nlpResult.category === 'PIN_THEFT') {
      finalRecommended = 'NEVER share your OTP or UPI PIN to receive money.';
      combinedScore = Math.max(combinedScore, 85);
    } else if (nlpResult.category === 'BANK_PHISHING') {
      finalRecommended = 'Do not send money. Contact your bank directly through official app.';
      combinedScore = Math.max(combinedScore, 75);
    }
  }

  // Integrate Ollama LLM reasoning if present
  if (ollamaResult && typeof ollamaResult === 'object') {
    if (ollamaResult.reasons && Array.isArray(ollamaResult.reasons)) {
      combinedReasons.push(...ollamaResult.reasons);
    }
    if (ollamaResult.is_suspicious) {
      finalSuspicious = true;
      combinedScore = Math.min(100, combinedScore + Math.round((ollamaResult.confidence || 0.8) * 20));
    }
  }

  // Final Risk Level
  let finalRiskLevel = 'LOW';
  if (combinedScore >= RISK_THRESHOLDS.CRITICAL_MIN) finalRiskLevel = 'CRITICAL';
  else if (combinedScore >= 50) finalRiskLevel = 'HIGH';
  else if (combinedScore >= 25) finalRiskLevel = 'MEDIUM';

  const uniqueReasons = [...new Set(combinedReasons.filter(Boolean))];

  return {
    riskLevel: finalRiskLevel,
    riskScore: combinedScore,
    isSuspicious: finalSuspicious,
    scamType: finalScamType,
    confidence: nlpResult.is_scam ? nlpResult.confidence : ruleResult.confidence,
    reasons: uniqueReasons.length > 0 ? uniqueReasons : ['Standard transfer to contact'],
    paymentRequestDetected: ruleResult.payment_request_detected,
    sensitiveInformationRequested: ruleResult.sensitive_information_requested || nlpResult.category === 'OTP_THEFT',
    recommendedAction: finalRecommended,
    engineUsed,
    nlpClassification: nlpResult,
    aiAnalysis: ollamaResult || {
      is_suspicious: finalSuspicious,
      risk_level: finalRiskLevel,
      scam_type: finalScamType,
      confidence: nlpResult.confidence,
      reasons: uniqueReasons,
      recommended_action: finalRecommended,
      note: 'SafePay Multi-Signal NLP + Rule Protection'
    }
  };
}

module.exports = {
  calculateTransactionRisk,
  ruleBasedAnalysis,
  analyzeMessageNLP,
  RISK_THRESHOLDS
};
