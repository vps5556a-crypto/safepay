const fs = require('fs');
const path = require('path');
const { evaluateTransactionAnomalies } = require('./anomalyEngine');
const {
  createApprovalRequest,
  verifyAndConsumeToken,
  broadcast,
  logAuditEvent,
  getConfig,
  updateConfig,
  getDashboardStats,
  getPendingApprovals,
  getApprovalRequest,
  approvePayment,
  denyPayment,
  getAuditLogs
} = require('./authenticatorService');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'safepay_store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_INITIAL_DATA = {
  account: {
    accountNumber: 'ACC-58291049',
    holderName: 'VPS',
    upiId: 'vps55@safepay',
    balance: 25000,
    currency: 'INR',
    updatedAt: new Date().toISOString()
  },
  authenticatorConfig: {
    largePaymentThreshold: 20000,
    maxTransactionsInWindow: 3,
    velocityWindowMinutes: 5,
    cumulativeAmountThreshold: 20000,
    approvalExpiryMinutes: 5,
    authenticatorId: 'AUTH-001',
    authenticatorName: 'SafePay Security Authenticator',
    protectedUserId: 'vps55@safepay',
    lastUpdated: new Date().toISOString()
  },
  transactions: [
    {
      id: 'tx-101',
      type: 'DEBIT',
      recipient: 'Rahul Kumar',
      upiId: 'rahul@upi',
      amount: 2000,
      status: 'SUCCESS',
      riskLevel: 'LOW',
      note: 'Rent payment',
      previousBalance: 27000,
      newBalance: 25000,
      date: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 'tx-102',
      type: 'DEBIT',
      recipient: 'Electricity Board',
      upiId: 'billdesk@sbi',
      amount: 1450,
      status: 'SUCCESS',
      riskLevel: 'LOW',
      note: 'Monthly electricity bill',
      previousBalance: 28450,
      newBalance: 27000,
      date: new Date(Date.now() - 3600000 * 18).toISOString()
    },
    {
      id: 'tx-103',
      type: 'DEBIT',
      recipient: 'Unknown Merchant',
      upiId: 'lottery_verify@paytm',
      amount: 5000,
      status: 'BLOCKED',
      riskLevel: 'CRITICAL',
      note: 'Suspected prize lottery scam',
      previousBalance: 28450,
      newBalance: 28450,
      date: new Date(Date.now() - 3600000 * 26).toISOString()
    },
    {
      id: 'tx-104',
      type: 'DEBIT',
      recipient: 'Grocery Mart',
      upiId: 'groceries@hdfc',
      amount: 450,
      status: 'SUCCESS',
      riskLevel: 'LOW',
      note: 'Vegetables and fruits',
      previousBalance: 28900,
      newBalance: 28450,
      date: new Date(Date.now() - 3600000 * 48).toISOString()
    }
  ]
};

// In-memory idempotency cache for completed transactions
const processedTransactions = new Map();

// In-memory store for low-risk auto-authorizations
const activeAutoAuthorizations = new Map();

// Helper to load data
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.account && Array.isArray(parsed.transactions)) {
        if (!parsed.authenticatorConfig) {
          parsed.authenticatorConfig = JSON.parse(JSON.stringify(DEFAULT_INITIAL_DATA.authenticatorConfig));
          saveData(parsed);
        }
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load safepay store, falling back to defaults:', error);
  }
  saveData(DEFAULT_INITIAL_DATA);
  return JSON.parse(JSON.stringify(DEFAULT_INITIAL_DATA));
}

// Helper to persist data
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to persist safepay data:', error);
  }
}

// Get account details with current balance
function getAccount() {
  const data = loadData();
  return data.account;
}

// Authenticator Configuration: Dynamic Thresholds & Policies
function getAuthenticatorConfig() {
  return getConfig();
}

function setAuthenticatorThreshold(newThreshold) {
  const parsed = parseFloat(newThreshold);
  if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
    throw new Error('Threshold must be a valid positive number');
  }
  const updated = updateConfig({ largePaymentThreshold: parsed });
  console.log(`[AUTHENTICATOR] Dynamic Large Payment Threshold updated to ₹${parsed}`);
  return updated;
}

