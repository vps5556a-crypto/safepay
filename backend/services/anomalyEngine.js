/**
 * SafePay Anomaly & Velocity Detection Engine
 *
 * Implements:
 * 1. Rapid consecutive transaction detection (Velocity check)
 * 2. Cumulative transaction threshold within time windows
 * 3. Rapid repeated payments to the same recipient
 * 4. Unusually large payments (Dynamic threshold)
 * 5. Sudden jumps in transaction amounts vs user baseline
 * 6. New/unverified recipient detection
 * 7. Scam-message context correlation
 */

// In-memory store for detected anomalies
const anomaliesList = [
  {
    id: 'ANOM-101',
    severity: 'HIGH',
    type: 'LARGE_PAYMENT',
    title: 'High-Value Payment Detected',
    reason: 'Payment of ₹25,000 exceeds standard protection threshold',
    amount: 25000,
    recipient: 'Ravi',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    recommendedAction: 'Verify recipient identity and purpose before authorizing.'
  },
  {
    id: 'ANOM-102',
    severity: 'CRITICAL',
    type: 'SCAM_CONTEXT',
    title: 'Suspicious Scam Message Correlation',
    reason: 'Payment initiated immediately after receiving SMS with advance-fee lottery pattern',
    amount: 5000,
    recipient: 'Unknown Merchant',
    timestamp: new Date(Date.now() - 3600000 * 25).toISOString(),
    recommendedAction: 'Block transfer immediately. Do not share OTP or PIN.'
  }
];

// Recent message risk memory (stores last analyzed message risk context)
let lastScamMessageRisk = null;

function setLastScamMessageRisk(riskPayload) {
  lastScamMessageRisk = {
    ...riskPayload,
    timestamp: Date.now()
  };
}

function getLastScamMessageRisk() {
  if (!lastScamMessageRisk) return null;
  // Consider scam context active for 15 minutes
  if (Date.now() - lastScamMessageRisk.timestamp > 15 * 60 * 1000) {
    lastScamMessageRisk = null;
    return null;
  }
  return lastScamMessageRisk;
}

/**
 * Record a detected anomaly event
 */
