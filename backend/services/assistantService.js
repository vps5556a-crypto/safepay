const fs = require('fs');
const path = require('path');
const { answerWithGemma, checkGemmaAvailability } = require('./gemmaService');

// In-memory Knowledge Base Store
let knowledgeChunks = [];

/**
 * Load and normalize all JSON knowledge files from backend/knowledge/
 */
function loadKnowledgeBase() {
  const baseDir = path.join(__dirname, '..', 'knowledge');
  knowledgeChunks = [];

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.json')) {
        try {
          const raw = fs.readFileSync(fullPath, 'utf8');
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            knowledgeChunks.push(...data);
          } else if (data && typeof data === 'object') {
            knowledgeChunks.push(data);
          }
        } catch (e) {
          console.warn(`Could not parse knowledge file: ${fullPath}`, e.message);
        }
      }
    }
  }

  scanDir(baseDir);
  console.log(`SafePay Knowledge Base initialized with ${knowledgeChunks.length} verified chunks.`);
}

// Initial load
loadKnowledgeBase();

/**
 * Detect language from text or respect user preference
 */
function detectLanguage(text = '', preferredLanguage = 'auto') {
  const normPref = (preferredLanguage || '').toLowerCase().trim();
  if (normPref === 'ta' || normPref === 'tamil' || normPref === 'tanglish') return 'ta';
  if (normPref === 'hi' || normPref === 'hindi' || normPref === 'hinglish') return 'hi';
  if (normPref === 'en' || normPref === 'english') return 'en';

  // Devanagari script check (Hindi)
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi';
  }

  // Tamil script check
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return 'ta';
  }

  const lower = text.toLowerCase();

  // Tanglish markers (Tamil in Latin script) -> Map to 'ta' so voice & text are Tamil!
  const tanglishWords = ['epdi', 'panradhu', 'pannanum', 'anupanum', 'anuppa', 'anuppu', 'irukku', 'enga', 'mudiyuma', 'kaatunga', 'ku', 'thaanaa', 'unmaiyaa', 'kekuranga', 'venam', 'kudukalama', 'kaasu', 'rooba', 'roobai', 'solunga', 'enna'];
  if (tanglishWords.some(w => new RegExp(`(?:^|\\s)${w}(?:\\s|$)`, 'i').test(lower))) {
    return 'ta';
  }

  // Hinglish markers (Hindi in Latin script) -> Map to 'hi' so voice & text are Hindi!
  const hinglishWords = ['paise', 'bhejna', 'bhejo', 'karo', 'kardo', 'kaise', 'kahaan', 'daal', 'chahiye', 'lagta', 'jeeta', 'aaya', 'aane', 'bheje', 'maang', 'dedu', 'mujhe', 'mera', 'meri', 'dabau', 'batao', 'karen', 'rupaye'];
  if (hinglishWords.some(w => new RegExp(`(?:^|\\s)${w}(?:\\s|$)`, 'i').test(lower))) {
    return 'hi';
  }

  return 'en';
}

/**
 * Clean Tamil recipient name by stripping dative case suffixes
 * e.g. 'குமாருக்கு' -> 'குமார்', 'சுரேஷுக்கு' -> 'சுரேஷ்', 'சரவணனுக்கு' -> 'சரவணன்', 'அனிதாவுக்கு' -> 'அனிதா'
 */
function cleanTamilRecipient(word) {
  if (!word) return '';
  let w = word.trim();
  w = w.replace(/^[^a-zA-Z\u0B80-\u0BFF]+|[^a-zA-Z\u0B80-\u0BFF]+$/g, '');

  if (w.endsWith('வுக்கு') || w.endsWith('விற்கு')) {
    return w.slice(0, -'வுக்கு'.length);
  }
  if (w.endsWith('ிற்கு')) {
    return w.slice(0, -'ிற்கு'.length);
  }
  if (w.endsWith('ற்கு')) {
    return w.slice(0, -'ற்கு'.length);
  }
  if (w.endsWith('க்கு')) {
    let base = w.slice(0, -'க்கு'.length);
    if (base.endsWith('\u0BC1')) {
      return base.slice(0, -1) + '\u0BCD';
    }
    return base;
  }
  return w;
}

/**
 * Clean Hindi recipient name by stripping dative marker 'को'
 */
function cleanHindiRecipient(word) {
  if (!word) return '';
  let w = word.trim();
  w = w.replace(/\s*(?:जी\s*)?को$/g, '').trim();
  return w.replace(/^[^a-zA-Z\u0900-\u097F]+|[^a-zA-Z\u0900-\u097F]+$/g, '');
}

