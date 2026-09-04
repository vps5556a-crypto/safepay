# SafePay — AI-Powered Safe & Inclusive Digital Payments

SafePay is an inclusive digital-payment application designed to reduce accidental money transfers, fraud scams, social-engineering attacks, and wrong-recipient transactions using an intelligent multi-layer safety architecture.

---

## 🏛️ System Architecture

```text
Incoming Message / Payment Request
                ↓
    ┌────────────────────────┐
    │ Trained NLP Model v1.0 │ (Pattern recognition over 895 labeled samples)
    └───────────┬────────────┘
                ↓
         ML Risk Signal
                +
    ┌────────────────────────┐
    │ Rule-Based Risk Engine │ (Deterministic financial safety invariants)
    └───────────┬────────────┘
                ↓
        Rule Risk Signal
                +
    ┌────────────────────────┐
    │  Ollama / Gemini NLP   │ (Intent understanding & explanation)
    └───────────┬────────────┘
                ↓
    ┌────────────────────────┐
    │  SafePay Risk Engine   │ (Hybrid normalized scoring: 0–100)
    └───────────┬────────────┘
                ↓
    ┌────────────────────────┴────────────────────────┐
    ▼                                                 ▼
[LOW RISK (0–24)]                            [HIGH/CRITICAL (50–100)]
 ✓ Looks normal                                🚨 Scam risk detected
  No alarm / Proceed safely                     🔊 Proactive Voice Warning
                                                ⛔ Block / Additional Verification
```

---

## 🧠 SafePay NLP Scam Detection

SafePay incorporates a **trained multi-class NLP classifier** (`safepay-nlp-v1.0`) trained on a curated dataset of legitimate financial notifications, everyday personal messages, and 24 categories of financial fraud.

### Pipeline

```text
Dataset (895 Labeled Samples)
  ↓
Cleaning & Preprocessing (Unicode NFKC, ₹ Currency Normalization, URL/Phone/UPI Masking)
  ↓
Stratified Train/Test Split (80% Train / 20% Test)
  ↓
TF-IDF Vectorization (Unigrams & Bigrams, sublinear TF)
  ↓
Logistic Regression Classifier (Balanced Class Weights)
  ↓
Evaluation on Held-Out Test Set (Scam Recall: 100.0%, Accuracy: 97.8%)
  ↓
Model Export (Zero-dependency portable JSON model for Node.js runtime)
  ↓
Backend Risk Engine Integration (< 2ms Local Inference)
```

---

### 📊 Dataset Details & Licensing

- **Dataset Path**: `ml/data/scam_dataset.json`
- **Total Unique Samples**: 895 uniquely deduplicated messages.
- **Dataset Composition**:
  - `LEGITIMATE`: 686 samples (routine UPI payments, bank salary credits, bill receipts, personal transfers, split requests).
  - `SCAMS`: 209 samples across 24 distinct scam taxonomy classes.
- **Sources & Attribution**:
  - UCI Machine Learning Repository SMS Spam Collection (Public Domain).
  - Indian Cyber Crime Coordination Centre (I4C) & CERT-In Public Advisory Corpus.
  - Reserve Bank of India (RBI) "BE(A)WARE" Financial Fraud Prevention Booklet examples.
- **License**: **Creative Commons Attribution 4.0 International (CC BY 4.0)** & Public Domain.

---

### 🏷️ Supported Scam Taxonomy

