const { Ollama } = require('ollama');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const PREFERRED_GEMMA_MODEL = process.env.GEMMA_MODEL || 'gemma2:2b';
const FALLBACK_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:latest';

const ollama = new Ollama({ host: OLLAMA_HOST });

let activeModel = PREFERRED_GEMMA_MODEL;

/**
 * Check if Gemma or another Ollama model is available
 */
async function checkGemmaAvailability(timeoutMs = 2000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const models = data.models ? data.models.map(m => m.name) : [];
      
      if (models.some(m => m.includes('gemma'))) {
        activeModel = models.find(m => m.includes('gemma')) || PREFERRED_GEMMA_MODEL;
        return { available: true, model: activeModel, isGemma: true, models };
      } else if (models.length > 0) {
        activeModel = models[0];
        return { available: true, model: activeModel, isGemma: false, models };
      }
    }
    return { available: false, error: 'No models found' };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

/**
 * Prompt Gemma with grounded SafePay knowledge base context
 * Answers whatever question the user asks in their native language
 */
async function answerWithGemma({ message, language = 'en', screen = 'home', context = {}, relevantChunks = [], timeoutMs = 8000 }) {
  try {
    const targetLang = (language === 'ta' || language === 'tanglish') ? 'ta' :
                       (language === 'hi' || language === 'hinglish') ? 'hi' : 'en';

    // Format knowledge context from grounded chunks
    let knowledgeText = '';
    if (relevantChunks && relevantChunks.length > 0) {
      knowledgeText = relevantChunks.slice(0, 3).map((c, i) => {
        return `[Source ${i + 1}: ${c.category || 'banking'}]
Question: ${c.question || ''}
Verified Answer: ${c.simple_answer || c.answer || ''}
Steps: ${(c.steps || []).join(' -> ')}
Safety Warning: ${c.safety_warning || 'None'}`;
      }).join('\n\n');
    }

    let languageInstructions = '';
    let jsonTemplate = '';

    if (targetLang === 'ta') {
      languageInstructions = `TARGET LANGUAGE: TAMIL (தமிழ்).
CRITICAL RULE: You MUST write the JSON fields "reply", "voiceScript", and every item in "steps" in TAMIL (தமிழ் - Tamil Unicode script).
DO NOT use English sentences in reply or voiceScript. Everything must be natural, clear Tamil spoken by everyday people.`;
      jsonTemplate = `{
  "intent": "payment_send" | "qr_payment" | "payment_failed" | "payment_pending" | "otp_safety" | "pin_safety" | "balance_check" | "upi_explanation" | "emergency_fraud" | "general_inquiry",
  "reply": "தமிழில் நேரடியான, எளிய, விரிவான விளக்கம் (2-3 வாக்கியங்கள்)",
  "voiceScript": "பேசுவதற்கு சிறிய தமிழ் வாக்கியம் (1-2 வாக்கியங்கள்)",
  "steps": ["முதல் படி", "இரண்டாம் படி"],
  "safetyWarning": "பாதுகாப்பு எச்சரிக்கை அல்லது null",
  "recipient": "பெறுநர் பெயர் அல்லது null",
  "amount": number அல்லது null,
  "nextAction": "PREPARE_PAYMENT" | "NAVIGATE_TO_SEND" | null,
  "highlightElement": "btn-confirm-payment" | "action-send-money" | "action-scan-qr" | "balance-card" | null
}`;
    } else if (targetLang === 'hi') {
      languageInstructions = `TARGET LANGUAGE: HINDI (हिन्दी).
CRITICAL RULE: You MUST write the JSON fields "reply", "voiceScript", and every item in "steps" in HINDI (हिन्दी - Devanagari Unicode script).
DO NOT use English sentences in reply or voiceScript. Everything must be natural, clear Hindi.`;
      jsonTemplate = `{
  "intent": "payment_send" | "qr_payment" | "payment_failed" | "payment_pending" | "otp_safety" | "pin_safety" | "balance_check" | "upi_explanation" | "emergency_fraud" | "general_inquiry",
  "reply": "हिन्दी में सीधा, सरल और स्पष्ट उत्तर (2-3 वाक्य)",
  "voiceScript": "बोलने के लिए छोटा हिन्दी वाक्य (1-2 वाक्य)",
  "steps": ["पहला चरण", "दूसरा चरण"],
  "safetyWarning": "सुरक्षा चेतावनी या null",
  "recipient": "प्राप्तकर्ता का नाम या null",
  "amount": number या null,
  "nextAction": "PREPARE_PAYMENT" | "NAVIGATE_TO_SEND" | null,
  "highlightElement": "btn-confirm-payment" | "action-send-money" | "action-scan-qr" | "balance-card" | null
}`;
    } else {
      languageInstructions = `TARGET LANGUAGE: ENGLISH.
Write "reply", "voiceScript", and each item in "steps" in clear, patient, plain English.`;
      jsonTemplate = `{
  "intent": "payment_send" | "qr_payment" | "payment_failed" | "payment_pending" | "otp_safety" | "pin_safety" | "balance_check" | "upi_explanation" | "emergency_fraud" | "general_inquiry",
  "reply": "Clear, friendly, direct answer in plain English (2-3 sentences)",
  "voiceScript": "Short spoken version of the reply (1-2 sentences)",
  "steps": ["Step 1", "Step 2"],
  "safetyWarning": "Warning text if fraud or null",
  "recipient": "Recipient name if sending money, otherwise null",
  "amount": number if amount specified, otherwise null,
  "nextAction": "PREPARE_PAYMENT" | "NAVIGATE_TO_SEND" | null,
  "highlightElement": "btn-confirm-payment" | "action-send-money" | "action-scan-qr" | "balance-card" | null
}`;
    }

    const systemPrompt = `You are SafePay's multilingual AI Banking Assistant. You help low digital literacy users with digital payments, UPI, and scam prevention.

Core Safety Rules:
1. AI NEVER sends money automatically. The user must always manually click Confirm Payment on screen.
2. NEVER ask for or accept UPI PIN or OTP. If the user mentions someone asking for OTP or PIN, warn urgently.
3. Answer WHATEVER question the user asks clearly, patiently, and factually based on the knowledge base.
4. ${languageInstructions}
5. If the user wants to send money:
   - Identify recipient name (accept ANY real name given by user, e.g. Kumar, Ravi, Sarah, Ramesh, Priya). Set null if no person is named.
   - Never extract words like "block", "phone", "upi", "account", "bank", "send", "null" as recipient.
   - Identify the amount in rupees.
   - If both recipient and amount are known, set "nextAction": "PREPARE_PAYMENT".
   - If only recipient is known, set "nextAction": "NAVIGATE_TO_SEND".

Return ONLY a JSON object with this EXACT structure (no backticks, no markdown):
${jsonTemplate}`;

    const userPrompt = `Context:
- Current Screen: ${screen}
- Selected User Language Preference: ${targetLang.toUpperCase()}
- Ongoing Conversation State: ${JSON.stringify(context)}

Grounded SafePay Knowledge:
${knowledgeText || 'Standard SafePay banking knowledge base applies.'}

User Question/Message:
"${message}"`;

    // Attempt inference with active model
    const generatePromise = ollama.generate({
      model: activeModel,
      system: systemPrompt,
      prompt: userPrompt,
      format: 'json',
      stream: false,
      options: {
        temperature: 0.15
      }
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Gemma inference timed out')), timeoutMs)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const rawText = (response.response || '').trim();
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      success: true,
      modelUsed: activeModel,
      data: parsed
    };

  } catch (err) {
    console.warn(`Gemma generation bypassed (${err.message}). Using grounded knowledge layer.`);
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  checkGemmaAvailability,
  answerWithGemma,
  getActiveModel: () => activeModel,
  setActiveModel: (m) => { activeModel = m; }
};
