import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Mic, MicOff, Volume2, Send, X, 
  ShieldAlert, CheckCircle2, AlertTriangle, Sparkles, 
  Check, ArrowRight
} from 'lucide-react';
import { speakText, stopSpeaking, setSpeechRateMode, createSpeechRecognizer } from '../utils/voiceAssistant';

const QUICK_ACTIONS = {
  en: [
    { label: 'Send Money', query: 'How do I send money?' },
    { label: 'Check Balance', query: 'Show me my balance' },
    { label: 'Payment Help', query: 'Why did my payment fail?' },
    { label: 'Is this a Scam?', query: 'Someone is asking for my OTP' },
    { label: 'Explain this Screen', query: 'What should I do on this screen?' }
  ],
  hi: [
    { label: 'पैसे भेजें', query: 'मुझे पैसे भेजने हैं' },
    { label: 'बैलेंस देखें', query: 'मेरा बैंक बैलेंस दिखाओ' },
    { label: 'पेमेंट मदद', query: 'UPI क्या होता है?' },
    { label: 'धोखे की जांच', query: 'कोई मुझसे OTP मांग रहा है' },
    { label: 'स्क्रीन समझें', query: 'इस स्क्रीन का क्या मतलब है?' }
  ],
  ta: [
    { label: 'பணம் அனுப்ப', query: 'பணம் எப்படி அனுப்புவது?' },
    { label: 'இருப்பு பார்க்க', query: 'எனது கணக்கு இருப்பைக் காட்டுங்கள்' },
    { label: 'UPI உதவி', query: 'UPI என்றால் என்ன?' },
    { label: 'மோசடி எச்சரிக்கை', query: 'யாரோ OTP கேட்கிறார்கள்' },
    { label: 'திரை விளக்கம்', query: 'இந்தத் திரையின் அர்த்தம் என்ன?' }
  ]
};

