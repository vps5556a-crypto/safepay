const { Ollama } = require('ollama');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
let OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:latest';

const ollama = new Ollama({ host: OLLAMA_HOST });

// Fast check if Ollama is available
async function checkOllamaAvailability(timeoutMs = 1500) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const models = data.models ? data.models.map(m => m.name) : [];
      return { available: true, models, activeModel: OLLAMA_MODEL };
    }
    return { available: false, error: 'Ollama returned non-200' };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

async function analyzeMessageWithOllama(messageContext, timeoutMs = 4000) {
  try {
    const prompt = `
You are a digital-payment safety assistant.
Analyze the provided message for potential financial scams, manipulation, fraud indicators, or suspicious payment requests.

Message context:
- Message: "${messageContext.message || 'None'}"
- Recipient: ${messageContext.recipient || 'Unknown'}
- Amount: ${messageContext.amount || 'Unknown'}
- Is New Recipient: ${messageContext.isNewRecipient ? 'Yes' : 'No'}

Return ONLY valid JSON.
The output should contain EXACTLY these keys:
- "is_suspicious" (boolean)
- "risk_level" (string: "LOW", "MEDIUM", "HIGH", or "CRITICAL")
- "scam_type" (string: e.g. "account_verification_scam", "prize_scam", "cashback_fraud", "urgency_manipulation", "none")
- "confidence" (number between 0 and 1)
- "reasons" (array of strings explaining why in simple plain language)
- "payment_request_detected" (boolean)
- "sensitive_information_requested" (boolean)
- "recommended_action" (string)

Do not include any explanation outside of the JSON block. Do not use markdown backticks around the JSON.
`;

    // Timeout race to prevent blocking when Ollama is busy or offline
    const generatePromise = ollama.generate({
      model: OLLAMA_MODEL,
      prompt: prompt,
      format: 'json',
      stream: false,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Ollama request timed out')), timeoutMs)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);

    let result;
    try {
      const rawText = (response.response || '').trim();
      // Clean possible backticks or markdown if model added them
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch (e) {
      console.warn('Failed to parse Ollama response as JSON, falling back:', e.message);
      return null;
    }

    return result;
  } catch (error) {
    console.warn(`Ollama analysis bypassed (${error.message}). Using deterministic safety layer.`);
    return null;
  }
}

module.exports = {
  analyzeMessageWithOllama,
  checkOllamaAvailability
};
