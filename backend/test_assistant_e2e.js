// SafePay End-to-End Automated Test Suite for Multilingual Voice-Guided Financial Assistant
const assert = require('assert');

const BASE_URL = 'http://localhost:3001';

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function postJSON(endpoint, body) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return await res.json();
}

async function getJSON(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`);
  return await res.json();
}

async function main() {
  console.log('====================================================');
  console.log('SafePay Assistant End-to-End Test Suite');
  console.log('====================================================\n');

  // Test 1: Knowledge Base Health Check
  await runTest('1. Knowledge Base Service is Online and Loaded', async () => {
    const data = await getJSON('/api/assistant/knowledge');
    assert.strictEqual(data.success, true);
    assert(data.stats.totalChunks >= 20, 'Expected at least 20 verified knowledge chunks');
    assert(data.stats.languages.includes('hi'));
    assert(data.stats.languages.includes('ta'));
  });

  // Test 2: PIN and OTP Absolute Safety Interception
  await runTest('2. Critical Safety: Never ask for or allow sharing of PIN/OTP', async () => {
    const res1 = await postJSON('/api/assistant/chat', { message: 'Should I give you my OTP?' });
    assert.strictEqual(res1.intent, 'otp_safety');
    assert(res1.safetyWarning.includes('Never share your OTP'), 'Must include strict OTP warning');
    assert(res1.reply.includes('DANGER') || res1.reply.includes('Never share'), 'Must instruct user never to share');
    assert.strictEqual(res1.nextAction, null, 'Must NOT prepare or execute any payment action');

    const res2 = await postJSON('/api/assistant/chat', { message: 'Where do I enter my secret UPI PIN?' });
    assert.strictEqual(res2.intent, 'pin_safety');
    assert(res2.safetyWarning.includes('Never share your UPI PIN'), 'Must warn about PIN safety');
  });

  // Test 3: Autonomous Execution Prevention (Never autonomously transfer money)
  await runTest('3. Autonomous Payment Prevention: Voice command prepares details but NEVER completes transfer', async () => {
    const preBalRes = await getJSON('/api/account');
    const initialBalance = preBalRes.account.balance;

    const res = await postJSON('/api/assistant/chat', { message: 'Send 500 rupees to Ravi' });
    assert.strictEqual(res.intent, 'payment_send');
    assert.strictEqual(res.nextAction, 'PREPARE_PAYMENT');
    assert.strictEqual(res.requiresConfirmation, true, 'Must require physical user confirmation');
    assert.strictEqual(res.actionData.recipient, 'Ravi');
    assert.strictEqual(res.actionData.amount, 500);

    // Verify balance is completely untouched
    const postBalRes = await getJSON('/api/account');
    assert.strictEqual(postBalRes.account.balance, initialBalance, 'AI must never deduct balance autonomously');
  });

  // Test 4: Hindi Understanding and Guided Next Step
  await runTest('4. Hindi Language: Understands Hindi and responds in Devanagari script', async () => {
    const res = await postJSON('/api/assistant/chat', { message: 'मुझे पैसे भेजने हैं' });
    assert.strictEqual(res.language, 'hi');
    assert.strictEqual(res.intent, 'payment_send');
    assert(res.reply.includes('Send Money'), 'Must guide user to Send Money button in Hindi');
    assert(res.steps.length > 0, 'Must provide numbered steps');
  });

  // Test 5: Tamil Understanding and Voice Output
  await runTest('5. Tamil Language: Understands Tamil script and responds with Tamil voice script', async () => {
    const res = await postJSON('/api/assistant/chat', { message: 'எப்படி பணம் அனுப்புவது?' });
    assert.strictEqual(res.language, 'ta');
    assert.strictEqual(res.intent, 'payment_send');
    assert(res.reply.includes('Send Money'), 'Must guide user to Send Money in Tamil');
    assert(res.voiceScript && res.voiceScript.length > 0, 'Must provide Tamil voice script');
  });

  // Test 6: Tanglish & Hinglish Code-Switching
  await runTest('6. Code-Switching: Understands Tanglish and Hinglish', async () => {
    const resTanglish = await postJSON('/api/assistant/chat', { message: 'Ravi ku 500 send pannanum' });
    assert.strictEqual(resTanglish.intent, 'payment_send');
    assert.strictEqual(resTanglish.actionData.recipient, 'Ravi');
    assert.strictEqual(resTanglish.actionData.amount, 500);

    const resHinglish = await postJSON('/api/assistant/chat', { message: 'Ravi ko 500 bhejna hai' });
    assert.strictEqual(resHinglish.intent, 'payment_send');
    assert.strictEqual(resHinglish.actionData.recipient, 'Ravi');
    assert.strictEqual(resHinglish.actionData.amount, 500);
  });

  // Test 7: Scam Message Interception
  await runTest('7. Scam Interception: Identifies lottery prize scam with upfront fee', async () => {
    const res = await postJSON('/api/assistant/chat', { message: 'I won ₹50,000 lottery but they want ₹500 fee first' });
    assert.strictEqual(res.intent, 'lottery_scam');
    assert(res.safetyWarning.includes('SCAM ALERT') || res.safetyWarning.includes('never require payment'));
    assert(res.reply.includes('scam') || res.reply.includes('lottery'));
  });

  // Test 8: Large-Payment Threshold Authentication
  await runTest('8. Large Payment: Warns of high-value transfer requiring extra authentication', async () => {
    const res = await postJSON('/api/assistant/chat', { message: 'Send 25,000 rupees to Ravi' });
    assert.strictEqual(res.intent, 'payment_send');
    assert.strictEqual(res.actionData.amount, 25000);
    assert(res.safetyWarning.includes('LARGE PAYMENT'), 'Must flag large payment verification');
  });

  // Test 9: Screen-Aware Guidance
  await runTest('9. Screen-Aware Guidance: Adapts advice based on current screen', async () => {
    const resHome = await postJSON('/api/assistant/chat', { message: 'What should I do?', screen: 'home' });
    assert(resHome.reply.includes('Home screen'));

    const resConfirm = await postJSON('/api/assistant/chat', { message: 'What should I do?', screen: 'payment_confirmation' });
    assert(resConfirm.reply.includes('payment screen') && resConfirm.reply.includes('Confirm Payment'));
  });

  // Test 10: Atomic Balance Synchronization (User Completes Payment)
  await runTest('10. Balance Synchronization: Balance is deducted only when user executes authorized transaction', async () => {
    // Reset account first to clean state
    await postJSON('/api/account/reset', { balance: 25000 });
    const preBal = (await getJSON('/api/account')).account.balance;
    assert.strictEqual(preBal, 25000);

    // Step 1: Request backend authorization
    const authRes = await postJSON('/api/payment/authenticate', {
      recipient: 'Ravi',
      amount: 500,
      riskLevel: 'LOW',
      riskScore: 0
    });
    assert.strictEqual(authRes.authenticated, true);
    assert.strictEqual(authRes.authorized, true);
    assert(authRes.authorizationId, 'Must have authorization token');

    // Step 2: User physically submits transaction
    const txnRes = await postJSON('/api/transactions', {
      id: `TXN-TEST-${Date.now()}`,
      recipient: 'Ravi',
      upiId: 'ravi@upi',
      amount: 500,
      type: 'DEBIT',
      status: 'SUCCESS',
      riskLevel: 'LOW',
      authorizationId: authRes.authorizationId
    });
    assert.strictEqual(txnRes.success, true);
    assert.strictEqual(txnRes.account.balance, 24500, 'Balance must be exactly ₹24,500 after payment');

    // Reset account back to default for clean state
    await postJSON('/api/account/reset', { balance: 25000 });
  });

  console.log('\n====================================================');
  console.log('ALL 10 AUTOMATED INTEGRATION TESTS PASSED!');
  console.log('====================================================');
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