// Canonical recipient mappings for common relations and contacts
const RECIPIENT_MAPPINGS = [
  { canonical: 'Ravi', variants: ['ravi', 'ரவி', 'ரவிக்கு', 'रवि', 'रवि को'] },
  { canonical: 'Rahul', variants: ['rahul kumar', 'rahul', 'ராகுல்', 'ராகுலுக்கு', 'राहुल', 'राहुल को'] },
  { canonical: 'Priya', variants: ['priya sharma', 'priya', 'பிரியா', 'பிரியாவுக்கு', 'प्रिया', 'प्रिया को'] },
  { canonical: 'Kumar', variants: ['kumar', 'குமார்', 'குமாருக்கு', 'कुमार', 'कुमार को'] },
  { canonical: 'Mom', variants: ['mom', 'mother', 'அம்மா', 'அம்மாவுக்கு', 'माँ', 'मम्मी', 'माँ को'] },
  { canonical: 'Dad', variants: ['dad', 'father', 'அப்பா', 'அப்பாவுக்கு', 'पापा', 'पिताजी'] },
  { canonical: 'Grocery Mart', variants: ['grocery mart', 'மளிகைக் கடை', 'மளிகை கடை', 'किराना', 'किराने की दुकान'] },
  { canonical: 'Milk Booth', variants: ['milk booth', 'பால் கடை', 'பால்கடை', 'दूध बूथ'] },
  { canonical: 'Auto Driver', variants: ['auto driver', 'auto', 'ஆட்டோ டிரைவர்', 'ஆட்டோ', 'ऑटो'] }
];

// Spoken numbers dictionary (English, Hindi, Tamil, Hinglish, Tanglish)
const SPOKEN_NUMBERS = {
  'fifty': 50, 'hundred': 100, 'two hundred': 200, 'three hundred': 300, 'four hundred': 400, 'five hundred': 500,
  'thousand': 1000, 'one thousand': 1000, 'two thousand': 2000, 'five thousand': 5000, 'ten thousand': 10000,
  'twenty thousand': 20000, 'twenty five thousand': 25000, 'fifty thousand': 50000,
  'पचास': 50, 'सौ': 100, 'दो सौ': 200, 'तीन सौ': 300, 'चार सौ': 400, 'पांच सौ': 500, 
  'हज़ार': 1000, 'एक हज़ार': 1000, 'दो हज़ार': 2000, 'पांच हज़ार': 5000, 'दस हज़ार': 10000,
  'बीस हज़ार': 20000, 'पच्चीस हज़ार': 25000, 'पचास हज़ार': 50000,
  'ஐம்பது': 50, 'நூறு': 100, 'இருநூறு': 200, 'முந்நூறு': 300, 'நானூறு': 400, 'ஐந்நூறு': 500,
  'ஆயிரம்': 1000, 'ஓராயிரம்': 1000, 'இரண்டாயிரம்': 2000, 'ஐந்தாயிரம்': 5000,
  'பத்தாயிரம்': 10000, 'இருபதாயிரம்': 20000, 'இருபத்தைந்தாயிரம்': 25000, 'ஐம்பதாயிரம்': 50000,
  'pachaas': 50, 'sau': 100, 'do sau': 200, 'paanch sau': 500, 'hazaar': 1000,
  'aimbathu': 50, 'nooru': 100, 'irunooru': 200, 'ainnooru': 500, 'aayiram': 1000
};

/**
 * Extract entities (recipient and amount) dynamically with full multilingual support
 * Unconstrained to any specific name - extracts ANY recipient given by the user
 */
