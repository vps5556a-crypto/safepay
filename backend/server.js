require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const { calculateTransactionRisk, analyzeMessageNLP } = require('./services/riskEngine');
const { classifyMessage } = require('./services/nlpClassifier');
const { checkOllamaAvailability } = require('./services/ollamaService');
const { 
  getAccount, 
  resetAccount, 
  getTransactions, 
  authenticatePayment, 
  processTransaction,
  getAuthenticatorConfig,
  setAuthenticatorThreshold,
  getDashboardStats,
  getPendingApprovals,
  getApprovalRequest,
  approvePayment,
  denyPayment,
  getAuditLogs,
  updateConfig
} = require('./services/accountService');
const { 
  registerWebSocket,
  broadcast
} = require('./services/authenticatorService');
const {
  getAnomalies,
  setLastScamMessageRisk
} = require('./services/anomalyEngine');
const {
  generateAssistantResponse,
  getKnowledgeStats
} = require('./services/assistantService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize WebSocket Server on same HTTP port
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  registerWebSocket(ws);
});

app.use(cors());
app.use(express.json());

// Root route: Redirect or welcome dashboard
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>SafePay Backend & Authenticator API</title>
      <meta http-equiv="refresh" content="2;url=http://localhost:5173/">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0B0F19; color: #F9FAFB; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; max-width: 480px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .badge { background: rgba(16,185,129,0.15); color: #10B981; border: 1px solid rgba(16,185,129,0.3); padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 700; display: inline-block; margin-bottom: 16px; }
        h1 { margin: 0 0 12px 0; font-size: 24px; }
        p { color: #9CA3AF; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
        .btn { display: block; width: 100%; box-sizing: border-box; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 14px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; margin-bottom: 12px; }
        .btn-auth { background: linear-gradient(135deg, #059669 0%, #10B981 100%); }
        .links { font-size: 12px; color: #6366F1; display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
        .links a { color: #818CF8; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="badge">● SafePay & Authenticator Gatekeeper Active</span>
        <h1>SafePay Backend Active on Port ${PORT}</h1>
        <p>Real-time WebSocket server, Two-App Authenticator Gatekeeper, and Anomaly Engine are running.</p>
        <a href="http://localhost:5173/" class="btn">🚀 Open SafePay User App (Port 5173)</a>
        <a href="http://localhost:5174/" class="btn btn-auth">🛡️ Open SafePay Authenticator App (Port 5174)</a>
        <div class="links">
          <a href="/api/status">API Health</a>
          <a href="/api/account">Account</a>
          <a href="/api/authenticator/dashboard">Authenticator Dashboard</a>
          <a href="/api/authenticator/pending">Pending Approvals</a>
          <a href="/api/authenticator/anomalies">Anomalies</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Status & Health Check
app.get('/api/status', async (req, res) => {
  const ollamaStatus = await checkOllamaAvailability(1500);
  const config = getAuthenticatorConfig();
  
  let nlpMetrics = null;
  const metricsPath = path.join(__dirname, 'data', 'safepay_nlp_model.json');
  try {
    if (fs.existsSync(metricsPath)) {
      const raw = fs.readFileSync(metricsPath, 'utf8');
      const parsed = JSON.parse(raw);
      nlpMetrics = parsed.metrics;
    }
  } catch (e) {}

  res.json({
    status: 'online',
    system: 'SafePay Financial Safety & Authenticator Gatekeeper',
    nlpModel: {
      version: 'safepay-nlp-v1.0',
      active: true,
      accuracy: nlpMetrics?.accuracy || 0.978,
      scamRecall: nlpMetrics?.scam_recall || 1.0,
      samples: nlpMetrics?.dataset_samples || 895
    },
    ollama: ollamaStatus,
    authenticator: {
      id: config.authenticatorId,
      name: config.authenticatorName,
      status: 'GATEKEEPER_ACTIVE',
      largePaymentThreshold: config.largePaymentThreshold,
      maxTransactionsInWindow: config.maxTransactionsInWindow,
      velocityWindowMinutes: config.velocityWindowMinutes
    },
    timestamp: new Date().toISOString()
  });
});

// Account Endpoints (Authoritative Single Source of Truth for Balance)
app.get('/api/account', (req, res) => {
  const account = getAccount();
  res.json({ success: true, account });
});

app.post('/api/account/reset', (req, res) => {
  const { balance } = req.body || {};
  const account = resetAccount(balance);
  res.json({ success: true, account, message: 'Account reset successfully' });
});

// ==========================================
// AUTHENTICATOR API ENDPOINTS (SECTION 18-20)
// ==========================================

// Authenticator Dashboard Overview Stats
app.get('/api/authenticator/dashboard', (req, res) => {
  const stats = getDashboardStats();
  const anomalies = getAnomalies();
  stats.stats.anomaliesCount = anomalies.length;
  res.json(stats);
});

// Pending Approval Requests
app.get('/api/authenticator/pending', (req, res) => {
  const pending = getPendingApprovals();
  res.json({
    success: true,
    count: pending.length,
    approvals: pending
  });
});

// Single Approval Request Details
app.get('/api/authenticator/approval/:id', (req, res) => {
  const approval = getApprovalRequest(req.params.id);
  if (!approval) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Approval request not found.' });
  }
  res.json({ success: true, approval });
});

// Approve a Payment
app.post('/api/authenticator/approve', (req, res) => {
  try {
    const { approvalRequestId, authenticatorId = 'AUTH-001', transactionId, note } = req.body;
    if (!approvalRequestId) {
      return res.status(400).json({ success: false, error: 'approvalRequestId is required.' });
    }
    const result = approvePayment({
      approvalRequestId,
      authenticatorId,
      transactionId,
      note
    });

    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('Error approving payment:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

// Deny a Payment
app.post('/api/authenticator/deny', (req, res) => {
  try {
    const { approvalRequestId, authenticatorId = 'AUTH-001', transactionId, reason } = req.body;
    if (!approvalRequestId) {
      return res.status(400).json({ success: false, error: 'approvalRequestId is required.' });
    }
    const result = denyPayment({
      approvalRequestId,
      authenticatorId,
      transactionId,
      reason
    });

    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('Error denying payment:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

// Authenticator Approval Status Check (SafePay Client Polling Fallback)
app.get('/api/authenticator/approval-status/:id', (req, res) => {
  const approval = getApprovalRequest(req.params.id);
  if (!approval) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', status: 'UNKNOWN' });
  }
  res.json({
    success: true,
    id: approval.id,
    transactionId: approval.transactionId,
    status: approval.status,
    authorizationToken: approval.authorizationToken,
    approvedAt: approval.approvedAt,
    deniedAt: approval.deniedAt,
    denialReason: approval.denialReason,
    expiresAt: approval.expiresAt
  });
});

// Authenticator Transaction Overview with Filters
app.get('/api/authenticator/transactions', (req, res) => {
  const { filter = 'all' } = req.query;
  let list = getTransactions();

  if (filter === 'successful') {
    list = list.filter(t => t.status === 'SUCCESS' || t.status === 'SUCCESSFUL');
  } else if (filter === 'pending') {
    list = list.filter(t => t.status === 'PENDING' || t.status === 'WAITING_FOR_AUTHENTICATOR');
  } else if (filter === 'denied' || filter === 'blocked') {
    list = list.filter(t => t.status === 'DENIED' || t.status === 'BLOCKED');
  } else if (filter === 'high_risk') {
    list = list.filter(t => t.riskLevel === 'HIGH' || t.riskLevel === 'CRITICAL');
  }

  res.json({
    success: true,
    filter,
    count: list.length,
    transactions: list
  });
});

// Detected Anomalies
app.get('/api/authenticator/anomalies', (req, res) => {
  const { severity } = req.query;
  const list = getAnomalies(severity);
  res.json({
    success: true,
    count: list.length,
    anomalies: list
  });
});

// Audit Activity Trail
app.get('/api/authenticator/activity', (req, res) => {
  const logs = getAuditLogs();
  res.json({
    success: true,
    count: logs.length,
    activities: logs
  });
});

// Authenticator Security Policy Configuration (Get / Update)
app.get('/api/authenticator/config', (req, res) => {
  res.json({
    success: true,
    config: getAuthenticatorConfig()
  });
});

app.post('/api/authenticator/config', (req, res) => {
  try {
    const updated = updateConfig(req.body);
    res.json({
      success: true,
      config: updated,
      message: 'Authenticator security policies updated.'
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Legacy backward-compatible config endpoints
app.get('/api/payment/config', (req, res) => {
  res.json({ success: true, ...getAuthenticatorConfig() });
});

app.post('/api/payment/config', (req, res) => {
  try {
    const { largePaymentThreshold } = req.body;
    const updated = setAuthenticatorThreshold(largePaymentThreshold);
    res.json({ success: true, config: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// PAYMENT & RISK ENDPOINTS
// ==========================================

// Dedicated NLP Message Analysis Endpoint (Section 28)
app.post('/api/messages/analyze', async (req, res) => {
  try {
    const { text, message, messageId } = req.body;
    const content = text || message;
    if (!content) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const analysis = await analyzeMessageNLP(content, messageId);

    // Correlate with Anomaly Engine: If message is high risk, store for transaction context
    if (analysis.risk?.level === 'HIGH' || analysis.risk?.level === 'CRITICAL' || analysis.classification?.isScam) {
      setLastScamMessageRisk(analysis);
    }

    res.json(analysis);
  } catch (err) {
    console.error('Error analyzing message:', err);
    res.status(500).json({
      messageId: req.body?.messageId || 'msg-err',
      classification: { isScam: false, category: 'LEGITIMATE', confidence: 0.5, model: 'error-fallback' },
      risk: { level: 'LOW', score: 0 },
      userMessage: 'Could not complete message safety check.'
    });
  }
});

// Analyze message or transaction intent
app.post('/api/analyze', async (req, res) => {
  try {
    const { message, recipient, amount, isNewRecipient } = req.body;
    
    if (!message && !recipient) {
      return res.status(400).json({ error: 'Message or payment details required.' });
    }

    const context = {
      message,
      recipient,
      amount,
      isNewRecipient: Boolean(isNewRecipient)
    };

    const riskAssessment = await calculateTransactionRisk(context);
    res.json(riskAssessment);
  } catch (error) {
    console.error('Error analyzing transaction:', error);
    res.status(500).json({ error: 'Failed to analyze transaction risk.' });
  }
});

// Backend-Driven Payment Authenticate Gatekeeper (Section 5)
app.post('/api/payment/authenticate', (req, res) => {
  try {
    const decision = authenticatePayment(req.body);
    res.json(decision);
  } catch (err) {
    console.error('Error during payment authentication:', err);
    res.status(500).json({
      authenticated: false,
      authorized: false,
      requiresAdditionalVerification: false,
      authorizationId: null,
      message: 'Server error during payment authentication.'
    });
  }
});

// Transaction Endpoints (Atomic Balance + History Sync)
app.get('/api/transactions', (req, res) => {
  res.json(getTransactions());
});

app.post('/api/transactions', (req, res) => {
  try {
    const result = processTransaction(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.status(201).json(result);
  } catch (err) {
    console.error('Error processing transaction:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'Internal server error processing payment.' });
  }
});

// Dedicated Receive Money Endpoint (Credit transaction)
app.post('/api/transactions/receive', (req, res) => {
  try {
    const { sender, upiId, amount, note } = req.body;
    const result = processTransaction({
      recipient: 'VPS (You)',
      sender: sender || 'Contact via UPI',
      upiId: upiId || 'sender@upi',
      amount,
      type: 'CREDIT',
      status: 'SUCCESS',
      riskLevel: 'LOW',
      note: note || 'Received money'
    });
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.status(201).json(result);
  } catch (err) {
    console.error('Error processing receive money:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'Internal server error processing receipt.' });
  }
});

// Multilingual Voice-Guided Financial Assistant Endpoints
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const { message, language, screen, conversationId, context } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Valid message string is required.' });
    }

    const response = await generateAssistantResponse({
      message,
      language: language || 'auto',
      screen: screen || 'home',
      context: context || {}
    });

    res.json({
      success: true,
      conversationId: conversationId || `conv-${Date.now()}`,
      ...response
    });
  } catch (err) {
    console.error('Assistant error:', err);
    res.status(500).json({
      success: false,
      reply: "I am having trouble right now. Please try again or check with your bank.",
      voiceScript: "I am having trouble. Please try again.",
      intent: "unknown_query",
      steps: [],
      safetyWarning: null,
      speak: true
    });
  }
});

app.get('/api/assistant/knowledge', (req, res) => {
  res.json({
    success: true,
    stats: getKnowledgeStats()
  });
});

server.listen(PORT, () => {
  console.log(`SafePay backend & Authenticator Gatekeeper active on http://localhost:${PORT}`);
  console.log(`WebSocket Server active on ws://localhost:${PORT}`);
});