| Category | Description | Example Message |
|---|---|---|
| `LEGITIMATE` | Routine banking, personal transfer, bill receipt | *"Your payment of ₹500 to Rahul was successful."* |
| `BANK_PHISHING` | False threats of account blockage/suspension | *"Your bank account will be blocked today. Send ₹2,000 immediately."* |
| `OTP_THEFT` | Requests for secret OTP verification code | *"Share the OTP you received to complete your refund."* |
| `PIN_THEFT` | False claims that PIN is needed to receive funds | *"Enter your UPI PIN to receive ₹5,000 cashback."* |
| `PRIZE_SCAM` | Advance processing fee for fake winnings | *"Congratulations! You won ₹50,000. Send ₹500 fee."* |
| `LOTTERY_SCAM` | KBC or vehicle lucky draw advance fraud | *"You won Tata Safari in Jio draw. Pay ₹25,000 tax."* |
| `CASHBACK_SCAM` | Payment requested to unlock cashback | *"Pay ₹10 to activate your ₹1,999 cashback voucher."* |
| `KYC_SCAM` | Deactivation threat over expired KYC/Aadhaar | *"Your KYC expired. Account closed in 24h. Click link."* |
| `LOAN_SCAM` | Advance fee for pre-approved low-interest loan | *"Loan of ₹5,00,000 approved. Pay ₹1,500 file charges."* |
| `JOB_SCAM` | Upfront deposit for part-time like/review job | *"Earn ₹5,000 daily from home. Pay ₹999 fee."* |
| `POLICE_IMPERSONATION` | Fake warrants or money-laundering accusations | *"Delhi Police Cyber Cell: Arrest warrant issued. Pay fine."* |
| `GOVERNMENT_IMPERSONATION` | Fake electricity/tax department penalties | *"Electricity disconnected tonight at 9:30 PM. Pay now."* |
| `DELIVERY_SCAM` | Re-delivery fee request for detained package | *"India Post: Parcel address incomplete. Pay ₹25 fee."* |
| `PARCEL_SCAM` | Customs clearance charge for overseas gift | *"BlueDart: Package held at customs. Pay ₹1,500 duty."* |
| `ROMANCE_SCAM` | Emergency funds requested at airport | *"Stuck at customs with gifts. Transfer ₹30,000 urgently."* |
| `SEXTORTION` | Blackmail threats to publish webcam footage | *"Send ₹15,000 or video will be published to contacts."* |
| `MALICIOUS_LINK` | Download link for remote access or fake app | *"Click link to download WhatsApp Pink APK."* |
| `SOCIAL_ENGINEERING` | Impersonating a boss or colleague in emergency | *"In urgent board meeting, buy 5 Apple gift cards."* |

---

### 📈 Evaluation Metrics on Held-Out Test Data

| Metric | Score | Note |
|---|---|---|
| **Accuracy** | **97.77%** | Overall correct classifications |
| **Precision** | **91.30%** | When flagged as scam, 91.3% are true scams |
| **Scam Recall** | **100.00%** | **0% of actual scams missed** (0 false negatives) |
| **F1-Score** | **95.45%** | Harmonic mean of precision and recall |
| **False Positive Rate** | **2.92%** | Genuine messages flagged as scam |
| **Confusion Matrix** | `TN=133, FP=4, FN=0, TP=42` | Evaluated on 179 held-out test messages |

---

### 💻 Running the Machine Learning Pipeline

```bash
# 1. Generate or inspect dataset
python ml/generate_dataset.py

# 2. Train the model and export safepay_nlp_model.json
python ml/train.py

# 3. Run evaluation suite
python ml/evaluate.py

# 4. Run CLI prediction on any sample text
python ml/predict.py "Share the OTP you received to complete your refund"
```

---

## 🚀 Quickstart