function extractEntities(text = '', context = {}) {
  let recipient = null;
  let amount = null;
  const tLower = text.toLowerCase().trim();

  // 1. Spoken words extraction: length-descending sort so compound phrases match first
  const sortedPhrases = Object.keys(SPOKEN_NUMBERS).sort((a, b) => b.length - a.length);
  for (const phrase of sortedPhrases) {
    if (tLower.includes(phrase.toLowerCase())) {
      amount = SPOKEN_NUMBERS[phrase];
      break;
    }
  }

  // 2. Numeric amount extraction (e.g. ₹500, 500 ரூபாய், 500 रुपये, 5,000, 50k)
  if (!amount) {
    const amtMatch = text.match(/(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\s*(?:k|thousand|rupees|rs|रुपये|ரூபாய்))?/i);
    if (amtMatch) {
      let cleanNum = amtMatch[1].replace(/,/g, '');
      let val = parseFloat(cleanNum);
      if (/k|thousand|हज़ार|ஆயிரம்/i.test(amtMatch[0]) && val < 1000) {
        val = val * 1000;
      }
      if (val > 0) {
        amount = val;
      }
    }
  }

  // 3. Known canonical mapping check
  for (const item of RECIPIENT_MAPPINGS) {
    for (const v of item.variants) {
      const vLower = v.toLowerCase();
      if (/^[a-z0-9\s]+$/i.test(vLower)) {
        if (new RegExp(`\\b${vLower}\\b`, 'i').test(tLower)) {
          recipient = item.canonical;
          break;
        }
      } else {
        if (tLower.includes(vLower)) {
          recipient = item.canonical;
          break;
        }
      }
    }
    if (recipient) break;
  }

  // 4. Dynamic Tamil extraction with dative markers (e.g. குமாருக்கு, சுரேஷுக்கு, பாலாவுக்கு)
  if (!recipient) {
    const taDativeMatch = text.match(/([\u0B80-\u0BFF]+?)(?:க்கு|வுக்கு|ிற்கு|ற்கு|உக்கு)(?:[\s,.]|$)/);
    if (taDativeMatch) {
      const rawWord = taDativeMatch[0].trim().replace(/[,.]$/, '');
      const cleaned = cleanTamilRecipient(rawWord);
      const nonRecipients = ['எனக்கு', 'உனக்கு', 'யாருக்கு', 'வங்கிக்கு', 'கணக்கு', 'பணம்', 'ரூபாய்', 'உதவி'];
      if (!nonRecipients.includes(cleaned) && cleaned.length >= 2) {
        const matchCanonical = RECIPIENT_MAPPINGS.find(m => m.variants.some(v => v.includes(cleaned)));
        recipient = matchCanonical ? matchCanonical.canonical : cleaned;
      }
    }
  }

  // 5. Dynamic Hindi extraction with 'को' (e.g. रोहन को, सोनू को, विकास को)
  if (!recipient) {
    const hiDativeMatch = text.match(/([\u0900-\u097F]+?)\s*(?:को|जी\s*को)(?:[\s,.]|$)/);
    if (hiDativeMatch) {
      const cleaned = hiDativeMatch[1].trim();
      const nonRecipients = ['मुझको', 'किसको', 'बैंक', 'खाते', 'पैसे', 'रुपये'];
      if (!nonRecipients.includes(cleaned) && cleaned.length >= 2) {
        const matchCanonical = RECIPIENT_MAPPINGS.find(m => m.variants.some(v => v.includes(cleaned)));
        recipient = matchCanonical ? matchCanonical.canonical : cleaned;
      }
    }
  }

  // 6. Tanglish: 'Kumar ku' / 'Kumarku' / 'Bala kku'
  if (!recipient) {
    const tangMatch = text.match(/\b([A-Za-z]+)\s*(?:ku|kku)\b/i);
    if (tangMatch && !/^(?:send|money|pay|amount|paise|rupees)$/i.test(tangMatch[1])) {
      recipient = tangMatch[1].charAt(0).toUpperCase() + tangMatch[1].slice(1).toLowerCase();
    }
  }

  // 7. Hinglish: 'Kumar ko' / 'Kumarko'
  if (!recipient) {
    const hingMatch = text.match(/\b([A-Za-z]+)\s*(?:ko)\b/i);
    if (hingMatch && !/^(?:paise|send|karo|bhejo|amount)$/i.test(hingMatch[1])) {
      recipient = hingMatch[1].charAt(0).toUpperCase() + hingMatch[1].slice(1).toLowerCase();
    }
  }

  // 8. English: 'Send 500 to Kumar' / 'Pay Sarah' / 'Transfer to Alex'
  if (!recipient) {
    const enMatch = text.match(/(?:(?:send|pay|transfer)\s+(?:₹?[0-9,]+\s+)?(?:to\s+)?|to\s+)([A-Za-z]+)/i);
    if (enMatch && !/^(?:money|account|bank|pay|confirm|rupees|inr|payment)$/i.test(enMatch[1])) {
      recipient = enMatch[1].charAt(0).toUpperCase() + enMatch[1].slice(1).toLowerCase();
    }
  }

  // 9. Multi-turn Follow-up: Name-only input when context already has amount or is awaiting recipient
  if (!recipient && (context.amount || context.waitingForRecipient || context.actionData?.amount)) {
    const cleanTurn = text.trim().replace(/^[^a-zA-Z\u0B80-\u0BFF\u0900-\u097F]+|[^a-zA-Z\u0B80-\u0BFF\u0900-\u097F]+$/g, '');
    const nonNames = /^(?:yes|no|ok|cancel|help|send|pay|பணம்|அனுப்பு|पैसे|भेजो|ரூபாய்|रुपये)$/i;
    if (cleanTurn.length >= 2 && !nonNames.test(cleanTurn)) {
      if (/[\u0B80-\u0BFF]/.test(cleanTurn)) {
        recipient = cleanTamilRecipient(cleanTurn);
      } else if (/[\u0900-\u097F]/.test(cleanTurn)) {
        recipient = cleanHindiRecipient(cleanTurn);
      } else {
        recipient = cleanTurn.charAt(0).toUpperCase() + cleanTurn.slice(1).toLowerCase();
      }
    }
  }

  return { recipient, amount };
}

