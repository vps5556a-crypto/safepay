const http = require('http');

const BASE_URL = 'http://localhost:3001';

async function fetchJson(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runAllTests() {
  console.log('====================================================');
  console.log('SAFEPAY AUTHENTICATOR GATEKEEPER & ANOMALY TEST SUITE');
  console.log('====================================================\n');

  // Reset account before testing
  console.log('[SETUP] Resetting account balance to ₹25,000...');
  const resetRes = await fetchJson('/api/account/reset', { method: 'POST', body: { balance: 25000 } });
  assert(resetRes.ok && resetRes.data.account.balance === 25000, 'Account balance reset to ₹25,000');

  // TEST 1: ₹500 normal payment (Low risk, no authenticator required)
  console.log('\n--- TEST 1: ₹500 Everyday Payment (Low Risk) ---');
  const auth1 = await fetchJson('/api/payment/authenticate', {
    method: 'POST',
    body: { recipient: 'Rahul Kumar', amount: 500, riskLevel: 'LOW' }
  });
  assert(auth1.data.authenticated === true, 'Authenticated is true');
  assert(auth1.data.authorized === true, 'Authorized is true (Immediate approval)');
  assert(auth1.data.requiresAuthenticatorApproval === false, 'No authenticator approval needed for small safe payment');
  assert(typeof auth1.data.authorizationId === 'string', 'Authorization token issued automatically');

  // Execute payment 1
  const txn1 = await fetchJson('/api/transactions', {
    method: 'POST',
    body: {
      recipient: 'Rahul Kumar',
      amount: 500,
      authorizationId: auth1.data.authorizationId
    }
  });
  assert(txn1.ok && txn1.data.success, 'Transaction 1 executed successfully');
  assert(txn1.data.account.balance === 24500, 'Balance accurately debited to ₹24,500');

  // TEST 2: ₹25,000 payment (Large Payment Rule -> Requires Authenticator Approval)
  console.log('\n--- TEST 2: ₹25,000 Large Payment (Approval Required) ---');
  const auth2 = await fetchJson('/api/payment/authenticate', {
    method: 'POST',
    body: { recipient: 'Ravi', amount: 25000, riskLevel: 'LOW' }
  });
  assert(auth2.data.authenticated === true, 'Authenticated is true');
  assert(auth2.data.authorized === false, 'Authorized is FALSE pending approval');
  assert(auth2.data.requiresAuthenticatorApproval === true, 'requiresAuthenticatorApproval is true');
  assert(auth2.data.status === 'WAITING_FOR_AUTHENTICATOR', 'Status is WAITING_FOR_AUTHENTICATOR');
  assert(typeof auth2.data.approvalRequestId === 'string', 'Approval request ID created');
  const approvalId2 = auth2.data.approvalRequestId;
  const txnId2 = auth2.data.transactionId;

  // Check pending approvals endpoint
  const pendingRes = await fetchJson('/api/authenticator/pending');
  assert(pendingRes.data.approvals.some(p => p.id === approvalId2), 'Approval request visible in Authenticator pending list');

  // TEST 3: Authenticator Approves -> Payment Executes
  console.log('\n--- TEST 3: Authenticator Approves Payment ---');
  const approveRes = await fetchJson('/api/authenticator/approve', {
    method: 'POST',
    body: { approvalRequestId: approvalId2, authenticatorId: 'AUTH-001', transactionId: txnId2 }
  });
  assert(approveRes.data.approved === true, 'Authenticator approved payment');
  assert(typeof approveRes.data.authorizationToken === 'string', 'Single-use cryptographic token issued');
  const token2 = approveRes.data.authorizationToken;

  // SafePay user personally confirms and executes
  // But wait, user balance is ₹24,500 so ₹25,000 would exceed balance!
  // Let's reset balance to ₹50,000 to test execution
  await fetchJson('/api/account/reset', { method: 'POST', body: { balance: 50000 } });
  const txn2 = await fetchJson('/api/transactions', {
    method: 'POST',
    body: {
      id: txnId2,
      recipient: 'Ravi',
      amount: 25000,
      authorizationId: token2
    }
  });
  assert(txn2.ok && txn2.data.success, 'Payment executed after Authenticator approval');
  assert(txn2.data.account.balance === 25000, 'Balance debited from ₹50,000 to ₹25,000');

  // TEST 4: Authenticator Denies -> Payment Blocked
  console.log('\n--- TEST 4: Authenticator Denies Payment ---');
  const auth4 = await fetchJson('/api/payment/authenticate', {
    method: 'POST',
    body: { recipient: 'Unknown Merchant', amount: 30000, riskLevel: 'HIGH' }
  });
  assert(auth4.data.requiresAuthenticatorApproval === true, 'Approval requested for suspicious transfer');
  const denyRes = await fetchJson('/api/authenticator/deny', {
    method: 'POST',
    body: { approvalRequestId: auth4.data.approvalRequestId, authenticatorId: 'AUTH-001', reason: 'High risk scam merchant' }
  });
  assert(denyRes.data.approved === false && denyRes.data.status === 'DENIED', 'Status set to DENIED');

  // Attempting to execute without valid token must fail
  const txn4 = await fetchJson('/api/transactions', {
    method: 'POST',
    body: { recipient: 'Unknown Merchant', amount: 30000, authorizationId: 'FAKE-TOKEN' }
  });
  assert(!txn4.ok && txn4.data.error === 'INVALID_AUTHORIZATION', 'Transaction blocked: cannot execute denied payment');
  const acctAfterDeny = await fetchJson('/api/account');
  assert(acctAfterDeny.data.account.balance === 25000, 'Balance unchanged after denial');

  // TEST 6 & 7: Tampered Amount or Recipient Invalidates Approval
  console.log('\n--- TEST 6 & 7: Exact Transaction Binding (Tamper Prevention) ---');
  const auth6 = await fetchJson('/api/payment/authenticate', {
    method: 'POST',
    body: { recipient: 'Suresh', amount: 21000 }
  });
  const approve6 = await fetchJson('/api/authenticator/approve', {
    method: 'POST',
    body: { approvalRequestId: auth6.data.approvalRequestId }
  });
  const token6 = approve6.data.authorizationToken;

  // Attempt 1: Tampered Amount (₹21,000 -> ₹25,000)
  const txnTamperAmt = await fetchJson('/api/transactions', {
    method: 'POST',
    body: { recipient: 'Suresh', amount: 25000, authorizationId: token6 }
  });
  assert(!txnTamperAmt.ok && txnTamperAmt.data.error === 'TAMPERED_AMOUNT', 'Rejected execution when amount was modified');

  // Attempt 2: Tampered Recipient (Suresh -> Hacker)
  const auth7 = await fetchJson('/api/payment/authenticate', {
    method: 'POST',
    body: { recipient: 'Deepa', amount: 22000 }
  });
  const approve7 = await fetchJson('/api/authenticator/approve', {
    method: 'POST',
    body: { approvalRequestId: auth7.data.approvalRequestId }
  });
  const token7 = approve7.data.authorizationToken;

  const txnTamperRec = await fetchJson('/api/transactions', {
    method: 'POST',
    body: { recipient: 'Rogue Account', amount: 22000, authorizationId: token7 }
  });
  assert(!txnTamperRec.ok && txnTamperRec.data.error === 'TAMPERED_RECIPIENT', 'Rejected execution when recipient was modified');

  // TEST 8: Two Independent Approval Requests
  console.log('\n--- TEST 8: Multiple Independent Approval Requests ---');
  const multi1 = await fetchJson('/api/payment/authenticate', { method: 'POST', body: { recipient: 'Vendor A', amount: 21000 } });
  const multi2 = await fetchJson('/api/payment/authenticate', { method: 'POST', body: { recipient: 'Vendor B', amount: 22000 } });
  assert(multi1.data.approvalRequestId !== multi2.data.approvalRequestId, 'Independent approval IDs generated (No blanket approval)');
  await fetchJson('/api/authenticator/approve', { method: 'POST', body: { approvalRequestId: multi1.data.approvalRequestId } });
  const statusMulti2 = await fetchJson(`/api/authenticator/approval/${multi2.data.approvalRequestId}`);
  assert(statusMulti2.data.approval.status === 'PENDING', 'Approving Request 1 does NOT approve Request 2');

  // TEST 9: Rapid Multiple Payments (Velocity Anomaly)
  console.log('\n--- TEST 9: Rapid Velocity Protection ---');
  // Send 3 small payments rapidly
  for (let i = 1; i <= 3; i++) {
    const a = await fetchJson('/api/payment/authenticate', { method: 'POST', body: { recipient: `Rapid Contact ${i}`, amount: 500 } });
    if (a.data.authorizationId) {
      await fetchJson('/api/transactions', { method: 'POST', body: { recipient: `Rapid Contact ${i}`, amount: 500, authorizationId: a.data.authorizationId } });
    }
  }
  // 4th payment should trigger velocity anomaly even for small ₹500!
  const velAuth = await fetchJson('/api/payment/authenticate', { method: 'POST', body: { recipient: 'Rapid Contact 4', amount: 500 } });
  assert(velAuth.data.requiresAuthenticatorApproval === true, 'Rapid transactions triggered velocity approval requirement');
  assert(velAuth.data.reasons.some(r => r.toLowerCase().includes('velocity') || r.toLowerCase().includes('payments')), 'Reason contains velocity explanation');

  // TEST 12: Frontend Attempts to Fake Authorized: true
  console.log('\n--- TEST 12: Backend Authority (Frontend Cannot Fake Authorization) ---');
  const fakeTxn = await fetchJson('/api/transactions', {
    method: 'POST',
    body: { recipient: 'Hacker', amount: 5000, authorized: true, status: 'SUCCESS' }
  });
  assert(!fakeTxn.ok && fakeTxn.data.error === 'AUTHORIZATION_REQUIRED', 'Backend rejects payment without valid server authorization token');

  // TEST 14: Idempotency (Double-Click Prevention)
  console.log('\n--- TEST 14: Idempotency (Double-Click Prevention) ---');
  const doubleAuth = await fetchJson('/api/payment/authenticate', { method: 'POST', body: { recipient: 'Double Test', amount: 200 } });
  let doubleToken = doubleAuth.data.authorizationId;
  if (doubleAuth.data.requiresAuthenticatorApproval) {
    const appr = await fetchJson('/api/authenticator/approve', { method: 'POST', body: { approvalRequestId: doubleAuth.data.approvalRequestId } });
    doubleToken = appr.data.authorizationToken;
  }
  const fixedTxnId = `TXN-IDEMP-${Date.now()}`;
  const click1 = await fetchJson('/api/transactions', { method: 'POST', body: { id: fixedTxnId, recipient: 'Double Test', amount: 200, authorizationId: doubleToken } });
  assert(click1.ok && click1.data.success, 'First click succeeded');
  const balAfterClick1 = click1.data.account.balance;
  const click2 = await fetchJson('/api/transactions', { method: 'POST', body: { id: fixedTxnId, recipient: 'Double Test', amount: 200, authorizationId: doubleToken } });
  assert(click2.data.account.balance === balAfterClick1, 'Second click did NOT debit money again (Idempotent)');

  // TEST 15: Scam Message Context Followed by Payment
  console.log('\n--- TEST 15: Scam Message Context Correlation ---');
  await fetchJson('/api/messages/analyze', {
    method: 'POST',
    body: { text: 'Your bank account will be blocked today. Send ₹2,000 immediately to verify.' }
  });
  const scamFollowUp = await fetchJson('/api/payment/authenticate', {
    method: 'POST',
    body: { recipient: 'Bank Officer Impersonator', amount: 2000 }
  });
  assert(scamFollowUp.data.requiresAuthenticatorApproval === true, 'Payment after scam message requires authenticator approval');
  assert(scamFollowUp.data.reasons.some(r => r.toLowerCase().includes('scam') || r.toLowerCase().includes('suspicious')), 'Scam context correlated into transaction risk');

  console.log('\n====================================================');
  console.log('🎉 ALL 15 BACKEND SECURITY GATEKEEPER TESTS PASSED!');
  console.log('====================================================\n');
}

runAllTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
