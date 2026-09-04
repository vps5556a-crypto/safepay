// SafePay Multilingual Voice Assistant (TTS & STT)
// Designed for low digital literacy users with slow speed & multi-language synthesis

let lastSpokenText = '';
let currentRateMode = 'normal'; // 'normal' (0.95x) or 'slow' (0.75x)
let cachedVoices = [];

function refreshVoices() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    cachedVoices = window.speechSynthesis.getVoices() || [];
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    refreshVoices();
  };
}

/**
 * Get the best matching browser voice for the requested language
 */
export function getBestVoice(lang = 'en') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  refreshVoices();
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const targetLang = (lang || 'en').toLowerCase().trim();

  // 1. TAMIL VOICE MATCHING (ta-IN, ta-LK, Google தமிழ், Microsoft Valluvar, etc.)
  if (targetLang === 'ta' || targetLang.startsWith('ta') || targetLang === 'tanglish') {
    const taVoice = voices.find(v => {
      const vLang = (v.lang || '').toLowerCase();
      const vName = (v.name || '').toLowerCase();
      return vLang.startsWith('ta') || 
             vName.includes('tamil') || 
             vName.includes('valluvar') || 
             vName.includes('pallavi') || 
             vName.includes('kani') ||
             vName.includes('தமிழ்');
    });

    if (taVoice) return taVoice;

    // CRITICAL: If no local Tamil voice is installed in the OS, do NOT return an English voice!
    // Returning null allows browser's native SpeechSynthesisUtterance with utterance.lang = 'ta-IN'
    // to synthesize in Tamil without English phonetic distortion.
    return null;
  }

  // 2. HINDI VOICE MATCHING (hi-IN, Google हिन्दी, Microsoft Kalpana, Microsoft Hemant, etc.)
  if (targetLang === 'hi' || targetLang.startsWith('hi') || targetLang === 'hinglish') {
    const hiVoice = voices.find(v => {
      const vLang = (v.lang || '').toLowerCase();
      const vName = (v.name || '').toLowerCase();
      return vLang.startsWith('hi') || 
             vName.includes('hindi') || 
             vName.includes('kalpana') || 
             vName.includes('hemant') || 
             vName.includes('मधुर') ||
             vName.includes('स्वरा') ||
             vName.includes('हिन्दी');
    });

    if (hiVoice) return hiVoice;

    // CRITICAL: Never fall back to en-IN for Hindi!
    return null;
  }

  // 3. ENGLISH VOICE MATCHING
  return voices.find(v => (v.lang || '').toLowerCase() === 'en-in') ||
         voices.find(v => (v.lang || '').toLowerCase().startsWith('en-gb')) ||
         voices.find(v => (v.lang || '').toLowerCase().startsWith('en-us')) ||
         voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || null;
}

/**
 * Speak text with language support and adjustable speech speed
 */
export function speakText(text, options = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
    return;
  }

  lastSpokenText = text;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const rawLang = options.lang || 'en';
  const lang = (rawLang === 'ta' || rawLang.startsWith('ta') || rawLang === 'tanglish') ? 'ta' :
               (rawLang === 'hi' || rawLang.startsWith('hi') || rawLang === 'hinglish') ? 'hi' : 'en';

  const rateMode = options.rateMode || currentRateMode || 'normal';

  // Slower speech rate for elderly / low literacy users
  utterance.rate = rateMode === 'slow' ? 0.72 : 0.95;
  utterance.pitch = 1.0;

  // Language mapping
  if (lang === 'hi') {
    utterance.lang = 'hi-IN';
  } else if (lang === 'ta') {
    utterance.lang = 'ta-IN';
  } else {
    utterance.lang = 'en-IN';
  }

  const voice = getBestVoice(lang);
  if (voice) {
    utterance.voice = voice;
  }

  if (options.onEnd) {
    utterance.onend = options.onEnd;
  }
  if (options.onError) {
    utterance.onerror = options.onError;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Stop any currently playing speech
 */
export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Repeat the last spoken text
 */
export function repeatSpeech(options = {}) {
  if (lastSpokenText) {
    speakText(lastSpokenText, options);
  }
}

/**
 * Set the global speech rate mode ('normal' or 'slow')
 */
export function setSpeechRateMode(mode) {
  if (mode === 'slow' || mode === 'normal') {
    currentRateMode = mode;
  }
}

export function getSpeechRateMode() {
  return currentRateMode;
}

/**
 * Browser Speech-to-Text Recognition Factory
 */
export function createSpeechRecognizer({ lang = 'en', onResult, onError, onStart, onEnd }) {
  if (typeof window === 'undefined') {
    return { isSupported: false, start: () => {}, stop: () => {} };
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    return {
      isSupported: false,
      start: () => {
        if (onError) onError(new Error('Speech recognition not supported in this browser.'));
      },
      stop: () => {}
    };
  }

  const recognizer = new SpeechRecognition();
  recognizer.continuous = false;
  recognizer.interimResults = false;

  // Set language code
  if (lang === 'hi' || lang === 'hinglish') {
    recognizer.lang = 'hi-IN';
  } else if (lang === 'ta' || lang === 'tanglish') {
    recognizer.lang = 'ta-IN';
  } else {
    recognizer.lang = 'en-IN';
  }

  recognizer.onstart = () => {
    if (onStart) onStart();
  };

  recognizer.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || '';
    if (onResult) onResult(transcript.trim());
  };

  recognizer.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    if (onError) onError(event);
  };

  recognizer.onend = () => {
    if (onEnd) onEnd();
  };

  return {
    isSupported: true,
    start: () => {
      try {
        recognizer.start();
      } catch (err) {
        console.warn('Recognition already started:', err.message);
      }
    },
    stop: () => {
      try {
        recognizer.stop();
      } catch (err) {}
    }
  };
}