function recordAnomaly({
  severity = 'MEDIUM',
  type = 'VELOCITY_ALERT',
  title,
  reason,
  amount,
  recipient,
  transactionId = null,
  recommendedAction = 'Review transaction details carefully'
}) {
  const anomaly = {
    id: `ANOM-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    severity,
    type,
    title: title || 'Anomalous Payment Activity',
    reason: reason || 'Unusual payment activity detected',
    amount: amount || 0,
    recipient: recipient || 'Unknown',
    transactionId,
    timestamp: new Date().toISOString(),
    recommendedAction
  };

  anomaliesList.unshift(anomaly);

  // Keep latest 100 anomalies
  if (anomaliesList.length > 100) {
    anomaliesList.pop();
  }

  return anomaly;
}

/**
 * Retrieve all recorded anomalies
 */
function getAnomalies(filterSeverity = null) {
  if (filterSeverity) {
    return anomaliesList.filter(a => a.severity === filterSeverity.toUpperCase());
  }
  return anomaliesList;
}

/**
 * Evaluate transaction behavior against velocity rules, cumulative amounts, and historical baseline
 */
function evaluateTransactionAnomalies({
  amount,
  recipient,
  upiId,
  isNewRecipient = false,
  allTransactions = [],
  config = {},
  messageContext = null
}) {
  const parsedAmount = parseFloat(amount) || 0;
  const now = Date.now();

  const largePaymentThreshold = config.largePaymentThreshold || 20000;
  const maxTransactionsInWindow = config.maxTransactionsInWindow || 3;
  const velocityWindowMinutes = config.velocityWindowMinutes || 5;
  const cumulativeAmountThreshold = config.cumulativeAmountThreshold || 20000;
  const windowMs = velocityWindowMinutes * 60 * 1000;

  const reasons = [];
  const detectedAnomalies = [];
  let riskScore = 0;
  let requiresApproval = false;

  // Filter DEBIT transactions completed or attempted within the velocity window
  const windowTransactions = allTransactions.filter(t => {
    if (!t.date) return false;
    const txnTime = new Date(t.date).getTime();
    return (now - txnTime) <= windowMs && t.type === 'DEBIT' && t.status !== 'BLOCKED';
  });

  // Calculate cumulative amount in window (prior transactions + current attempt)
  const windowAmountSum = windowTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const totalCumulativeAmount = windowAmountSum + parsedAmount;

  // 1. CHECK: Large Payment Rule
  if (parsedAmount >= largePaymentThreshold) {
    requiresApproval = true;
    riskScore += 45;
    reasons.push(`Large payment of ₹${parsedAmount.toLocaleString('en-IN')} (threshold is ₹${largePaymentThreshold.toLocaleString('en-IN')})`);
    
    detectedAnomalies.push({
      severity: parsedAmount >= largePaymentThreshold * 2 ? 'CRITICAL' : 'HIGH',
      type: 'LARGE_PAYMENT',
      title: 'High-Value Payment Alert',
      reason: `Transfer amount (₹${parsedAmount.toLocaleString('en-IN')}) equals or exceeds configured threshold (₹${largePaymentThreshold.toLocaleString('en-IN')})`,
      amount: parsedAmount,
      recipient,
      recommendedAction: 'Requires explicit Authenticator security verification.'
    });
  }

  // 2. CHECK: Rapid Velocity Rule (Multiple transactions in short window)
  if (windowTransactions.length >= maxTransactionsInWindow) {
    requiresApproval = true;
    riskScore += 40;
    reasons.push(`Rapid transaction velocity: ${windowTransactions.length + 1} payments attempted within ${velocityWindowMinutes} minutes`);
    
    detectedAnomalies.push({
      severity: 'HIGH',
      type: 'RAPID_VELOCITY',
      title: 'Velocity Limit Exceeded',
      reason: `User has initiated ${windowTransactions.length + 1} transactions in ${velocityWindowMinutes} minutes (configured limit: ${maxTransactionsInWindow})`,
      amount: parsedAmount,
      recipient,
      recommendedAction: 'Investigate possible coercion, automated bot, or rapid fraud attempts.'
    });
  }

  // 3. CHECK: Cumulative Transaction Risk (Sum across short window)
  if (totalCumulativeAmount >= cumulativeAmountThreshold && windowTransactions.length > 0) {
    requiresApproval = true;
    riskScore += 35;
    reasons.push(`Cumulative velocity threshold reached: ₹${totalCumulativeAmount.toLocaleString('en-IN')} across ${windowTransactions.length + 1} transactions in ${velocityWindowMinutes} minutes`);
    
    detectedAnomalies.push({
      severity: 'HIGH',
      type: 'CUMULATIVE_ACTIVITY',
      title: 'High Cumulative Velocity',
      reason: `Multiple transactions resulted in cumulative outflow of ₹${totalCumulativeAmount.toLocaleString('en-IN')} within ${velocityWindowMinutes} minutes`,
      amount: parsedAmount,
      recipient,
      recommendedAction: 'Security authorizer must approve cumulative outflow.'
    });
  }

  // 4. CHECK: Rapid Repeated Payments to the Same Recipient
  const sameRecipientRecent = windowTransactions.filter(t => 
    t.recipient && t.recipient.toLowerCase() === (recipient || '').toLowerCase()
  );

  if (sameRecipientRecent.length >= 2) {
    requiresApproval = true;
    riskScore += 35;
    reasons.push(`Rapid repeat payments: ${sameRecipientRecent.length + 1} transfers to "${recipient}" in ${velocityWindowMinutes} minutes`);
    
    detectedAnomalies.push({
      severity: 'HIGH',
      type: 'REPEATED_RECIPIENT',
      title: 'Repeat Recipient Spike',
      reason: `User sent ${sameRecipientRecent.length + 1} consecutive payments to ${recipient} in under ${velocityWindowMinutes} minutes`,
      amount: parsedAmount,
      recipient,
      recommendedAction: 'Verify if recipient is genuine or if user is being pressured.'
    });
  }

  // 5. CHECK: Sudden Spike vs Historical Average (Outlier Detection)
  const historicalDebits = allTransactions.filter(t => t.type === 'DEBIT' && t.status === 'SUCCESS').slice(0, 10);
  if (historicalDebits.length >= 3) {
    const historicalAvg = historicalDebits.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0) / historicalDebits.length;
    if (parsedAmount > 4000 && parsedAmount >= historicalAvg * 3.5) {
      riskScore += 20;
      reasons.push(`Amount is ${Math.round(parsedAmount / historicalAvg)}x higher than typical transfer average (₹${Math.round(historicalAvg).toLocaleString('en-IN')})`);
      
      detectedAnomalies.push({
        severity: 'MEDIUM',
        type: 'UNUSUAL_AMOUNT',
        title: 'Unusual Transfer Amount',
        reason: `Payment of ₹${parsedAmount.toLocaleString('en-IN')} is significantly higher than user's 10-transaction average (₹${Math.round(historicalAvg).toLocaleString('en-IN')})`,
        amount: parsedAmount,
        recipient,
        recommendedAction: 'Confirm with user that the amount was typed correctly.'
      });
    }
  }

  // 6. CHECK: New / Unknown Recipient
  const hasHistoryWithRecipient = allTransactions.some(t => 
    t.recipient && t.recipient.toLowerCase() === (recipient || '').toLowerCase() && t.status === 'SUCCESS'
  );

  if (isNewRecipient || !hasHistoryWithRecipient) {
    riskScore += 15;
    reasons.push(`First-time transfer to "${recipient}" (never paid previously)`);
    if (parsedAmount >= 10000) {
      requiresApproval = true;
    }
  }

  // 7. CHECK: Scam Message Context Correlation
  const activeScam = messageContext || getLastScamMessageRisk();
  if (activeScam && (activeScam.risk?.level === 'HIGH' || activeScam.risk?.level === 'CRITICAL' || activeScam.classification?.isScam)) {
    requiresApproval = true;
    riskScore += 50;
    const category = activeScam.classification?.category || 'SUSPICIOUS_SMS';
    reasons.unshift(`Suspicious context: Payment attempted shortly after high-risk message (${category.replace(/_/g, ' ')})`);
    
    detectedAnomalies.push({
      severity: 'CRITICAL',
      type: 'SCAM_MESSAGE_CONTEXT',
      title: 'Payment Linked to Scam Message',
      reason: `User recently viewed or received a scam message (${category}) before attempting this payment of ₹${parsedAmount.toLocaleString('en-IN')}`,
      amount: parsedAmount,
      recipient,
      recommendedAction: 'DENY payment. Highly likely to be active financial fraud.'
    });
  }

  // Deduplicate and record anomalies in store
  const recorded = [];
  for (const anom of detectedAnomalies) {
    const rec = recordAnomaly(anom);
    recorded.push(rec);
  }

  // Final Risk Level Mapping
  let finalRiskLevel = 'LOW';
  if (riskScore >= 70) finalRiskLevel = 'CRITICAL';
  else if (riskScore >= 40) finalRiskLevel = 'HIGH';
  else if (riskScore >= 20) finalRiskLevel = 'MEDIUM';

  return {
    requiresAuthenticatorApproval: requiresApproval,
    riskLevel: finalRiskLevel,
    riskScore: Math.min(100, riskScore),
    reasons: reasons.length > 0 ? reasons : ['Standard transfer to contact'],
    anomalies: recorded,
    velocityState: {
      windowCount: windowTransactions.length + 1,
      windowMinutes: velocityWindowMinutes,
      cumulativeAmount: totalCumulativeAmount,
      thresholdApplied: largePaymentThreshold
    }
  };
}

module.exports = {
  evaluateTransactionAnomalies,
  recordAnomaly,
  getAnomalies,
  setLastScamMessageRisk,
  getLastScamMessageRisk
};