### Prerequisites
- Node.js (v18+)
- Python 3.8+ (with `scikit-learn` and `pandas`)
- Optional: Local [Ollama](https://ollama.com/) instance (`llama3.2:latest`)

### 1. Start the Backend API
```bash
cd backend
npm install
node server.js
```
*Backend active on [http://localhost:3001](http://localhost:3001)*

### 2. Start the Frontend App
```bash
cd frontend
npm install
npm run dev
```
*Frontend active on [http://localhost:5173](http://localhost:5173)*

---

## 🔐 Core Capabilities

- **Proactive Message Safety**: Incoming SMS and chat messages are monitored silently and automatically classified without requiring an "Analyze" button.
- **Voice Warning System**: Device text-to-speech triggers for `HIGH` and `CRITICAL` threats (e.g. *"Warning. Scam risk detected. Never share your OTP or PIN."*).
- **Backend-Driven Authorization**: High-value transactions are gated by the backend decision matrix, enforcing one-time server tokens (`authorizationId`) and preventing client tampering.
- **Dynamic Authenticator Threshold**: The security threshold (default ₹20,000) is dynamic and can be configured at runtime in the Safety Center.
- **Atomic Account Balance**: Synchronized persistent storage prevents overdrafts, credits incoming transfers, and guards against double-charging via idempotency.

---

## 🎙️ Multilingual Voice-Guided Financial Assistant

SafePay features a patient, voice-first banking assistant tailored for low digital literacy users (elderly, first-time digital-payment users, non-English speakers).

### Core Safety Invariants
1. **AI NEVER Autonomously Completes a Payment**:
   - The assistant prepares details, explains risks, navigates to the payment screen, and tells the user what button to press.
   - The **USER must physically press the "Confirm Payment" button**.
   - Voice commands like *"Send ₹500 to Ravi"* prepare the payment and ask for physical review — they never immediately move money.
2. **Strict PIN/OTP Safety**:
   - The assistant never requests, accepts, or stores UPI PIN or OTP.
   - Any query or call mentioning PIN or OTP triggers an immediate safety warning: *"DANGER! Never share your OTP code with anyone."*
3. **Low-Literacy Simplicity**:
   - Short sentences, no banking jargon (*"Person you're sending money to"* instead of *"Beneficiary"*; *"Money Left"* instead of *"Available Balance"*).
   - Step-by-step numbered pills (1 instruction at a time).
   - Target button highlighting with pulsing blue glow rings.

### Multilingual Support
- **Languages**: English, Hindi (`hi`), Tamil (`ta`), Hinglish, and Tanglish (code-mixed).
- **Auto-detection**: Automatic script and keyword-based language detection with explicit manual toggle (EN / हिन्दी / தமிழ்).
- **Audio Output**: Speech synthesis (TTS) with Normal (0.95x) and Slow (0.72x) playback speed options for clear accessibility.
- **Voice Recognition**: Speech-to-Text with transcript confirmation (*"You said: Send ₹500 to Ravi. Is this correct? YES / NO"*).

### RAG Knowledge Base Architecture
Stored in `/backend/knowledge/` with normalized schemas across:
- `payments/`: Guidance on sending money, failed/pending payment explanations.
- `upi/`: What is UPI, UPI ID, QR payments, UPI PIN rules.
- `fraud/`: OTP theft, lottery/prize scams, KYC scams, parcel scams.
- `banking/`: Balance checks, transaction history, recipient help.
- `financial_literacy/`: Savings, interest, EMI, loan, credit score.
- `app_help/`: Simple Mode, voice guide, screen explanation.
- `hindi/`: Native Hindi QA and guidance.
- `tamil/`: Native Tamil QA and guidance.
- `multilingual/`: Hinglish & Tanglish conversational QA.
- `emergency/`: National Cyber Fraud Helpline (1930) reporting.

### Interactive Assistant Demo Scenarios
In the **Demo Mode** page, test the 7 canonical scenarios:
1. `DEMO 1`: Hindi Voice Payment Guidance (*"मुझे पैसे भेजने हैं"*)
2. `DEMO 2`: Tamil Voice Guidance (*"எப்படி பணம் அனுப்புவது?"*)
3. `DEMO 3`: Tanglish Payment Preparation (*"Ravi ku 500 send pannanum"*)
4. `DEMO 4`: OTP Theft Scam Interception (*"Someone is asking for OTP"*)
5. `DEMO 5`: Lottery Scam Warning (*"I won ₹50,000 but they want ₹500"*)
6. `DEMO 6`: Large-Payment Authentication (*"Send ₹25,000 to Ravi"*)
7. `DEMO 7`: Screen & Risk Explanation (*"What does this red warning mean?"*)