/**
 * Classify user intent with high precision disambiguation
 */
function classifyIntent(text = '', screen = 'home') {
  const t = text.toLowerCase();

  // 1. Critical PIN & OTP Safety First
  if (/otp|one[\s-]time[\s-]password|6[\s-]digit[\s-]code|ओटीपी|ஓடிபி/i.test(t)) {
    return 'otp_safety';
  }
  if (/upi[\s-]pin|secret[\s-]pin|पिन|ரகசிய[\s-]எண்|enter[\s-]pin|pin[\s-]kisi|pin[\s-]enter|पिन\s*भूल|pin\s*change/i.test(t)) {
    return 'pin_safety';
  }

  // 2. Fraud & Scam Interception
  if (/lottery|prize|लॉटरी|இனாம்|பரிசு|lucky[\s-]draw|processing[\s-]fee|won\s+(?:car|lakh|crore|50|cash)/i.test(t)) {
    return 'lottery_scam';
  }
  if (/kyc|deactivate|ब्लॉक|முடக்கப்படும்|sim[\s-]deactivate|account[\s-]block/i.test(t)) {
    return 'kyc_safety';
  }
  if (/scammer|cheated|धोखा|மோசடி|cyber[\s-]crime|1930|galti[\s-]se|fraud[\s-]transaction/i.test(t)) {
    return 'emergency_fraud';
  }
  if (/refund|cashback|scratch[\s-]card|double[\s-]money|customs|electricity/i.test(t)) {
    return 'scam_detection';
  }

  // 3. Payment Issues & Failures
  if (/fail(?:ed|s|ing)?|தோல்வி|விफल|பிடித்தம்|பிடிக்கப்பட்டது|சேரவில்லை|கட்\s*ஆயி|कट\s*गए|debited.*(?:not|சேரவில்லை)|not\s*credited|money\s*debited/i.test(t)) {
    return 'payment_failed';
  }
  if (/pending|நிலுவை|நிலுவையில்|पेंडिंग|processing/i.test(t)) {
    return 'payment_pending';
  }

  // 4. Specific App & Payment Features
  if (/qr|qr[\s-]code|scan|barcode|ஸ்கேன்|கியூஆர்|स्कैन|क्यूआर/i.test(t)) {
    return 'qr_payment';
  }
  if (/upi[\s-]id|யூபிஐ[\s-]ஐடி|यूपीआई[\s-]आईडी|vpa/i.test(t)) {
    return 'upi_id';
  }

  // 5. UI & Screen Guidance
  if (/simple[\s-]mode|सरल[\s-]मोड|perusa|bada[\s-]text|easy[\s-]mode/i.test(t)) {
    return 'simple_mode';
  }
  if (/what[\s-]should[\s-]i[\s-](?:do|press)|explain[\s-]this|kya[\s-]karein|enna[\s-]pannanum|திரை|स्क्रीन/i.test(t)) {
    return 'screen_explanation';
  }
  if (/voice|speak|microphone|माइक|பேசுங்கள்|बोल/i.test(t)) {
    return 'voice_help';
  }

  // 6. Financial Literacy & Account Info
  if (/emi|interest|credit[\s-]score|savings|loan|ब्याज|लोन|வட்டி|கடன்|சிபில்/i.test(t)) {
    return 'financial_literacy';
  }
  if (/balance|बैलेंस|இருப்பு|bache|kitna[\s-]paisa|money[\s-]left/i.test(t)) {
    return 'balance_check';
  }
  if (/history|recent|पुराने|வரலாறு|past[\s-]payment|sent[\s-]recently/i.test(t)) {
    return 'transaction_history';
  }
  if (/what[\s-]is[\s-]upi|upi[\s-]kya|upi[\s-]na[\s-]enna|upi[\s-]என்றால்[\s-]என்ன/i.test(t)) {
    return 'upi_explanation';
  }

  // 7. Payment Execution Intent
  const ent = extractEntities(text);
  if (ent.recipient && ent.amount) {
    return 'payment_send';
  }

  if (/send|pay|transfer|भेज|பணம்|அனுப்ப|anupanum|bhejna|anuppa|anuppu|daal[\s-]do/i.test(t)) {
    return 'payment_send';
  }

  if (/(?:to|ku|kku|ko|க்கு|வுக்கு|உக்கு)\s*[0-9]+|[0-9]+\s*(?:rupees|rs|inr|ரூபாய்|रुपये)/i.test(t)) {
    return 'payment_send';
  }

  if (screen === 'payment_confirmation' || screen === 'send') {
    return 'payment_send';
  }

  return 'unknown_query';
}