const UI_STRINGS = {
  en: {
    safetyRule: "Safety Rule: AI never sends money automatically. You must confirm each payment yourself.",
    tapToSpeak: "🎤 Tap & Speak",
    askSafePay: "Ask SafePay",
    subtitle: "Your patient human banking helper",
    slowSpeed: "🐢 Slow",
    normalSpeed: "⚡ Normal",
    listen: "Listen",
    paymentReady: "Payment Safety Check Ready",
    recipient: "Recipient:",
    amount: "Amount:",
    safetyStatus: "✓ Verified Safe",
    guidedPrompt: "👉 Please review details. Tap below to go to the confirmation screen where you will physically click Confirm Payment.",
    reviewBtn: "Review & Confirm Payment Yourself",
    proceedToSend: "Proceed to Send Screen",
    voiceCheck: "Voice Recognition Check",
    youSaid: "You said:",
    isCorrect: "Is this correct?",
    btnYes: "YES, CONTINUE",
    btnNo: "NO, TRY AGAIN",
    listeningBar: "Listening... Speak in English, हिन्दी, or தமிழ்",
    placeholder: "Ask anything, e.g. \"Send ₹500 to Ravi\"",
    connError: "I could not connect to the assistant service. You can still use the app directly."
  },
  hi: {
    safetyRule: "सुरक्षा नियम: AI अपने आप पैसे कभी नहीं भेजता। आपको हर पेमेंट खुद कन्फर्म करना होगा।",
    tapToSpeak: "🎤 बोलने के लिए दबाएं",
    askSafePay: "SafePay से पूछें",
    subtitle: "बैंकिंग और सुरक्षा में आपकी मदद",
    slowSpeed: "🐢 धीमा",
    normalSpeed: "⚡ सामान्य",
    listen: "सुनें",
    paymentReady: "पेमेंट सुरक्षा जांच तैयार",
    recipient: "प्राप्तकर्ता:",
    amount: "राशि:",
    safetyStatus: "✓ सत्यापित सुरक्षित",
    guidedPrompt: "👉 कृपया विवरण जांचें। पुष्टि स्क्रीन पर जाने के लिए नीचे टैप करें जहाँ आप खुद Confirm Payment दबाएंगे।",
    reviewBtn: "विवरण जांचें और खुद कन्फर्म करें",
    proceedToSend: "पैसे भेजने की स्क्रीन पर जाएं",
    voiceCheck: "आवाज पहचान जांच",
    youSaid: "आपने कहा:",
    isCorrect: "क्या यह सही है?",
    btnYes: "हाँ, आगे बढ़ें",
    btnNo: "नहीं, फिर से बोलें",
    listeningBar: "सुन रहा हूँ... हिन्दी, தமிழ் या English में बोलें",
    placeholder: "यहाँ अपना सवाल लिखें या माइक दबाएं...",
    connError: "सहायक सेवा से कनेक्ट नहीं हो सका। आप सीधे ऐप का उपयोग कर सकते हैं।"
  },
  ta: {
    safetyRule: "பாதுகாப்பு விதி: AI தானாக பணத்தை அனுப்பாது. ஒவ்வொரு கட்டணத்தையும் நீங்களே உறுதிப்படுத்த வேண்டும்.",
    tapToSpeak: "🎤 பேச தொடவும்",
    askSafePay: "SafePay-யிடம் கேளுங்கள்",
    subtitle: "பாதுகாப்பான வங்கி உதவியாளர்",
    slowSpeed: "🐢 மெதுவாக",
    normalSpeed: "⚡ இயல்பாக",
    listen: "கேட்கவும்",
    paymentReady: "கட்டண பாதுகாப்பு சரிபார்ப்பு தயார்",
    recipient: "பெறுநர்:",
    amount: "தொகை:",
    safetyStatus: "✓ சரிபார்க்கப்பட்ட பாதுகாப்பு",
    guidedPrompt: "👉 விவரங்களைச் சரிபார்க்கவும். நீங்கள் நேரில் Confirm Payment பொத்தானை அழுத்தும் திரைக்குச் செல்ல கீழே தொடவும்.",
    reviewBtn: "விவரங்களைச் சரிபார்த்து நீங்களே உறுதிப்படுத்தவும்",
    proceedToSend: "பணம் அனுப்பும் திரைக்குச் செல்க",
    voiceCheck: "குரல் அங்கீகார சரிபார்ப்பு",
    youSaid: "நீங்கள் கூறியது:",
    isCorrect: "இது சரியா?",
    btnYes: "ஆம், தொடரவும்",
    btnNo: "இல்லை, மீண்டும்",
    listeningBar: "கேட்கிறது... தமிழ், हिन्दी அல்லது English-ல் பேசவும்",
    placeholder: "கேள்வியை எழுதவும் அல்லது பேசவும், எ.கா. \"ரவிக்கு 500 ரூபாய் அனுப்பவும்\"",
    connError: "உதவியாளர் சேவையுடன் இணைக்க முடியவில்லை. நீங்கள் நேரடியாக செயலியைப் பயன்படுத்தலாம்."
  }
};

function getStrings(lang) {
  if (!lang) return UI_STRINGS.en;
  const key = lang.toLowerCase().trim();
  if (key.startsWith('ta') || key === 'tanglish') return UI_STRINGS.ta;
  if (key.startsWith('hi') || key === 'hinglish') return UI_STRINGS.hi;
  return UI_STRINGS.en;
}

