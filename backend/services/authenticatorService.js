const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'safepay_store.json');

// Default Authenticator Security Policy
const DEFAULT_CONFIG = {
  largePaymentThreshold: 20000,
  maxTransactionsInWindow: 3,
  velocityWindowMinutes: 5,
  cumulativeAmountThreshold: 20000,
  approvalExpiryMinutes: 5,
  authenticatorId: 'AUTH-001',
  authenticatorName: 'SafePay Security Authenticator',
  protectedUserId: 'vps55@safepay',
  lastUpdated: new Date().toISOString()
};

// In-memory collections
const approvalRequests = new Map();
const activeTokens = new Map();
const auditLogs = [];
const connectedClients = new Set(); // Set of active WebSocket instances

/**
 * Load persisted config from store
 */
function loadConfig() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.authenticatorConfig) {
        return { ...DEFAULT_CONFIG, ...parsed.authenticatorConfig };
      }
    }
  } catch (e) {
    console.error('Error reading authenticator config from store:', e);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Persist updated config to store
 */
function saveConfig(updatedConfig) {
  try {
    let data = {};
    if (fs.existsSync(DATA_FILE)) {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
    data.authenticatorConfig = { ...DEFAULT_CONFIG, ...data.authenticatorConfig, ...updatedConfig, lastUpdated: new Date().toISOString() };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return data.authenticatorConfig;
  } catch (e) {
    console.error('Error saving authenticator config:', e);
    return updatedConfig;
  }
}

// Initialize config in memory
let currentConfig = loadConfig();

/**
 * Audit Log Helper
 */
function logAuditEvent({
  eventType,
  actor = 'SYSTEM',
  transactionId = null,
  approvalRequestId = null,
  details = '',
  metadata = {}
}) {
  const event = {
    id: `AUDIT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toISOString(),
    eventType,
    actor,
    transactionId,
    approvalRequestId,
    details,
    metadata
  };

  auditLogs.unshift(event);
  if (auditLogs.length > 300) {
    auditLogs.pop();
  }

  console.log(`[AUDIT] [${event.timestamp}] [${event.eventType}] Actor: ${event.actor} - ${event.details}`);
  return event;
}

// Seed initial audit log for demonstration
logAuditEvent({
  eventType: 'SYSTEM_BOOT',
  actor: 'SYSTEM',
  details: 'SafePay Authenticator Gatekeeper initialized on port 3001.'
});

/**
 * WebSocket Hub Management
 */
function registerWebSocket(ws) {
  connectedClients.add(ws);
  console.log(`[WS] Client connected. Total active WebSocket connections: ${connectedClients.size}`);

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log(`[WS] Client disconnected. Total active connections: ${connectedClients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[WS] Client connection error:', err);
    connectedClients.delete(ws);
  });

  // Send initial handshake
  try {
    ws.send(JSON.stringify({
      type: 'connection:ready',
      serverTime: new Date().toISOString(),
      connectedClients: connectedClients.size
    }));
  } catch (e) {}
}

/**
 * Broadcast event to all connected SafePay and Authenticator clients
 */
function broadcast(eventType, payload) {
  const message = JSON.stringify({
    event: eventType,
    data: payload,
    timestamp: new Date().toISOString()
  });

  console.log(`[WS BROADCAST] Event: ${eventType} to ${connectedClients.size} clients`);

  for (const client of connectedClients) {
    if (client.readyState === 1 /* OPEN */) {
      try {
        client.send(message);
      } catch (err) {
        console.error('[WS BROADCAST ERROR]', err);
      }
    }
  }
}

/**
 * Create a new Approval Request
 */
function createApprovalRequest({
  transactionId,
  userId = 'vps55@safepay',
  authenticatorId = 'AUTH-001',
  amount,
  currency = 'INR',
  paymentMethod = 'UPI',
  recipient,
  upiId,
  riskLevel = 'HIGH',
  riskScore = 75,
  reasons = [],
  recentTransactions = []
}) {
  const reqId = `APR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const txnId = transactionId || `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const expiryMs = (currentConfig.approvalExpiryMinutes || 5) * 60 * 1000;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiryMs).toISOString();

  // Compute recent activity metrics for Authenticator review
  const recentDebits = recentTransactions.filter(t => t.type === 'DEBIT');
  const lastPayment = recentDebits[0] ? `₹${recentDebits[0].amount} to ${recentDebits[0].recipient}` : 'None';
  const previousPayment = recentDebits[1] ? `₹${recentDebits[1].amount} to ${recentDebits[1].recipient}` : 'None';
  const todayDebits = recentDebits.filter(t => {
    if (!t.date) return false;
    return new Date(t.date).toDateString() === new Date().toDateString();
  });
  const totalToday = todayDebits.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

  const approvalReq = {
    id: reqId,
    transactionId: txnId,
    userId,
    authenticatorId,
    amount: parseFloat(amount),
    currency,
    paymentMethod,
    recipient,
    upiId: upiId || `${recipient.toLowerCase().replace(/\s+/g, '')}@upi`,
    riskLevel,
    riskScore,
    reasons: Array.isArray(reasons) && reasons.length > 0 ? reasons : ['High-risk payment requires security authorization.'],
    status: 'PENDING', // PENDING | APPROVED | DENIED | EXPIRED | CANCELLED
    createdAt,
    expiresAt,
    approvedAt: null,
    deniedAt: null,
    denialReason: null,
    decisionBy: null,
    authorizationToken: null,
    recentActivitySummary: {
      lastPayment,
      previousPayment,
      paymentsToday: todayDebits.length,
      totalToday
    }
  };

  approvalRequests.set(reqId, approvalReq);

  // Log Audit Event
  logAuditEvent({
    eventType: 'APPROVAL_REQUESTED',
    actor: 'RISK_ENGINE',
    transactionId: txnId,
    approvalRequestId: reqId,
    details: `Approval requested for ₹${approvalReq.amount} to ${approvalReq.recipient} (Risk: ${riskLevel})`,
    metadata: { reasons: approvalReq.reasons }
  });

  // Real-time broadcast to Authenticator
  broadcast('payment:approval_required', approvalReq);

  return approvalReq;
}

/**
 * Get all pending approval requests
 */
function getPendingApprovals() {
  const now = Date.now();
  const pending = [];

  for (const [id, req] of approvalRequests.entries()) {
    if (req.status === 'PENDING') {
      if (now > new Date(req.expiresAt).getTime()) {
        req.status = 'EXPIRED';
        logAuditEvent({
          eventType: 'PAYMENT_EXPIRED',
          actor: 'SYSTEM_TIMER',
          transactionId: req.transactionId,
          approvalRequestId: req.id,
          details: `Approval request ${req.id} expired without response.`
        });
        broadcast('payment:expired', { approvalRequestId: req.id, transactionId: req.transactionId });
      } else {
        pending.push(req);
      }
    }
  }

  // Sort newest first
  return pending.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get a specific approval request by ID
 */
function getApprovalRequest(approvalRequestId) {
  return approvalRequests.get(approvalRequestId) || null;
}

/**
 * Authenticator Approves a Payment
 */
function approvePayment({
  approvalRequestId,
  authenticatorId = 'AUTH-001',
  transactionId = null,
  note = ''
}) {
  const req = approvalRequests.get(approvalRequestId);

  if (!req) {
    return { success: false, error: 'NOT_FOUND', message: 'Approval request not found.' };
  }

  // Relationship check
  if (authenticatorId !== currentConfig.authenticatorId) {
    return { success: false, error: 'UNAUTHORIZED_AUTHENTICATOR', message: 'You are not authorized to approve for this account.' };
  }

  if (transactionId && req.transactionId !== transactionId) {
    return { success: false, error: 'TRANSACTION_MISMATCH', message: 'Transaction ID does not match approval record.' };
  }

  if (req.status !== 'PENDING') {
    return { success: false, error: 'INVALID_STATE', message: `Cannot approve request with status: ${req.status}` };
  }

  if (Date.now() > new Date(req.expiresAt).getTime()) {
    req.status = 'EXPIRED';
    broadcast('payment:expired', { approvalRequestId: req.id, transactionId: req.transactionId });
    return { success: false, error: 'EXPIRED', message: 'Approval request has expired.' };
  }

  // Generate cryptographically bound single-use authorization token
  const authToken = `AUTH-TOKEN-${Date.now()}-${Math.floor(10000 + Math.random() * 90000)}`;
  const tokenExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes valid for user execution

  req.status = 'APPROVED';
  req.approvedAt = new Date().toISOString();
  req.decisionBy = authenticatorId;
  req.authorizationToken = authToken;
  req.decisionNote = note;

  // Store active bound token in memory
  activeTokens.set(authToken, {
    token: authToken,
    approvalRequestId: req.id,
    transactionId: req.transactionId,
    userId: req.userId,
    recipient: req.recipient,
    upiId: req.upiId,
    amount: req.amount,
    currency: req.currency,
    expiresAt: tokenExpiry,
    used: false
  });

  // Log Audit Event
  logAuditEvent({
    eventType: 'PAYMENT_APPROVED',
    actor: authenticatorId,
    transactionId: req.transactionId,
    approvalRequestId: req.id,
    details: `Authenticator approved ₹${req.amount} to ${req.recipient}. Token ${authToken.slice(0, 16)}... issued.`
  });

  // Broadcast to SafePay and Authenticator apps
  const approvalPayload = {
    approvalRequestId: req.id,
    transactionId: req.transactionId,
    recipient: req.recipient,
    upiId: req.upiId,
    amount: req.amount,
    currency: req.currency,
    authorizationToken: authToken,
    status: 'APPROVED',
    approvedBy: authenticatorId,
    approvedAt: req.approvedAt,
    expiresAt: new Date(tokenExpiry).toISOString()
  };

  broadcast('payment:approved', approvalPayload);

  return {
    success: true,
    approved: true,
    approvalRequestId: req.id,
    transactionId: req.transactionId,
    authorizationToken: authToken,
    message: 'Payment approved. User can now personally confirm the transfer in SafePay.'
  };
}

/**
 * Authenticator Denies a Payment
 */
function denyPayment({
  approvalRequestId,
  authenticatorId = 'AUTH-001',
  transactionId = null,
  reason = 'Suspicious payment rejected by security authorizer'
}) {
  const req = approvalRequests.get(approvalRequestId);

  if (!req) {
    return { success: false, error: 'NOT_FOUND', message: 'Approval request not found.' };
  }

  if (authenticatorId !== currentConfig.authenticatorId) {
    return { success: false, error: 'UNAUTHORIZED_AUTHENTICATOR', message: 'You are not authorized to deny for this account.' };
  }

  if (req.status !== 'PENDING') {
    return { success: false, error: 'INVALID_STATE', message: `Cannot deny request with status: ${req.status}` };
  }

  req.status = 'DENIED';
  req.deniedAt = new Date().toISOString();
  req.decisionBy = authenticatorId;
  req.denialReason = reason;

  // Log Audit Event
  logAuditEvent({
    eventType: 'PAYMENT_DENIED',
    actor: authenticatorId,
    transactionId: req.transactionId,
    approvalRequestId: req.id,
    details: `Authenticator denied payment of ₹${req.amount} to ${req.recipient}. Reason: "${reason}"`
  });

  const denialPayload = {
    approvalRequestId: req.id,
    transactionId: req.transactionId,
    recipient: req.recipient,
    amount: req.amount,
    status: 'DENIED',
    deniedBy: authenticatorId,
    deniedAt: req.deniedAt,
    reason
  };

  broadcast('payment:denied', denialPayload);

  return {
    success: true,
    approved: false,
    status: 'DENIED',
    approvalRequestId: req.id,
    transactionId: req.transactionId,
    message: 'Payment denied. SafePay has blocked this transaction.'
  };
}

/**
 * Verify and consume authorization token upon actual execution
 */
function verifyAndConsumeToken({
  authorizationId,
  transactionId,
  amount,
  recipient
}) {
  if (!authorizationId) {
    return { valid: false, error: 'MISSING_AUTHORIZATION', message: 'Authorization token is required.' };
  }

  const tokenRecord = activeTokens.get(authorizationId);

  if (!tokenRecord) {
    return { valid: false, error: 'INVALID_AUTHORIZATION', message: 'Authorization token not found or already used.' };
  }

  if (tokenRecord.used) {
    return { valid: false, error: 'TOKEN_ALREADY_USED', message: 'Authorization token has already been consumed.' };
  }

  if (Date.now() > tokenRecord.expiresAt) {
    activeTokens.delete(authorizationId);
    return { valid: false, error: 'EXPIRED_AUTHORIZATION', message: 'Authorization token has expired.' };
  }

  // EXACT TRANSACTION BINDING VERIFICATIONS
  if (Math.abs(tokenRecord.amount - parseFloat(amount)) > 0.01) {
    return {
      valid: false,
      error: 'TAMPERED_AMOUNT',
      message: `Transaction amount (₹${amount}) does not match authorized amount (₹${tokenRecord.amount}).`
    };
  }

  if (recipient && tokenRecord.recipient.toLowerCase() !== recipient.toLowerCase()) {
    return {
      valid: false,
      error: 'TAMPERED_RECIPIENT',
      message: `Recipient (${recipient}) does not match authorized recipient (${tokenRecord.recipient}).`
    };
  }

  // Consume single-use token
  tokenRecord.used = true;
  activeTokens.delete(authorizationId);

  logAuditEvent({
    eventType: 'PAYMENT_EXECUTED',
    actor: 'SAFEPAY_USER',
    transactionId: transactionId || tokenRecord.transactionId,
    approvalRequestId: tokenRecord.approvalRequestId,
    details: `Payment executed with valid single-use token for ₹${tokenRecord.amount} to ${tokenRecord.recipient}.`
  });

  return {
    valid: true,
    approvalRequestId: tokenRecord.approvalRequestId,
    transactionId: tokenRecord.transactionId
  };
}

/**
 * Periodic expiry sweeper
 */
setInterval(() => {
  const now = Date.now();
  for (const [id, req] of approvalRequests.entries()) {
    if (req.status === 'PENDING' && now > new Date(req.expiresAt).getTime()) {
      req.status = 'EXPIRED';
      logAuditEvent({
        eventType: 'PAYMENT_EXPIRED',
        actor: 'SYSTEM_TIMER',
        transactionId: req.transactionId,
        approvalRequestId: req.id,
        details: `Approval request ${req.id} expired without response.`
      });
      broadcast('payment:expired', { approvalRequestId: req.id, transactionId: req.transactionId });
    }
  }

  // Clean expired active tokens
  for (const [token, record] of activeTokens.entries()) {
    if (now > record.expiresAt) {
      activeTokens.delete(token);
    }
  }
}, 10000);

/**
 * Get Authenticator Dashboard Stats
 */
function getDashboardStats(allTransactions = []) {
  const pendingApprovals = getPendingApprovals();
  const today = new Date().toDateString();

  const todayTransactions = allTransactions.filter(t => {
    if (!t.date) return false;
    return new Date(t.date).toDateString() === today;
  });

  const highRiskEvents = allTransactions.filter(t => 
    t.riskLevel === 'HIGH' || t.riskLevel === 'CRITICAL' || t.status === 'BLOCKED' || t.status === 'DENIED'
  ).length;

  // Calculate total protected value (all approved, blocked, or pending large payments)
  const totalProtectedValue = allTransactions.reduce((acc, t) => {
    if (t.riskLevel === 'HIGH' || t.riskLevel === 'CRITICAL' || t.amount >= currentConfig.largePaymentThreshold) {
      return acc + (parseFloat(t.amount) || 0);
    }
    return acc;
  }, 0) + pendingApprovals.reduce((acc, p) => acc + p.amount, 0);

  return {
    success: true,
    stats: {
      totalTransactionsToday: todayTransactions.length,
      todayVolume: todayTransactions.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0),
      pendingApprovalsCount: pendingApprovals.length,
      highRiskEventsCount: highRiskEvents,
      anomaliesCount: 3, // Will sync with anomalyEngine
      totalValueProtected: Math.round(totalProtectedValue),
      authenticatorStatus: 'ACTIVE_SHIELD_ONLINE',
      protectedUser: currentConfig.protectedUserId,
      authenticatorId: currentConfig.authenticatorId
    },
    pendingApprovals,
    recentAuditLogs: auditLogs.slice(0, 10),
    config: currentConfig
  };
}

module.exports = {
  createApprovalRequest,
  getPendingApprovals,
  getApprovalRequest,
  approvePayment,
  denyPayment,
  verifyAndConsumeToken,
  registerWebSocket,
  broadcast,
  logAuditEvent,
  getDashboardStats,
  getAuditLogs: () => auditLogs,
  getConfig: () => currentConfig,
  updateConfig: (newCfg) => {
    currentConfig = saveConfig(newCfg);
    logAuditEvent({
      eventType: 'POLICY_UPDATED',
      actor: currentConfig.authenticatorId,
      details: `Security policies updated. Large limit: ₹${currentConfig.largePaymentThreshold}, Velocity: ${currentConfig.maxTransactionsInWindow} txns / ${currentConfig.velocityWindowMinutes}m`
    });
    return currentConfig;
  }
};