/**
 * Tokenize text for lexical matching
 */
function tokenize(text = '') {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^a-zA-Z0-9\u0B80-\u0BFF\u0900-\u097F\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

/**
 * Retrieve the most relevant knowledge chunk using target-language-prioritized lexical scoring
 * Ensures Tamil requests get Tamil knowledge, and Hindi requests get Hindi knowledge.
 */
function retrieveKnowledge(query = '', intent = null, lang = 'en') {
  if (!query && !intent) return null;
  const targetLang = (lang === 'ta' || lang === 'tanglish') ? 'ta' :
                     (lang === 'hi' || lang === 'hinglish') ? 'hi' : 'en';

  const qTokens = tokenize(query);
  const cleanQ = query.toLowerCase().trim();

  // 1. FIRST PASS: Match within target language chunks
  const targetChunks = knowledgeChunks.filter(c => c.language === targetLang);
  let bestTargetChunk = null;
  let bestTargetScore = 0;

  for (const chunk of targetChunks) {
    let score = 0;
    if (intent && chunk.intent === intent) {
      score += 30; // Strong intent alignment
    }

    const qText = (chunk.question || '').toLowerCase();
    const aText = (chunk.simple_answer || chunk.answer || '').toLowerCase();
    const keywords = (chunk.keywords || []).map(k => k.toLowerCase());

    for (const tok of qTokens) {
      if (keywords.some(k => k === tok || k.includes(tok) || tok.includes(k))) score += 8;
      if (qText.includes(tok)) score += 5;
      if (aText.includes(tok)) score += 2;
    }

    if (cleanQ.length > 3) {
      for (const kw of keywords) {
        if (cleanQ.includes(kw)) score += 12;
      }
      if (qText.includes(cleanQ)) score += 15;
    }

    if (score > bestTargetScore) {
      bestTargetScore = score;
      bestTargetChunk = chunk;
    }
  }

  if (bestTargetChunk && bestTargetScore >= 10) {
    return bestTargetChunk;
  }

  // If intent matches a chunk in target language directly, return it
  if (intent && intent !== 'unknown_query') {
    const directIntent = targetChunks.find(c => c.intent === intent);
    if (directIntent) return directIntent;
  }

  // 2. SECOND PASS: Search fallback chunks (e.g. English) only if target language has no match
  let bestFallbackChunk = null;
  let bestFallbackScore = 0;

  for (const chunk of knowledgeChunks) {
    let score = 0;
    if (intent && chunk.intent === intent) score += 20;

    const qText = (chunk.question || '').toLowerCase();
    const aText = (chunk.simple_answer || chunk.answer || '').toLowerCase();
    const keywords = (chunk.keywords || []).map(k => k.toLowerCase());

    for (const tok of qTokens) {
      if (keywords.some(k => k === tok || k.includes(tok) || tok.includes(k))) score += 6;
      if (qText.includes(tok)) score += 4;
    }

    if (score > bestFallbackScore) {
      bestFallbackScore = score;
      bestFallbackChunk = chunk;
    }
  }

  return bestFallbackChunk;
}

/**
 * Generate low-literacy screen-aware responses powered by Google Gemma and grounded RAG knowledge
 * Answers whatever question the user asks naturally, safely, and accurately
 */
async function generateAssistantResponse({ message, language = 'auto', screen = 'home', context = {} }) {
  const detectedLang = detectLanguage(message, language);
  const targetLang = (detectedLang === 'ta' || detectedLang === 'tanglish') ? 'ta' :
                     (detectedLang === 'hi' || detectedLang === 'hinglish') ? 'hi' : 'en';

  const entities = extractEntities(message, context);
  const intent = classifyIntent(message, screen);

  const recipient = entities.recipient || context.recipient || null;
  const amount = entities.amount || context.amount || null;

  // Retrieve top matching knowledge chunks in target language
  const knowledge = retrieveKnowledge(message, intent, targetLang);
  const relevantChunks = knowledge ? [knowledge] : [];

  // FAST PATH 1: Direct Payment Execution (Immediate confirmation card without model latency)
  if (intent === 'payment_send' && recipient && amount) {
    let reply = '';
    let voiceScript = '';
    let steps = [];

    if (targetLang === 'hi') {
      reply = `आप ${recipient} को ₹${amount.toLocaleString('en-IN')} भेजना चाहते हैं। मैंने पेमेंट तैयार कर दिया है। कृपया नाम और रकम जांचकर खुद 'Confirm Payment' बटन दबाएं।`;
      voiceScript = `आप ${recipient} को ₹${amount} भेज रहे हैं। विवरण जांचकर खुद कन्फर्म करें।`;
      steps = [`प्राप्तकर्ता: ${recipient}`, `राशि: ₹${amount.toLocaleString('en-IN')}`, "खुद 'Confirm Payment' बटन दबाएं"];
    } else if (targetLang === 'ta') {
      reply = `நீங்கள் ${recipient}க்கு ₹${amount.toLocaleString('en-IN')} அனுப்ப விரும்புகிறீர்கள். விவரங்களைச் சரிபார்த்துவிட்டு நீங்களே 'Confirm Payment' பொத்தானை அழுத்தவும்.`;
      voiceScript = `நீங்கள் ${recipient}க்கு ₹${amount} அனுப்ப விரும்புகிறீர்கள். நீங்களே கன்ஃபர்ம் செய்யவும்.`;
      steps = [`பெறுநர்: ${recipient}`, `தொகை: ₹${amount.toLocaleString('en-IN')}`, "நீங்களே 'Confirm Payment' பொத்தானை அழுத்தவும்"];
    } else {
      reply = `You are sending ₹${amount.toLocaleString('en-IN')} to ${recipient}. This payment looks safe based on our checks. Please verify the name and amount, then press the 'Confirm Payment' button yourself.`;
      voiceScript = `You are sending ₹${amount} to ${recipient}. Please review and press Confirm Payment yourself.`;
      steps = [`Verify recipient: ${recipient}`, `Verify amount: ₹${amount.toLocaleString('en-IN')}`, "Press the Confirm Payment button yourself"];
    }

    return {
      reply,
      language: targetLang,
      intent: 'payment_send',
      confidence: 0.98,
      steps,
      nextAction: 'PREPARE_PAYMENT',
      actionData: { recipient, amount },
      requiresConfirmation: true,
      safetyWarning: null,
      speak: true,
      voiceScript,
      highlightElement: 'btn-confirm-payment'
    };
  }

  // FAST PATH 2: Critical OTP or PIN Theft Intercept
  if (intent === 'otp_safety') {
    return {
      reply: targetLang === 'ta' ? "எச்சரிக்கை! யாரிடமும் OTP எண்ணைப் பகிராதீர்கள். வங்கி அல்லது SafePay ஒருபோதும் OTP கேட்காது. உடனே அழைப்பைத் துண்டிக்கவும்." :
             targetLang === 'hi' ? "सावधान! किसी को भी अपना OTP न बताएं। बैंक, पुलिस या SafePay कभी भी फोन पर OTP नहीं मांगते। तुरंत फोन काट दें।" :
             "CRITICAL WARNING: Never share your OTP! No bank or official will ever ask for your OTP. Anyone asking for OTP is attempting to steal your money.",
      language: targetLang,
      intent: 'otp_safety',
      confidence: 0.99,
      steps: targetLang === 'ta' ? ["உடனே அழைப்பைத் துண்டிக்கவும்", "செய்திக்கு பதில் அளிக்க வேண்டாம்", "குறியீட்டை யாரிடமும் பகிராதீர்கள்"] :
             targetLang === 'hi' ? ["तुरंत फोन कॉल काट दें", "किसी भी मैसेज का जवाब न दें", "यह कोड कभी किसी को न बताएं"] :
             ["Hang up the phone immediately", "Do not reply to any messages", "Never tell anyone this code"],
      nextAction: null,
      actionData: null,
      requiresConfirmation: false,
      safetyWarning: targetLang === 'ta' ? "எச்சரிக்கை: யாரிடமும் OTP எண்ணைப் பகிராதீர்கள்!" : targetLang === 'hi' ? "सावधान: अपना OTP कभी किसी को न बताएं!" : "CRITICAL WARNING: Never share your OTP with anyone!",
      speak: true,
      voiceScript: targetLang === 'ta' ? "எச்சரிக்கை! யாரிடமும் OTP எண்ணைக் கூறாதீர்கள்." : targetLang === 'hi' ? "सावधान! अपना OTP किसी को न दें।" : "Critical warning! Never share your OTP with anyone.",
      highlightElement: null
    };
  }

  // INTELLIGENT GEMMA PATH: Grounded low-literacy guidance via Google Gemma
  try {
    const gemmaResult = await answerWithGemma({
      message,
      language: targetLang,
      screen,
      context: { ...context, recipient, amount },
      relevantChunks,
      timeoutMs: 6500
    });

    if (gemmaResult.success && gemmaResult.data && gemmaResult.data.reply) {
      const g = gemmaResult.data;
      const nonRecipients = ['block', 'stolen', 'phone', 'account', 'bank', 'null', 'undefined', 'upi', 'pin', 'money', 'payment', 'send', 'pay', 'confirm', 'help'];
      let finalRecipient = recipient || g.recipient || null;
      if (typeof finalRecipient === 'string' && nonRecipients.includes(finalRecipient.toLowerCase().trim())) {
        finalRecipient = null;
      }
      const finalAmount = amount || (typeof g.amount === 'number' ? g.amount : null);
      let finalNextAction = g.nextAction || null;
      let finalActionData = null;

      if (finalRecipient && finalAmount) {
        finalNextAction = 'PREPARE_PAYMENT';
        finalActionData = { recipient: finalRecipient, amount: finalAmount };
      } else if (finalRecipient) {
        finalActionData = { recipient: finalRecipient };
      } else if (finalAmount) {
        finalActionData = { amount: finalAmount };
      }

      let finalReply = g.reply || '';
      let finalVoiceScript = g.voiceScript || '';
      let finalSteps = Array.isArray(g.steps) && g.steps.length > 0 ? g.steps : (knowledge?.steps || []);

      // STRICT LANGUAGE GUARDRAILS: Validate that text matches user's chosen language
      if (targetLang === 'ta') {
        const hasTamil = /[\u0B80-\u0BFF]/.test(finalReply);
        if (!hasTamil && knowledge && (knowledge.language === 'ta')) {
          finalReply = knowledge.simple_answer || knowledge.answer;
          finalSteps = knowledge.steps || [];
        }
        if (!/[\u0B80-\u0BFF]/.test(finalVoiceScript)) {
          finalVoiceScript = /[\u0B80-\u0BFF]/.test(finalReply) ? finalReply : (knowledge?.simple_answer || "SafePay-ல் பணம் அனுப்பவும் சந்தேகங்களைத் தீர்க்கவும் உதவ தயாராக உள்ளேன்.");
        }
        if (Array.isArray(finalSteps) && finalSteps.some(s => !/[\u0B80-\u0BFF]/.test(s)) && knowledge && knowledge.language === 'ta') {
          finalSteps = knowledge.steps || [];
        }
      } else if (targetLang === 'hi') {
        const hasHindi = /[\u0900-\u097F]/.test(finalReply);
        if (!hasHindi && knowledge && (knowledge.language === 'hi')) {
          finalReply = knowledge.simple_answer || knowledge.answer;
          finalSteps = knowledge.steps || [];
        }
        if (!/[\u0900-\u097F]/.test(finalVoiceScript)) {
          finalVoiceScript = /[\u0900-\u097F]/.test(finalReply) ? finalReply : (knowledge?.simple_answer || "SafePay पर आप सुरक्षित रूप से पैसे भेज सकते हैं और मदद पा सकते हैं।");
        }
        if (Array.isArray(finalSteps) && finalSteps.some(s => !/[\u0900-\u097F]/.test(s)) && knowledge && knowledge.language === 'hi') {
          finalSteps = knowledge.steps || [];
        }
      }

      return {
        reply: finalReply,
        language: targetLang,
        intent: g.intent || intent,
        confidence: 0.95,
        steps: finalSteps,
        nextAction: finalNextAction,
        actionData: finalActionData,
        requiresConfirmation: finalNextAction === 'PREPARE_PAYMENT',
        safetyWarning: g.safetyWarning || knowledge?.safety_warning || null,
        speak: true,
        voiceScript: finalVoiceScript || finalReply,
        highlightElement: g.highlightElement || null,
        modelUsed: gemmaResult.modelUsed
      };
    }
  } catch (gemmaErr) {
    console.warn('Gemma execution error:', gemmaErr.message);
  }

  // DETERMINISTIC GROUNDED KNOWLEDGE FALLBACK (If Gemma timed out or model loading)
  let reply = '';
  let steps = [];
  let nextAction = null;
  let actionData = null;
  let safetyWarning = knowledge?.safety_warning || null;
  let voiceScript = '';
  let highlightElement = null;

  if (knowledge && (knowledge.simple_answer || knowledge.answer)) {
    reply = knowledge.simple_answer || knowledge.answer;
    steps = knowledge.steps || [];
    voiceScript = knowledge.simple_answer || knowledge.answer;
  } else if (intent === 'payment_send') {
    if (recipient && !amount) {
      nextAction = 'NAVIGATE_TO_SEND';
      actionData = { recipient };
      reply = targetLang === 'ta' ? `சரி, நீங்கள் ${recipient}க்கு பணம் அனுப்ப விரும்புகிறீர்கள். எவ்வளவு ரூபாய் அனுப்ப வேண்டும்? உதாரணம்: 500 ரூபாய்.` :
              targetLang === 'hi' ? `ठीक है, आप ${recipient} को पैसे भेजना चाहते हैं। आप कितने रुपये भेजना चाहते हैं? उदाहरण: 500 रुपये।` :
              `I see you want to send money to ${recipient}. How much would you like to send? Example: ₹500.`;
      steps = targetLang === 'ta' ? ["தொகையைக் குறிப்பிடவும்", "உதாரணம்: ₹500"] : targetLang === 'hi' ? ["रकम बताएं", "उदाहरण: ₹500"] : ["Specify amount", "Example: ₹500"];
    } else if (!recipient && amount) {
      actionData = { amount };
      reply = targetLang === 'ta' ? `சரி, நீங்கள் ₹${amount.toLocaleString('en-IN')} அனுப்ப விரும்புகிறீர்கள். யாருக்கு பணம் அனுப்ப வேண்டும்?` :
              targetLang === 'hi' ? `ठीक है, आप ₹${amount.toLocaleString('en-IN')} भेजना चाहते हैं। आप किसे पैसे भेजना चाहते हैं?` :
              `Got it, you want to send ₹${amount.toLocaleString('en-IN')}. Who would you like to send it to?`;
      steps = targetLang === 'ta' ? ["பெறுநர் பெயரைக் கூறவும்", "உதாரணம்: ரவி அல்லது குமார்"] : targetLang === 'hi' ? ["प्राप्तकर्ता का नाम बताएं", "उदाहरण: रवि या कुमार"] : ["State recipient name", "Example: Ravi or Kumar"];
    } else {
      nextAction = 'NAVIGATE_TO_SEND';
      reply = targetLang === 'ta' ? "பணம் அனுப்ப 'Send Money' பொத்தானைத் தொடவும். யாருக்கு எவ்வளவு அனுப்ப வேண்டும் என்று கூறினால் நான் வழிகாட்டுவேன்." :
              targetLang === 'hi' ? "पैसे भेजने के लिए 'Send Money' बटन दबाएं। मुझे बताएं कि आप किसे और कितने पैसे भेजना चाहते हैं।" :
              "Tap 'Send Money' on your screen to make a payment. Tell me the recipient and amount, and I will verify it for you.";
      steps = targetLang === 'ta' ? ["'Send Money' தொடவும்", "பெறுநரைத் தேர்ந்தெடுக்கவும்", "நீங்களே கட்டணத்தை உறுதிப்படுத்தவும்"] :
              targetLang === 'hi' ? ["'Send Money' दबाएं", "प्राप्तकर्ता चुनें", "खुद पेमेंट कन्फर्म करें"] :
              ["Tap 'Send Money'", "Select recipient", "Confirm payment yourself"];
      highlightElement = 'action-send-money';
    }
  } else {
    // Intelligent conversational answer (NEVER a canned greeting callback)
    if (targetLang === 'ta') {
      reply = "SafePay-ல் நீங்கள் பாதுகாப்பாக பணம் அனுப்பலாம், QR குறியீட்டை ஸ்கேன் செய்யலாம், வங்கிக் கணக்கு இருப்பு பார்க்கலாம் அல்லது மோசடி செய்திகளைச் சரிபார்க்கலாம். உங்கள் கேள்விக்கு உதவ நான் தயாராக உள்ளேன்.";
      steps = ["பணம் அனுப்ப 'Send Money' தொடவும்", "கடை QR ஸ்கேன் செய்ய 'Scan QR' தொடவும்", "சந்தேகமான செய்திகளை இங்கே பகிரவும்"];
    } else if (targetLang === 'hi') {
      reply = "SafePay पर आप सुरक्षित पैसे भेज सकते हैं, QR कोड स्कैन कर सकते हैं, बैंक बैलेंस देख सकते हैं या फ्रॉड मैसेज की जांच कर सकते हैं। मैं आपकी पूरी मदद करूँगा।";
      steps = ["पैसे भेजने के लिए 'Send Money' दबाएं", "QR स्कैन करने के लिए 'Scan QR' दबाएं", "संदिग्ध मैसेज की जांच कराएं"];
    } else {
      reply = "SafePay allows you to send money safely, scan merchant QR codes, view your live balance, and detect digital scams. I am here to answer any banking or payment question you have.";
      steps = ["Tap 'Send Money' to pay someone", "Tap 'Scan QR' to pay at shops", "Ask any question about payments or scams"];
    }
  }

  return {
    reply,
    language: targetLang,
    intent,
    confidence: 0.94,
    steps,
    nextAction,
    actionData,
    requiresConfirmation: nextAction === 'PREPARE_PAYMENT',
    safetyWarning,
    speak: true,
    voiceScript: voiceScript || reply,
    highlightElement
  };
}

module.exports = {
  detectLanguage,
  extractEntities,
  classifyIntent,
  retrieveKnowledge,
  generateAssistantResponse,
  loadKnowledgeBase,
  getKnowledgeStats: () => ({
    totalChunks: knowledgeChunks.length
  })
};