export default function SafePayAssistant({ isSimpleMode, isDarkMode, currentScreen = 'home' }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Assistant Widget State
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    return localStorage.getItem('safepay_assistant_lang') || 'en';
  });
  const [speechRate, setSpeechRate] = useState('normal'); // 'normal' or 'slow'
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Transcript confirmation state (Section 7)
  const [sttTranscript, setSttTranscript] = useState('');
  const [showSttConfirmation, setShowSttConfirmation] = useState(false);

  // Active guided payment & multi-turn context state (Section 8)
  const [activeGuidedPayment, setActiveGuidedPayment] = useState(null);

  const messagesEndRef = useRef(null);
  const recognizerRef = useRef(null);

  const currentStrings = getStrings(selectedLanguage);

  // Derive current screen from location
  const detectedScreen = location.pathname === '/' ? 'home' :
                         location.pathname === '/send' ? 'send' :
                         location.pathname === '/messages' ? 'messages' :
                         location.pathname === '/safety' ? 'safety' :
                         location.pathname === '/demo' ? 'demo' : currentScreen;

  // Sync with global language change events
  useEffect(() => {
    const handleGlobalLang = (e) => {
      if (e.detail?.language && e.detail.language !== selectedLanguage) {
        setSelectedLanguage(e.detail.language);
      }
    };
    window.addEventListener('safepay:languageChange', handleGlobalLang);
    return () => window.removeEventListener('safepay:languageChange', handleGlobalLang);
  }, [selectedLanguage]);

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, showSttConfirmation, activeGuidedPayment]);

  // Initial greeting with dynamic language response
  useEffect(() => {
    if (messages.length === 0 || (messages.length === 1 && messages[0].id === 'msg-welcome')) {
      let initialGreeting = "Hello! I am your SafePay Banking Assistant. I can help you send money safely, check balance, or spot scams. You can speak or type.";
      let vScript = "Hello! I am your SafePay Assistant. You can speak or type.";
      let initialSteps = ["Tap 'Send Money' to begin", "Ask 'Show balance'", "Ask 'Is this a scam?'"];

      if (selectedLanguage === 'hi') {
        initialGreeting = "नमस्ते! मैं आपका SafePay सहायक हूँ। मैं आपको पैसे भेजने, बैलेंस देखने और धोखाधड़ी से बचने में मदद करूँगा। आप बोल भी सकते हैं।";
        vScript = "नमस्ते! मैं आपका SafePay सहायक हूँ। बोलकर सवाल पूछें।";
        initialSteps = ["'पैसे भेजें' पूछें", "'बैलेंस दिखाओ' पूछें", "'क्या यह फ्रॉड है?' पूछें"];
      } else if (selectedLanguage === 'ta') {
        initialGreeting = "வணக்கம்! நான் உங்கள் SafePay வங்கி உதவியாளர். பணம் அனுப்பவும், பேலன்ஸ் பார்க்கவும், மோசடிகளைத் தவிர்க்கவும் நான் உதவுவேன்.";
        vScript = "வணக்கம்! நான் உங்கள் SafePay உதவியாளர். நீங்கள் பேசலாம்.";
        initialSteps = ["'பணம் அனுப்ப' என்று கேட்கவும்", "'இருப்பு காட்டு' என்று கேட்கவும்", "'இது மோசடியா?' என்று கேட்கவும்"];
      }

      setMessages([{
        id: 'msg-welcome',
        sender: 'assistant',
        text: initialGreeting,
        voiceScript: vScript,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        steps: initialSteps,
        language: selectedLanguage
      }]);
    }
  }, [selectedLanguage]);

  // Save language preference and provide immediate vocal confirmation in chosen language
  const handleLanguageChange = (newLang) => {
    if (newLang === selectedLanguage) return;
    setSelectedLanguage(newLang);
    localStorage.setItem('safepay_assistant_lang', newLang);

    // Stop previous voice output
    stopSpeaking();

    // Spoken voice feedback in the chosen language so the user immediately hears the voice change
    let confirmationVoice = "Language set to English. Speak or type your question.";
    if (newLang === 'hi') {
      confirmationVoice = "नमस्ते! भाषा बदलकर हिन्दी कर दी गई है। बोलकर या लिखकर सवाल पूछें।";
    } else if (newLang === 'ta') {
      confirmationVoice = "வணக்கம்! மொழி தமிழுக்கு மாற்றப்பட்டது. நீங்கள் பேசலாம் அல்லது எழுதலாம்.";
    }

    setIsSpeaking(true);
    speakText(confirmationVoice, {
      lang: newLang,
      rateMode: speechRate,
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false)
    });

    // Notify other components
    window.dispatchEvent(new CustomEvent('safepay:languageChange', { detail: { language: newLang } }));
  };

  // Toggle speech rate
  const toggleSpeechRate = () => {
    const nextRate = speechRate === 'normal' ? 'slow' : 'normal';
    setSpeechRate(nextRate);
    setSpeechRateMode(nextRate);
  };

  // Dispatch visual highlight event
  const triggerVisualHighlight = (elementId) => {
    if (!elementId) return;
    const ev = new CustomEvent('safepay:highlight', { detail: { elementId } });
    window.dispatchEvent(ev);

    // Look for DOM element and pulse it directly
    const el = document.getElementById(elementId);
    if (el) {
      el.classList.add('guided-pulse-highlight');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        el.classList.remove('guided-pulse-highlight');
      }, 5000);
    }
  };

  // Core chat submission with multi-turn context
  const sendMessage = async (userText) => {
    if (!userText || !userText.trim()) return;

    const trimmed = userText.trim();
    setInputQuery('');
    setShowSttConfirmation(false);
    setSttTranscript('');

    // Append user message
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Build context for multi-turn conversations
      const currentContext = { ...(activeGuidedPayment || {}) };

      const res = await fetch('http://localhost:3001/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          language: selectedLanguage,
          screen: detectedScreen,
          context: currentContext
        })
      });

      const data = await res.json();

      const assistantMsg = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: data.reply,
        language: data.language,
        intent: data.intent,
        steps: data.steps || [],
        safetyWarning: data.safetyWarning,
        nextAction: data.nextAction,
        actionData: data.actionData,
        highlightElement: data.highlightElement,
        voiceScript: data.voiceScript || data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Automatically speak critical warnings or regular guidance
      if (data.speak !== false) {
        setIsSpeaking(true);
        speakText(data.voiceScript || data.reply, {
          lang: data.language || selectedLanguage,
          rateMode: speechRate,
          onEnd: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false)
        });
      }

      // Trigger Visual Highlighting
      if (data.highlightElement) {
        triggerVisualHighlight(data.highlightElement);
      }

      // Guided Payment Preparation & Multi-turn Context Persistence (Section 8)
      if (data.actionData) {
        setActiveGuidedPayment(prev => {
          const merged = { ...(prev || {}), ...data.actionData };
          if (data.nextAction === 'PREPARE_PAYMENT' || (merged.recipient && merged.amount)) {
            merged.ready = true;
          }
          return merged;
        });
      }

      if (data.nextAction === 'NAVIGATE_TO_SEND') {
        triggerVisualHighlight('action-send-money');
      }

    } catch (err) {
      console.error('Failed communicating with assistant:', err);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: currentStrings.connError,
        steps: ["Check your connection", "Try again in a few moments"],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Start Speech-to-Text Listening
  const startListening = () => {
    if (isListening) {
      stopSpeaking();
      setIsListening(false);
      return;
    }

    stopSpeaking();
    setIsListening(true);
    setSttTranscript('');
    setShowSttConfirmation(false);

    const recognizer = createSpeechRecognizer({
      lang: selectedLanguage === 'auto' ? 'en' : selectedLanguage,
      onStart: () => setIsListening(true),
      onResult: (transcript) => {
        setIsListening(false);
        if (transcript) {
          setSttTranscript(transcript);
          // Show Transcript Confirmation Dialog (Section 7)
          setShowSttConfirmation(true);
        }
      },
      onError: (err) => {
        setIsListening(false);
        console.warn('Speech recognition error:', err);
      },
      onEnd: () => setIsListening(false)
    });

    recognizerRef.current = recognizer;
    recognizer.start();
  };

  // Execute Guided Navigation to Payment
  const proceedToGuidedPayment = (customData) => {
    const paymentData = customData || activeGuidedPayment;
    if (!paymentData) return;
    setActiveGuidedPayment(null);
    setIsOpen(false);
    navigate('/send', {
      state: {
        recipient: paymentData.recipient,
        amount: paymentData.amount,
        isNew: false,
        purpose: 'Payment'
      }
    });
  };

  const currentQuickActions = QUICK_ACTIONS[selectedLanguage] || QUICK_ACTIONS['en'];

  return (
    <>
      {/* Floating Trigger Button */}
      <button 
        id="safepay-assistant-trigger"
        className={`assistant-floating-btn ${isOpen ? 'active' : ''} ${isSimpleMode ? 'simple-large-trigger' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Open SafePay Multilingual Voice Assistant"
        aria-label="Ask SafePay Assistant"
      >
        <div className="assistant-btn-inner">
          {isSpeaking ? (
            <div className="audio-wave-anim">
              <span></span><span></span><span></span><span></span>
            </div>
          ) : (
            <Mic size={isSimpleMode ? 28 : 22} />
          )}
          <span className="assistant-btn-label">
            {isSimpleMode ? currentStrings.tapToSpeak : currentStrings.askSafePay}
          </span>
        </div>
      </button>

      {/* Assistant Modal / Drawer */}
      {isOpen && (
        <div className="assistant-overlay" onClick={() => setIsOpen(false)}>
          <div 
            className={`assistant-modal ${isDarkMode ? 'dark' : ''} ${isSimpleMode ? 'simple' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="assistant-header">
              <div className="assistant-title-row">
                <div className="assistant-avatar">
                  <Sparkles size={20} color="#FFFFFF" />
                </div>
                <div>
                  <h3 className="assistant-name">SafePay Assistant</h3>
                  <p className="assistant-subtitle">
                    {currentStrings.subtitle}
                  </p>
                </div>
              </div>

              <div className="assistant-header-controls">
                {/* Language Selector */}
                <div className="lang-switcher">
                  <button 
                    className={`lang-btn ${selectedLanguage === 'en' || selectedLanguage === 'auto' ? 'active' : ''}`}
                    onClick={() => handleLanguageChange('en')}
                  >
                    EN
                  </button>
                  <button 
                    className={`lang-btn ${selectedLanguage === 'hi' ? 'active' : ''}`}
                    onClick={() => handleLanguageChange('hi')}
                  >
                    हिन्दी
                  </button>
                  <button 
                    className={`lang-btn ${selectedLanguage === 'ta' ? 'active' : ''}`}
                    onClick={() => handleLanguageChange('ta')}
                  >
                    தமிழ்
                  </button>
                </div>

                {/* Speech Speed Toggle (Section 6) */}
                <button 
                  className={`speed-toggle-btn ${speechRate === 'slow' ? 'slow-active' : ''}`}
                  onClick={toggleSpeechRate}
                  title={`Speech speed: ${speechRate === 'slow' ? 'Slow (0.72x)' : 'Normal (0.95x)'}`}
                >
                  {speechRate === 'slow' ? currentStrings.slowSpeed : currentStrings.normalSpeed}
                </button>

                {/* Close Drawer */}
                <button 
                  className="assistant-close-btn" 
                  onClick={() => { stopSpeaking(); setIsOpen(false); }}
                  title="Close Assistant"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Safety Principle Banner (Section 2) */}
            <div className="assistant-safety-badge">
              <ShieldAlert size={14} />
              <span>
                {currentStrings.safetyRule}
              </span>
            </div>

            {/* Chat Conversation Body */}
            <div className="assistant-body">
              {messages.map((msg) => {
                const msgStrings = getStrings(msg.language || selectedLanguage);
                return (
                  <div key={msg.id} className={`assistant-msg-wrap ${msg.sender}`}>
                    {msg.sender === 'assistant' && (
                      <div className="assistant-avatar-small">
                        <Sparkles size={14} />
                      </div>
                    )}

                    <div className="assistant-bubble">
                      {/* Safety Alert Badge */}
                      {msg.safetyWarning && (
                        <div className="bubble-safety-alert">
                          <AlertTriangle size={16} />
                          <span>{msg.safetyWarning}</span>
                        </div>
                      )}

                      <p className="bubble-text">{msg.text}</p>

                      {/* Step-by-Step Instruction Pills (Section 23) */}
                      {msg.steps && msg.steps.length > 0 && (
                        <div className="bubble-steps-list">
                          {msg.steps.map((st, i) => (
                            <div key={i} className="step-pill">
                              <span className="step-num">{i + 1}</span>
                              <span>{st}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Guided Payment Confirmation Card (Section 8) */}
                      {msg.nextAction === 'PREPARE_PAYMENT' && msg.actionData && (
                        <div className="guided-payment-card">
                          <div className="guided-card-header">
                            <CheckCircle2 size={16} color="#10B981" />
                            <strong>{msgStrings.paymentReady}</strong>
                          </div>
                          <div className="guided-card-details">
                            <div className="guided-detail-row">
                              <span className="detail-label">{msgStrings.recipient}</span>
                              <span className="detail-val">{msg.actionData.recipient}</span>
                            </div>
                            <div className="guided-detail-row">
                              <span className="detail-label">{msgStrings.amount}</span>
                              <span className="detail-val">₹{msg.actionData.amount.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="guided-detail-row">
                              <span className="detail-label">Status:</span>
                              <span className="detail-val safety-tag-safe">{msgStrings.safetyStatus}</span>
                            </div>
                          </div>

                          <p className="guided-user-prompt">
                            {msgStrings.guidedPrompt}
                          </p>

                          <button 
                            className="btn-guided-proceed"
                            onClick={() => proceedToGuidedPayment(msg.actionData)}
                          >
                            {msgStrings.reviewBtn} <ArrowRight size={16} />
                          </button>
                        </div>
                      )}

                      {/* Direct Shortcut to Send Screen when Recipient is identified */}
                      {msg.nextAction === 'NAVIGATE_TO_SEND' && msg.actionData?.recipient && (
                        <div style={{ marginTop: '10px' }}>
                          <button 
                            className="btn-guided-proceed"
                            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
                            onClick={() => proceedToGuidedPayment(msg.actionData)}
                          >
                            {msgStrings.proceedToSend} ({msg.actionData.recipient}) <ArrowRight size={16} />
                          </button>
                        </div>
                      )}

                      {/* Message Action Footer: TTS Listen & Repeat */}
                      {msg.sender === 'assistant' && (
                        <div className="bubble-footer">
                          <button 
                            className="btn-listen"
                            onClick={() => {
                              speakText(msg.voiceScript || msg.text, {
                                lang: msg.language || selectedLanguage,
                                rateMode: speechRate
                              });
                            }}
                            title="Listen to this explanation aloud"
                          >
                            <Volume2 size={14} />
                            <span>{msgStrings.listen}</span>
                          </button>
                          <span className="msg-time">{msg.timestamp}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="assistant-loading-indicator">
                  <span className="loading-dot"></span>
                  <span className="loading-dot"></span>
                  <span className="loading-dot"></span>
                </div>
              )}

              {/* STT Transcript Confirmation Modal (Section 7) */}
              {showSttConfirmation && (
                <div className="stt-confirmation-box">
                  <div className="stt-header">
                    <Mic size={16} color="#4F46E5" />
                    <strong>{currentStrings.voiceCheck}</strong>
                  </div>
                  <p className="stt-heard-label">{currentStrings.youSaid}</p>
                  <p className="stt-heard-text">"{sttTranscript}"</p>
                  <p className="stt-confirm-prompt">{currentStrings.isCorrect}</p>
                  <div className="stt-action-btns">
                    <button 
                      className="btn-stt-yes"
                      onClick={() => sendMessage(sttTranscript)}
                    >
                      <Check size={16} /> {currentStrings.btnYes}
                    </button>
                    <button 
                      className="btn-stt-no"
                      onClick={() => {
                        setShowSttConfirmation(false);
                        setSttTranscript('');
                      }}
                    >
                      <X size={16} /> {currentStrings.btnNo}
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Suggestion Chips (Section 40) */}
            <div className="assistant-quick-chips">
              {currentQuickActions.map((act, i) => (
                <button 
                  key={i} 
                  className="quick-chip"
                  onClick={() => sendMessage(act.query)}
                >
                  {act.label}
                </button>
              ))}
            </div>

            {/* Input Bar: Microphone + Text Entry */}
            <div className="assistant-footer">
              <div className="assistant-input-row">
                <button 
                  className={`btn-mic-main ${isListening ? 'listening' : ''}`}
                  onClick={startListening}
                  title={isListening ? 'Listening... Tap to stop' : 'Tap and speak in your language'}
                >
                  {isListening ? (
                    <div className="mic-listening-pulse">
                      <MicOff size={22} />
                    </div>
                  ) : (
                    <Mic size={22} />
                  )}
                </button>

                <input 
                  type="text"
                  className="assistant-text-input"
                  placeholder={currentStrings.placeholder}
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      sendMessage(inputQuery);
                    }
                  }}
                />

                <button 
                  className="btn-send-main"
                  onClick={() => sendMessage(inputQuery)}
                  disabled={!inputQuery.trim() || isLoading}
                  title="Send message"
                >
                  <Send size={18} />
                </button>
              </div>

              {/* Listening Status Bar */}
              {isListening && (
                <div className="listening-indicator-bar">
                  <span className="pulse-dot"></span>
                  <span>{currentStrings.listeningBar}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
