import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Send, MessageSquare, Shield, Sparkles, Volume2, ShieldCheck, Eye, EyeOff, Moon, Sun } from 'lucide-react';
import HomePage from './pages/HomePage';
import SendMoneyFlow from './pages/SendMoneyFlow';
import Messages from './pages/Messages';
import SafetyCenter from './pages/SafetyCenter';
import DemoMode from './pages/DemoMode';
import SafePayAssistant from './components/SafePayAssistant';
import { speakText, stopSpeaking } from './utils/voiceAssistant';
import './index.css';

function AppContent({ isSimpleMode, setIsSimpleMode, isDarkMode, setIsDarkMode }) {
  const location = useLocation();
  const isDemo = location.pathname === '/demo';
  const [backendStatus, setBackendStatus] = useState(null);
  const [appLang, setAppLang] = useState(() => {
    return localStorage.getItem('safepay_assistant_lang') || 'en';
  });

  useEffect(() => {
    fetch('http://localhost:3001/api/status')
      .then(res => res.json())
      .then(data => setBackendStatus(data))
      .catch(() => setBackendStatus({ status: 'offline' }));
  }, []);

  useEffect(() => {
    const onLangChanged = (e) => {
      if (e.detail?.language && e.detail.language !== appLang) {
        setAppLang(e.detail.language);
      }
    };
    window.addEventListener('safepay:languageChange', onLangChanged);
    return () => window.removeEventListener('safepay:languageChange', onLangChanged);
  }, [appLang]);

  const changeAppLang = (newLang) => {
    if (newLang === appLang) return;
    setAppLang(newLang);
    localStorage.setItem('safepay_assistant_lang', newLang);

    // Stop previous voice and announce the language change aloud
    stopSpeaking();
    let spokenVoice = "Language set to English.";
    if (newLang === 'hi') spokenVoice = "नमस्ते! भाषा बदलकर हिन्दी कर दी गई है।";
    if (newLang === 'ta') spokenVoice = "வணக்கம்! மொழி தமிழுக்கு மாற்றப்பட்டது.";

    speakText(spokenVoice, { lang: newLang });
    window.dispatchEvent(new CustomEvent('safepay:languageChange', { detail: { language: newLang } }));
  };

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <Link to="/" className="brand-badge">
          <div className="brand-logo-icon">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="brand-name">SafePay</div>
          </div>
        </Link>

        <div className="header-actions">
          {/* Global Language Selector */}
          <div className="lang-switcher" title="Choose language / மொழி / भाषा">
            <button 
              className={`lang-btn ${appLang === 'en' ? 'active' : ''}`}
              onClick={() => changeAppLang('en')}
            >
              EN
            </button>
            <button 
              className={`lang-btn ${appLang === 'hi' ? 'active' : ''}`}
              onClick={() => changeAppLang('hi')}
            >
              हिन्दी
            </button>
            <button 
              className={`lang-btn ${appLang === 'ta' ? 'active' : ''}`}
              onClick={() => changeAppLang('ta')}
            >
              தமிழ்
            </button>
          </div>

          {/* Dark / Light Mode Toggle */}
          <button 
            className={`theme-toggle ${isDarkMode ? 'dark-active' : ''}`}
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Toggle Dark / Light Mode"
          >
            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
            <span>{isDarkMode ? 'Light' : 'Dark'}</span>
          </button>

          {/* Simple Mode Accessibility Toggle */}
          <button 
            className={`simple-mode-toggle ${isSimpleMode ? 'active' : ''}`}
            onClick={() => setIsSimpleMode(!isSimpleMode)}
            title="Toggle high-visibility Simple Mode for accessibility"
          >
            {isSimpleMode ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{isSimpleMode ? 'Normal' : 'Simple'}</span>
          </button>

          {/* Hackathon Demo Button */}
          <Link to="/demo" className="demo-link-btn">
            <Sparkles size={14} />
            <span>Demo</span>
          </Link>
        </div>
      </header>

      {/* Safety System Status Ribbon */}
      <div className="system-status-ribbon">
        <div className="flex items-center gap-2">
          <span className="pulse-dot"></span>
          <span>
            <strong>AI Safety Layer:</strong>{' '}
            {backendStatus?.ollama?.available
              ? `Ollama Active (${backendStatus.ollama.activeModel || 'llama3.2'})`
              : 'Deterministic Safety Guard Active'}
          </span>
        </div>
        <span>Protected</span>
      </div>

      {/* Main Page Routing */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage isSimpleMode={isSimpleMode} isDarkMode={isDarkMode} />} />
          <Route path="/send" element={<SendMoneyFlow isSimpleMode={isSimpleMode} isDarkMode={isDarkMode} />} />
          <Route path="/messages" element={<Messages isSimpleMode={isSimpleMode} isDarkMode={isDarkMode} />} />
          <Route path="/safety" element={<SafetyCenter isSimpleMode={isSimpleMode} isDarkMode={isDarkMode} />} />
          <Route path="/demo" element={<DemoMode isSimpleMode={isSimpleMode} isDarkMode={isDarkMode} />} />
        </Routes>
      </main>

      {/* Bottom Sticky Navigation */}
      <nav className="bottom-nav">
        <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
          <Home size={22} />
          <span>Home</span>
        </Link>
        <Link to="/send" className={`nav-item ${location.pathname === '/send' ? 'active' : ''}`}>
          <Send size={22} />
          <span>Send</span>
        </Link>
        <Link to="/messages" className={`nav-item ${location.pathname === '/messages' ? 'active' : ''}`}>
          <MessageSquare size={22} />
          <span>Messages</span>
        </Link>
        <Link to="/safety" className={`nav-item ${location.pathname === '/safety' ? 'active' : ''}`}>
          <Shield size={22} />
          <span>Safety</span>
        </Link>
      </nav>

      {/* Global Multilingual Voice-Guided SafePay Assistant */}
      <SafePayAssistant 
        isSimpleMode={isSimpleMode} 
        isDarkMode={isDarkMode} 
      />
    </div>
  );
}

function App() {
  const [isSimpleMode, setIsSimpleMode] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('safepay_dark_mode') === 'true';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
      localStorage.setItem('safepay_dark_mode', 'true');
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('safepay_dark_mode', 'false');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (isSimpleMode) {
      document.body.classList.add('simple-mode');
    } else {
      document.body.classList.remove('simple-mode');
    }
  }, [isSimpleMode]);

  return (
    <Router>
      <AppContent 
        isSimpleMode={isSimpleMode} 
        setIsSimpleMode={setIsSimpleMode}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />
    </Router>
  );
}

export default App;