// Reset account to initial state
function resetAccount(customBalance) {
  const initial = JSON.parse(JSON.stringify(DEFAULT_INITIAL_DATA));
  if (typeof customBalance === 'number' && customBalance >= 0) {
    initial.account.balance = customBalance;
  }
  initial.account.updatedAt = new Date().toISOString();
  saveData(initial);
  processedTransactions.clear();
  activeAutoAuthorizations.clear();
  return initial.account;
}

// Get all transactions
function getTransactions() {
  const data = loadData();
  return data.transactions;
}

/**
 * Backend-Driven Authentication & Boolean Authorization Decider
 *
 * Implements the Two-App Gatekeeper Matrix:
 * - Low-risk payments: Auto-authorized with server-issued single-use token.
 * - Risky / Large / Velocity / Scam-linked payments: WAITING_FOR_AUTHENTICATOR.
 *   Creates formal ApprovalRequest and notifies Authenticator in real-time.
 */
function authenticatePayment({
  transactionId,
  userId = 'vps55@safepay',
  recipient,
  recipientId,
  upiId,
  amount,
  riskLevel = 'LOW',
  riskScore = 0,
  isNewRecipient = false,
  verificationCode = '',
  simulationMode = null,
  messageContext = null
}) {
  const parsedAmount = parseFloat(amount);

  // 1. Validate Input
  if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount <= 0) {
    return {
      authenticated: false,
      authorized: false,
      requiresAdditionalVerification: false,
      authorizationId: null,
      message: 'Invalid transaction amount provided.'
    };
  }

  if (!recipient && !recipientId) {
    return {
      authenticated: false,
      authorized: false,
      requiresAdditionalVerification: false,
      authorizationId: null,
      message: 'Payment recipient is required.'
    };
  }

  const effectiveRecipient = recipient || recipientId;
  const effectiveUpiId = upiId || `${effectiveRecipient.toLowerCase().replace(/\s+/g, '')}@upi`;

  // 2. Handle Explicit Simulation Modes (for Demo Mode scenarios & testing)
  if (simulationMode === 'FAIL_AUTH' || verificationCode === '9999' || verificationCode === 'fail') {
    return {
      authenticated: false,
      authorized: false,
      requiresAdditionalVerification: false,
      authorizationId: null,
      message: 'Security verification failed. Invalid credentials.'
    };
  }

  if (simulationMode === 'DENY' || verificationCode === 'deny' || (riskLevel === 'CRITICAL' && !verificationCode && simulationMode !== 'AUTHENTICATOR')) {
    return {
      authenticated: true,
      authorized: false,
      requiresAdditionalVerification: false,
      authorizationId: null,
      message: 'Payment not approved. Transaction violates SafePay anti-fraud safety policies.'
    };
  }

  const data = loadData();
  const config = getConfig();

  // 3. Evaluate Anomaly & Velocity Engine
  const anomalyEvaluation = evaluateTransactionAnomalies({
    amount: parsedAmount,
    recipient: effectiveRecipient,
    upiId: effectiveUpiId,
    isNewRecipient,
    allTransactions: data.transactions,
    config,
    messageContext
  });

  const isLargePayment = parsedAmount >= config.largePaymentThreshold;
  const isHighRisk = anomalyEvaluation.riskLevel === 'HIGH' || anomalyEvaluation.riskLevel === 'CRITICAL' || riskLevel === 'HIGH' || riskLevel === 'CRITICAL';
  const requiresAuthenticatorApproval = anomalyEvaluation.requiresAuthenticatorApproval || isLargePayment || isHighRisk;

  // 4. If Authenticator Approval is Required:
  if (requiresAuthenticatorApproval) {
    const combinedReasons = [...new Set([...anomalyEvaluation.reasons])];

    const approvalReq = createApprovalRequest({
      transactionId: transactionId || `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      userId,
      authenticatorId: config.authenticatorId,
      amount: parsedAmount,
      currency: 'INR',
      paymentMethod: 'UPI',
      recipient: effectiveRecipient,
      upiId: effectiveUpiId,
      riskLevel: anomalyEvaluation.riskLevel,
      riskScore: anomalyEvaluation.riskScore,
      reasons: combinedReasons,
      recentTransactions: data.transactions
    });

    return {
      authenticated: true,
      authorized: false,
      requiresAdditionalVerification: true,
      requiresAuthenticatorApproval: true,
      status: 'WAITING_FOR_AUTHENTICATOR',
      approvalRequestId: approvalReq.id,
      transactionId: approvalReq.transactionId,
      thresholdApplied: config.largePaymentThreshold,
      riskLevel: anomalyEvaluation.riskLevel,
      reasons: combinedReasons,
      message: isLargePayment 
        ? `High-value payment (₹${parsedAmount.toLocaleString('en-IN')}) requires explicit SafePay Authenticator approval.`
        : `Security approval required due to elevated payment risk (${anomalyEvaluation.reasons[0] || 'Unusual pattern'}).`
    };
  }

  // 5. Low-Risk Everyday Payment: Auto-Authorize
  const authorizationId = `AUTH-AUTO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  activeAutoAuthorizations.set(authorizationId, {
    authorizationId,
    transactionId: transactionId || `TXN-${Date.now()}`,
    userId,
    amount: parsedAmount,
    recipient: effectiveRecipient,
    upiId: effectiveUpiId,
    authorized: true,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5-minute expiry
  });

  console.log(`[AUTH] Auto-authorized Low-Risk Payment ${authorizationId} for ₹${parsedAmount} to ${effectiveRecipient}`);

  return {
    authenticated: true,
    authorized: true,
    requiresAdditionalVerification: false,
    requiresAuthenticatorApproval: false,
    authorizationId,
    thresholdApplied: config.largePaymentThreshold,
    message: 'Payment verified and authorized.'
  };
}

/**
 * Process a transaction atomically
 * Source of truth for account balance and transaction records.
 */
function processTransaction({
  id,
  recipient,
  upiId,
  sender,
  amount,
  type = 'DEBIT',
  status = 'SUCCESS',
  riskLevel = 'LOW',
  note = '',
  authorizationId,
  date
}) {
  const txnId = id || `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // 1. Idempotency Check: Prevent duplicate debit on repeated clicks
  if (processedTransactions.has(txnId)) {
    console.log(`[TRANSACTION] Idempotent request hit for ID: ${txnId}`);
    return processedTransactions.get(txnId);
  }

  // 2. Validate Amount
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount <= 0) {
    return {
      success: false,
      error: 'INVALID_AMOUNT',
      message: 'Transaction amount must be a positive valid number.'
    };
  }

  const normalizedType = String(type).toUpperCase() === 'CREDIT' ? 'CREDIT' : 'DEBIT';
  const normalizedStatus = String(status).toUpperCase();

  // 3. Authorization Verification Gatekeeper
  if (normalizedType === 'DEBIT') {
    if (!authorizationId) {
      return {
        success: false,
        error: 'AUTHORIZATION_REQUIRED',
        message: 'Backend security authorization token is required to execute payment.'
      };
    }

    let authRecord = null;
    let isAutoAuth = false;

    // Check Authenticator token first
    const consumedResult = verifyAndConsumeToken({
      authorizationId,
      transactionId: txnId,
      amount: parsedAmount,
      recipient
    });

    if (consumedResult.valid) {
      authRecord = consumedResult;
    } else if (consumedResult.error === 'TAMPERED_AMOUNT' || consumedResult.error === 'TAMPERED_RECIPIENT') {
      return {
        success: false,
        error: consumedResult.error,
        message: consumedResult.message
      };
    } else {
      // Check low-risk auto-authorizations
      const autoAuth = activeAutoAuthorizations.get(authorizationId);
      if (autoAuth) {
        if (Date.now() > autoAuth.expiresAt) {
          activeAutoAuthorizations.delete(authorizationId);
          return {
            success: false,
            error: 'EXPIRED_AUTHORIZATION',
            message: 'Authorization token has expired. Please re-authenticate.'
          };
        }

        if (Math.abs(autoAuth.amount - parsedAmount) > 0.01) {
          return {
            success: false,
            error: 'TAMPERED_AMOUNT',
            message: 'Transaction amount does not match authorized amount.'
          };
        }

        if (recipient && autoAuth.recipient.toLowerCase() !== recipient.toLowerCase()) {
          return {
            success: false,
            error: 'TAMPERED_RECIPIENT',
            message: 'Transaction recipient does not match authorized recipient.'
          };
        }

        authRecord = autoAuth;
        isAutoAuth = true;
        activeAutoAuthorizations.delete(authorizationId); // consume single use
      } else {
        return {
          success: false,
          error: 'INVALID_AUTHORIZATION',
          message: consumedResult.message || 'Authorization token is invalid, expired, or already used.'
        };
      }
    }
  }

  const data = loadData();
  const currentBalance = data.account.balance;
  let newBalance = currentBalance;

  // 4. Status checks: Only SUCCESS can modify the account balance
  const isSuccessful = normalizedStatus === 'SUCCESS' || normalizedStatus === 'SUCCESSFUL';

  if (isSuccessful) {
    if (normalizedType === 'DEBIT') {
      // 5. Insufficient Balance Check
      if (currentBalance < parsedAmount) {
        console.warn(`[TRANSACTION] Insufficient balance: attempted ₹${parsedAmount}, available ₹${currentBalance}`);
        return {
          success: false,
          error: 'INSUFFICIENT_BALANCE',
          message: 'You do not have enough money for this payment.',
          currentBalance,
          requestedAmount: parsedAmount
        };
      }
      newBalance = currentBalance - parsedAmount;
    } else if (normalizedType === 'CREDIT') {
      newBalance = currentBalance + parsedAmount;
    }
  } else {
    // FAILED, BLOCKED, CANCELLED, PENDING, DENIED -> Balance is unchanged!
    newBalance = currentBalance;
  }

  // 6. Update Account Balance atomically
  data.account.balance = Math.round(newBalance * 100) / 100;
  data.account.updatedAt = new Date().toISOString();

  // 7. Create Transaction Record
  const newTxn = {
    id: txnId,
    type: normalizedType,
    amount: parsedAmount,
    sender: sender || data.account.upiId,
    recipient: recipient || 'Unknown Recipient',
    upiId: upiId || `${(recipient || 'user').toLowerCase().replace(/\s+/g, '')}@upi`,
    status: isSuccessful ? 'SUCCESS' : normalizedStatus,
    riskLevel: riskLevel || 'LOW',
    note: note || '',
    previousBalance: currentBalance,
    newBalance: data.account.balance,
    authorizationId: authorizationId || null,
    date: date || new Date().toISOString()
  };

  // Add to top of transaction history
  data.transactions.unshift(newTxn);

  // 8. Persist both balance and transaction atomically
  saveData(data);

  const result = {
    success: true,
    transaction: newTxn,
    account: {
      balance: data.account.balance,
      currency: data.account.currency,
      upiId: data.account.upiId
    }
  };

  // Cache for idempotency
  processedTransactions.set(txnId, result);

  // Real-time broadcast to Authenticator App
  broadcast('payment:completed', {
    transaction: newTxn,
    account: result.account
  });

  console.log('-------------------------------------------');
  console.log(`[TRANSACTION] Status: ${newTxn.status}`);
  console.log(`ID: ${newTxn.id}`);
  console.log(`Type: ${newTxn.type} | Amount: ₹${newTxn.amount}`);
  console.log(`Recipient: ${newTxn.recipient} (${newTxn.upiId})`);
  console.log(`Previous Balance: ₹${newTxn.previousBalance} -> New Balance: ₹${newTxn.newBalance}`);
  console.log('-------------------------------------------');

  return result;
}

module.exports = {
  getAccount,
  resetAccount,
  getTransactions,
  authenticatePayment,
  processTransaction,
  getAuthenticatorConfig,
  setAuthenticatorThreshold,
  getDashboardStats: () => getDashboardStats(loadData().transactions),
  getPendingApprovals,
  getApprovalRequest,
  approvePayment,
  denyPayment,
  getAuditLogs,
  updateConfig
};
