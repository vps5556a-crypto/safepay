const fs = require('fs');
const path = require('path');

const MODEL_PATH = path.join(__dirname, '..', 'data', 'safepay_nlp_model.json');

let modelData = null;

function loadModel() {
  try {
    if (fs.existsSync(MODEL_PATH)) {
      const raw = fs.readFileSync(MODEL_PATH, 'utf8');
      modelData = JSON.parse(raw);
      console.log(`[NLP] Loaded SafePay NLP model version ${modelData.model} (${modelData.vocabulary_size} features, trained accuracy: ${(modelData.metrics?.accuracy * 100).toFixed(1)}%)`);
    } else {
      console.warn(`[NLP] Model file not found at ${MODEL_PATH}. Using heuristic fallback.`);
    }
  } catch (error) {
    console.error('[NLP] Failed to load NLP model:', error);
    modelData = null;
  }
}

// Load on initialization
loadModel();

/**
 * Text Preprocessing mirroring Python ml/preprocess.py
 */
function cleanText(text) {
  if (typeof text !== 'string') return '';
  let cleaned = text.normalize('NFKC');
  // Strip HTML
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  // Currency normalization: Rs., INR, Rs to ₹
  cleaned = cleaned.replace(/\b(Rs\.?|INR)\s*/gi, '₹');
  // URL detection
  cleaned = cleaned.replace(/https?:\/\/\S+|www\.\S+/gi, ' http_url ');
  // Phone number masking
  cleaned = cleaned.replace(/(\+91[-\s]?)?[6-9]\d{9}/g, ' phone_number ');
  // UPI ID format
  cleaned = cleaned.replace(/[a-zA-Z0-9.\-_]+@[a-zA-Z]+/g, ' upi_id ');
  // Whitespaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned.toLowerCase();
}

function sigmoid(z) {
  return 1.0 / (1.0 + Math.exp(-z));
}

/**
 * Classifies an incoming message using the trained TF-IDF + Logistic Regression model.
 * 
 * Returns:
 * {
 *   is_scam: boolean,
 *   category: string,
 *   confidence: number,
 *   probability: number,
 *   model: "safepay-nlp-v1.0"
 * }
 */
function classifyMessage(text) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return {
      is_scam: false,
      category: 'LEGITIMATE',
      confidence: 1.0,
      probability: 0.0,
      model: 'safepay-nlp-v1.0'
    };
  }

  const cleaned = cleanText(text);

  // If model is loaded, compute inference
  if (modelData && modelData.vocabulary && modelData.coefficients) {
    const words = cleaned.split(' ');
    
    // Extract unigrams and bigrams
    const ngrams = [...words];
    for (let i = 0; i < words.length - 1; i++) {
      ngrams.push(`${words[i]} ${words[i + 1]}`);
    }

    const vocab = modelData.vocabulary;
    const idf = modelData.idf;
    const coef = modelData.coefficients;
    const intercept = modelData.intercept;

    // Count n-gram occurrences
    const tfCounts = {};
    for (const ng of ngrams) {
      tfCounts[ng] = (tfCounts[ng] || 0) + 1;
    }

    // Dot product
    let dotProduct = intercept;
    for (const [ng, count] of Object.entries(tfCounts)) {
      if (vocab.hasOwnProperty(ng)) {
        const idx = vocab[ng];
        const tfIdf = (1.0 + (count - 1) * 0.5) * idf[idx];
        dotProduct += tfIdf * coef[idx];
      }
    }

    const probability = sigmoid(dotProduct);
    const isScam = probability >= 0.50;

    // Determine fine-grained category
    let category = 'LEGITIMATE';
    if (isScam) {
      category = 'OTHER_FINANCIAL_SCAM';
      let bestScore = 0;
      const categoriesDict = modelData.categories || {};
      for (const [cat, keywords] of Object.entries(categoriesDict)) {
        let matches = 0;
        for (const kw of keywords) {
          if (cleaned.includes(kw)) matches++;
        }
        if (matches > bestScore) {
          bestScore = matches;
          category = cat;
        }
      }

      // Priority keyword mapping
      if (cleaned.includes('otp')) {
        category = 'OTP_THEFT';
      } else if (cleaned.includes('pin')) {
        category = 'PIN_THEFT';
      } else if (cleaned.includes('block') || cleaned.includes('suspended') || cleaned.includes('yono')) {
        category = 'BANK_PHISHING';
      } else if (cleaned.includes('kyc') || cleaned.includes('aadhaar') || cleaned.includes('pan')) {
        category = 'KYC_SCAM';
      } else if (cleaned.includes('won') || cleaned.includes('prize') || cleaned.includes('lottery')) {
        category = 'PRIZE_SCAM';
      } else if (cleaned.includes('loan')) {
        category = 'LOAN_SCAM';
      } else if (cleaned.includes('job') || cleaned.includes('earn')) {
        category = 'JOB_SCAM';
      } else if (cleaned.includes('police') || cleaned.includes('warrant')) {
        category = 'POLICE_IMPERSONATION';
      } else if (cleaned.includes('post') || cleaned.includes('parcel') || cleaned.includes('bluedart')) {
        category = 'DELIVERY_SCAM';
      }
    }

    const confidence = isScam ? probability : (1.0 - probability);

    return {
      is_scam: isScam,
      category,
      confidence: Math.round(confidence * 100) / 100,
      probability: Math.round(probability * 100) / 100,
      model: modelData.model || 'safepay-nlp-v1.0'
    };
  }

  // Graceful heuristic fallback if model file missing
  const lower = cleaned;
  const isScamHeuristic = (
    lower.includes('otp') ||
    lower.includes('pin') ||
    (lower.includes('block') && lower.includes('send')) ||
    (lower.includes('won') && lower.includes('fee')) ||
    lower.includes('kyc expire')
  );

  return {
    is_scam: isScamHeuristic,
    category: isScamHeuristic ? 'OTHER_FINANCIAL_SCAM' : 'LEGITIMATE',
    confidence: 0.85,
    probability: isScamHeuristic ? 0.85 : 0.15,
    model: 'safepay-heuristic-fallback'
  };
}

module.exports = {
  classifyMessage,
  loadModel
};
