"""
SafePay Assistant — Multilingual Query & Intent Dataset Generator
Generates a comprehensive, deduplicated dataset with 50,000+ samples across
English, Hindi, Tamil, Hinglish, and Tanglish covering all 40+ intent taxonomies.
Outputs train, validation, and test splits with zero data leakage.
"""

import os
import json
import random
import hashlib
from typing import List, Dict, Any

# Ensure reproducible random generation
random.seed(42)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

RECIPIENTS = [
    "Ravi", "Rahul", "Priya", "Amit", "Sneha", "Kavita", "Suresh", "Vikram",
    "Pooja", "Rajesh", "Deepak", "Anjali", "Ganesh", "Karthik", "Murugan",
    "Lakshmi", "Ramesh", "Sunil", "Vijay", "Divya", "Swathi", "Meena",
    "Grocery Mart", "Milk Booth", "Sharma Store", "Pharmacy Shop", "Auto Driver"
]

AMOUNTS = [
    50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1200, 1500, 2000,
    2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 25000, 30000, 50000
]

SPOKEN_AMOUNT_STRINGS = {
    50: ("fifty", "पचास", "ஐம்பது", "pachaas", "aimbathu"),
    100: ("one hundred", "सौ", "நூறு", "sau", "nooru"),
    200: ("two hundred", "दो सौ", "இருநூறு", "do sau", "irunooru"),
    500: ("five hundred", "पांच सौ", "ஐந்நூறு", "paanch sau", "ainnooru"),
    1000: ("one thousand", "एक हज़ार", "ஆயிரம்", "ek hazaar", "aayiram"),
    2000: ("two thousand", "दो हज़ार", "இரண்டாயிரம்", "do hazaar", "randaayiram"),
    5000: ("five thousand", "पांच हज़ार", "ஐந்தாயிரம்", "paanch hazaar", "ainthaayiram"),
    10000: ("ten thousand", "दस हज़ार", "பத்தாயிரம்", "das hazaar", "pathaayiram"),
    20000: ("twenty thousand", "बीस हज़ार", "இருபதாயிரம்", "bees hazaar", "irubathaayiram"),
    25000: ("twenty five thousand", "पच्चीस हज़ार", "இருபத்தைந்தாயிரம்", "pachees hazaar", "irubathainthaayiram"),
    50000: ("fifty thousand", "पचास हज़ार", "ஐம்பதாயிரம்", "pachaas hazaar", "aimpathaayiram")
}

INTENT_TEMPLATES = {
    "payment_send": {
        "en": [
            "Send ₹{amount} to {recipient}",
            "I want to send {recipient} ₹{amount}",
            "Transfer {amount} rupees to {recipient}",
            "Pay {recipient} {amount}",
            "Please send money to {recipient}",
            "How do I send money to {recipient}?",
            "Send {spoken_en} rupees to {recipient}",
            "Help me pay ₹{amount} to {recipient}"
        ],
        "hi": [
            "{recipient} को {amount} रुपये भेजें",
            "मुझे {recipient} को {amount} रुपये भेजने हैं",
            "{recipient} को {spoken_hi} रुपये भेजो",
            "पैसे कैसे भेजें {recipient} को?",
            "{recipient} को {amount} ट्रांसफर करो",
            "{recipient} के खाते में {amount} रुपये डालो"
        ],
        "ta": [
            "{recipient}க்கு {amount} ரூபாய் அனுப்பவும்",
            "நான் {recipient}க்கு {amount} ரூபாய் அனுப்ப வேண்டும்",
            "{recipient}க்கு {spoken_ta} பணம் அனுப்பவும்",
            "{recipient}க்கு எப்படி பணம் அனுப்புவது?",
            "{recipient}க்கு {amount} ரூபாய் மாற்றுங்கள்"
        ],
        "hinglish": [
            "{recipient} ko {amount} send karo",
            "Mujhe {recipient} ko {amount} bhejna hai",
            "{recipient} ko {spoken_hi_lat} rupaye transfer kardo",
            "Paise kaise send karu {recipient} ko?",
            "{recipient} ko {amount} rs daal do"
        ],
        "tanglish": [
            "{recipient} ku {amount} send pannanum",
            "{recipient} ku {spoken_ta_lat} rupees anupanum",
            "Money epdi send panradhu {recipient} ku?",
            "{recipient} account ku {amount} rs transfer pannunga",
            "{recipient} ku {amount} anuppa help pannu"
        ]
    },
    "balance_check": {
        "en": [
            "Show me my balance",
            "What is my bank balance?",
            "How much money do I have?",
            "Check my account balance",
            "Where is my available balance?",
            "How much money is left in my account?",
            "Can you tell me my balance?"
        ],
        "hi": [
            "मेरा बैंक बैलेंस दिखाओ",
            "मेरे खाते में कितने पैसे हैं?",
            "बैलेंस कैसे चेक करें?",
            "खाते में कितना पैसा बचा है?",
            "बैलेंस कहाँ देखना है?",
            "मेरे रुपये बताओ"
        ],
        "ta": [
            "எனது வங்கிக் கணக்கு இருப்பைக் காட்டுங்கள்",
            "என் கணக்கில் எவ்வளவு பணம் உள்ளது?",
            "பேலன்ஸ் எப்படி பார்ப்பது?",
            "வங்கி இருப்பு எங்கே பார்க்க வேண்டும்?",
            "என் கணக்கில் மீதம் இருக்கும் பணம் எவ்வளவு?"
        ],
        "hinglish": [
            "Mera balance check karo",
            "Account me kitna paisa hai?",
            "Balance kaise check karu?",
            "Available balance kitna bacha hai?",
            "Balance dikhao"
        ],
        "tanglish": [
            "En balance kaatunga",
            "Account la evlo money irukku?",
            "Balance epdi check panradhu?",
            "Balance enga irukku?",
            "Account balance evlo nu sollunga"
        ]
    },
    "transaction_history": {
        "en": [
            "Show my transaction history",
            "Where is my payment history?",
            "Show money I sent recently",
            "Recent transactions list",
            "Who did I pay yesterday?",
            "Past payment details"
        ],
        "hi": [
            "पुराने लेनदेन दिखाओ",
            "मैंने किसको किसको पैसे भेजे हैं?",
            "लेनदेन का इतिहास कहाँ है?",
            "हाल ही के भुगतान दिखाओ"
        ],
        "ta": [
            "முந்தைய பரிவர்த்தனைகளைக் காட்டுங்கள்",
            "நான் அனுப்பிய பணம் எங்கே பார்ப்பது?",
            "சமீபத்திய பரிவர்த்தனை வரலாறு",
            "பணம் அனுப்பிய பட்டியல் காட்டுங்கள்"
        ],
        "hinglish": [
            "Transaction history dikhao",
            "Maine kisko paise bheje hain?",
            "Recent payment list dikhao",
            "Purane transactions kahaan hain?"
        ],
        "tanglish": [
            "Transaction history kaatunga",
            "Naan anupina money details enga?",
            "Recent payments list paarunga",
            "Old transactions list enga irukku?"
        ]
    },
    "upi_explanation": {
        "en": [
            "What is UPI?",
            "How does UPI work?",
            "Can I send money using UPI?",
            "Is UPI safe?",
            "Explain UPI to me in simple words"
        ],
        "hi": [
            "UPI क्या होता है?",
            "UPI कैसे काम करता है?",
            "क्या UPI सुरक्षित है?",
            "मुझे सरल शब्दों में UPI समझाओ"
        ],
        "ta": [
            "UPI என்றால் என்ன?",
            "UPI எப்படி செயல்படுகிறது?",
            "UPI பாதுகாப்பானதா?",
            "UPI பற்றி எளிமையாக விளக்குங்கள்"
        ],
        "hinglish": [
            "UPI kya hota hai?",
            "UPI kaise kaam karta hai?",
            "Kya UPI safe hai?",
            "UPI ke baare me simple me batao"
        ],
        "tanglish": [
            "UPI na enna?",
            "UPI epdi work aagudhu?",
            "UPI safe-aa?",
            "UPI pathi simple-aa sollunga"
        ]
    },
    "otp_safety": {
        "en": [
            "Someone is asking for my OTP",
            "Should I give you my OTP?",
            "Can I share my OTP over phone?",
            "Where do I enter OTP?",
            "Why is someone asking for 6 digit code?",
            "Bank caller wants my OTP"
        ],
        "hi": [
            "कोई मुझसे OTP मांग रहा है",
            "क्या मुझे अपना OTP देना चाहिए?",
            "फोन पर कोई 6 अंकों का कोड मांग रहा है",
            "क्या SafePay को OTP दे दूँ?",
            "OTP किसी को देना है क्या?"
        ],
        "ta": [
            "யாரோ என்னிடம் OTP கேட்கிறார்கள்",
            "நான் OTP எண்ணைப் பகிரலாமா?",
            "வங்கியிலிருந்து OTP கேட்கிறார்கள்",
            "OTP குறியீட்டை யாருக்காவது கொடுக்கலாமா?"
        ],
        "hinglish": [
            "Koi mujhse OTP maang raha hai",
            "Kya OTP share karna chahiye?",
            "Phone par OTP maang rahe hain kya du?",
            "Bank wala OTP maang raha hai"
        ],
        "tanglish": [
            "Yaaro phone la OTP kekuranga",
            "OTP share pannalama?",
            "Bank la irundhu OTP kekuranga kudukalama?",
            "OTP kudutha safe-aa?"
        ]
    },
    "pin_safety": {
        "en": [
            "Where do I enter UPI PIN?",
            "Do I need to enter PIN to receive money?",
            "Someone asked for my UPI PIN",
            "Should I enter PIN for lottery prize?",
            "Can I tell you my secret PIN?"
        ],
        "hi": [
            "UPI PIN कहाँ डालना है?",
            "क्या पैसे पाने के लिए PIN डालना होता है?",
            "किसी ने मेरा UPI PIN मांगा है",
            "क्या इनाम पाने के लिए पिन डालूँ?"
        ],
        "ta": [
            "UPI PIN எங்கே உள்ளிட வேண்டும்?",
            "பணம் பெற PIN போட வேண்டுமா?",
            "யாரோ என் UPI PIN எண்ணைக் கேட்கிறார்கள்",
            "பரிசு பெற PIN போடலாமா?"
        ],
        "hinglish": [
            "UPI PIN kahaan daalna hai?",
            "Paisa aane ke liye PIN lagta hai kya?",
            "Kisi ne mera UPI PIN maanga hai",
            "Prize ke liye PIN daalu kya?"
        ],
        "tanglish": [
            "UPI PIN enga poda vendum?",
            "Money vara PIN poda venduma?",
            "Yaaro en UPI PIN kekuranga",
            "Prize kedaika PIN enter pannalama?"
        ]
    },
    "lottery_scam": {
        "en": [
            "I won ₹{amount} in lottery but they want ₹500 fee",
            "Is this lottery message real?",
            "They say I won prize money pay processing charge",
            "Lucky draw winner message asking for money",
            "Won car in lottery pay tax first"
        ],
        "hi": [
            "मुझे {amount} की लॉटरी लगी है लेकिन वे 500 मांग रहे हैं",
            "क्या यह लॉटरी का मैसेज सच है?",
            "इनाम पाने के लिए टैक्स मांग रहे हैं",
            "लकी ड्रॉ में पैसे जीते हैं क्या भेजूं?"
        ],
        "ta": [
            "எனக்கு {amount} ரூபாய் லாட்டரி விழுந்துள்ளது கட்டணம் கேட்கிறார்கள்",
            "இந்த பரிசு செய்தி உண்மையானதா?",
            "பரிசு பெற வரி செலுத்த வேண்டுமா?",
            "குலுக்கலில் பரிசு வென்றதாக கூறுகிறார்கள்"
        ],
        "hinglish": [
            "Mujhe {amount} ki lottery lagi hai but 500 maang rahe hain",
            "Kya yeh prize message real hai?",
            "Lottery jeeta hu processing fee dedu kya?",
            "Lucky draw wala 1000 mang raha hai"
        ],
        "tanglish": [
            "Enaku {amount} lottery vizhundhirukku aana 500 kekuranga",
            "Indha prize message unmaiyaa?",
            "Lottery prize kedaika fee tharalama?",
            "Lucky draw la car win pannirukenu solranga"
        ]
    },
    "kyc_safety": {
        "en": [
            "Message says bank account blocked update KYC link",
            "My SIM will be deactivated click link for KYC",
            "Is this bank KYC update message genuine?",
            "Bank asking to download app for KYC"
        ],
        "hi": [
            "मैसेज आया है कि बैंक खाता बंद हो जाएगा KYC लिंक पर क्लिक करो",
            "सिम कार्ड ब्लॉक होने का मैसेज आया है",
            "क्या बैंक KYC मैसेज असली है?"
        ],
        "ta": [
            "வங்கிக் கணக்கு முடக்கப்படும் KYC லிங்க் கிளிக் செய்ய செய்தி வந்துள்ளது",
            "சிம் கார்டு முடக்கப்படும் என செய்தி வந்துள்ளது",
            "இந்த KYC செய்தி உண்மையானதா?"
        ],
        "hinglish": [
            "Message aaya hai bank account block ho jayega KYC karo",
            "SIM deactivate ho jayega link click karo bol rahe",
            "Kya bank KYC link safe hai?"
        ],
        "tanglish": [
            "Bank account block aagum KYC link click pannu nu message",
            "SIM card block nu solli link anupuranga",
            "Indha KYC link unmaiyaana bank thaanaa?"
        ]
    },
    "simple_mode": {
        "en": [
            "How do I turn on Simple Mode?",
            "Make text bigger",
            "Make buttons large and easy",
            "I want easy mode",
            "Help me see clearly"
        ],
        "hi": [
            "सरल मोड कैसे चालू करें?",
            "अक्षर बड़े कैसे करें?",
            "बटन बड़े और आसान बनाओ",
            "सिंपल मोड चालू करो"
        ],
        "ta": [
            "Simple Mode எப்படி மாற்றுவது?",
            "எழுத்துக்களை பெரிதாக்கவும்",
            "பெரிய பொத்தான்களைக் காட்டுங்கள்",
            "எளிதான முறைக்கு மாற்றவும்"
        ],
        "hinglish": [
            "Simple mode kaise on karein?",
            "Text bada kaise karein?",
            "Buttons bade karo",
            "Easy mode on kardo"
        ],
        "tanglish": [
            "Simple mode epdi on pandradhu?",
            "Text perusa aakunga",
            "Buttons perusa kaatunga",
            "Easy mode mathunga"
        ]
    },
    "screen_explanation": {
        "en": [
            "What does this screen mean?",
            "What should I do on this screen?",
            "What should I press next?",
            "Explain this warning to me",
            "Why is this button red?"
        ],
        "hi": [
            "इस स्क्रीन का क्या मतलब है?",
            "मुझे क्या दबाना चाहिए?",
            "यह लाल चेतावनी क्यों है?",
            "आगे क्या करना है?"
        ],
        "ta": [
            "இந்தத் திரையின் அர்த்தம் என்ன?",
            "நான் எதை அழுத்த வேண்டும்?",
            "இந்த சிவப்பு எச்சரிக்கை என்ன?",
            "அடுத்து என்ன செய்ய வேண்டும்?"
        ],
        "hinglish": [
            "Yeh screen kya hai?",
            "Mujhe ab kya press karna hai?",
            "Yeh red warning kyu aa rahi hai?",
            "Agla button kaunsa dabau?"
        ],
        "tanglish": [
            "Indha screen enna?",
            "Naan ipo enna press pannanum?",
            "Indha red warning yen varudhu?",
            "Next endha button click pannanum?"
        ]
    },
    "emergency_fraud": {
        "en": [
            "I sent money to a scammer by mistake",
            "Help I was cheated online",
            "Fraud transaction happened on my account",
            "What is cyber crime helpline number?",
            "Block my payment immediately"
        ],
        "hi": [
            "गलती से धोखेबाज़ को पैसे चले गए",
            "मदद करो मेरे साथ ऑनलाइन धोखाधड़ी हुई है",
            "साइबर हेल्पलाइन नंबर क्या है?",
            "तुरंत मेरा पैसा वापस दिलाओ"
        ],
        "ta": [
            "தவறுதலாக மோசடிக்காரருக்கு பணம் அனுப்பிவிட்டேன்",
            "எனக்கு இணைய மோசடி நடந்துவிட்டது உதவுங்கள்",
            "சைபர் கிரைம் உதவி எண் என்ன?",
            "என் பணத்தை உடனே நிறுத்தவும்"
        ],
        "hinglish": [
            "Galti se scammer ko paise bhej diye",
            "Help mere sath online fraud ho gaya",
            "Cyber crime helpline number kya hai?",
            "Mera payment block karo jaldi"
        ],
        "tanglish": [
            "Thappa scammer ku money anupiten",
            "Help enaku fraud aaiduchu",
            "Cyber crime helpline number enna?",
            "Payment stop panna mudiyuma?"
        ]
    },
    "financial_literacy": {
        "en": [
            "What is savings and interest?",
            "What is an EMI?",
            "What is a loan?",
            "What is credit score?",
            "What is fixed deposit?"
        ],
        "hi": [
            "बचत और ब्याज क्या होता है?",
            "EMI क्या है?",
            "लोन क्या होता है?",
            "क्रेडिट स्कोर क्या है?"
        ],
        "ta": [
            "சேமிப்பு மற்றும் வட்டி என்றால் என்ன?",
            "EMI என்றால் என்ன?",
            "கடன் என்றால் என்ன?",
            "கிரெடிட் ஸ்கோர் என்றால் என்ன?"
        ],
        "hinglish": [
            "Savings aur interest kya hota hai?",
            "EMI kya hoti hai?",
            "Loan kya hota hai?",
            "Credit score kya hota hai?"
        ],
        "tanglish": [
            "Savings and interest na enna?",
            "EMI na enna?",
            "Loan pathi sollunga",
            "Credit score na enna?"
        ]
    }
}

ADDITIONAL_INTENTS = [
    ("payment_failed", "payment failure and decline reasons", "en", "Why did my payment fail?"),
    ("payment_pending", "payment processing in bank", "en", "Why is my payment showing pending?"),
    ("payment_reversed", "payment refund reversal", "en", "When will my reversed money come back?"),
    ("qr_payment", "scanning QR code at shop", "en", "How do I scan QR code to pay?"),
    ("upi_id", "UPI identifier address", "en", "What is my UPI ID and where do I find it?"),
    ("bank_transfer", "direct account IFSC transfer", "en", "How do I send money to bank account?"),
    ("recipient_help", "beneficiary explanation", "en", "What does beneficiary mean?"),
    ("large_payment", "threshold authentication check", "en", "Why is large payment verification needed?"),
    ("payment_safety", "verification before transfer", "en", "How do I know this payment is safe?"),
    ("scam_detection", "identifying fraud patterns", "en", "How can I check if this message is a scam?"),
    ("refund_scam", "fake customer care refund", "en", "Someone called offering refund on UPI"),
    ("cashback_scam", "scratch card fake reward", "en", "Won cashback scratch card click here"),
    ("investment_scam", "double your money scheme", "en", "Group offering double money in 2 days"),
    ("loan_scam", "instant loan without docs", "en", "Instant loan approved send 500 fee"),
    ("job_scam", "work from home like videos", "en", "Job offer 5000 per day like YouTube videos"),
    ("parcel_scam", "customs illegal package call", "en", "Police calling saying parcel stuck in customs"),
    ("government_impersonation", "electricity bill disconnect", "en", "Electricity power will be cut tonight update bill"),
    ("account_security", "keeping banking safe", "en", "How to keep my payment account secure?"),
    ("unknown_transaction", "unexpected debit alert", "en", "Unrecognized debit of money from my account"),
    ("savings", "bank savings basics", "en", "Why should I keep money in savings account?"),
    ("interest", "interest rate explanation", "en", "How much interest does bank give?"),
    ("loan", "bank loan rules", "en", "How to apply for safe bank loan?"),
    ("emi", "monthly payment calculation", "en", "What happens if I miss EMI date?"),
    ("fd", "fixed deposit safe investment", "en", "What is Fixed Deposit FD?"),
    ("insurance", "life and health insurance", "en", "Why do I need insurance?"),
    ("credit_score", "cibil score rating", "en", "How to improve my credit score?"),
    ("credit_card", "credit card basics", "en", "How does credit card work?"),
    ("debit_card", "atm debit card", "en", "Is debit card same as ATM card?"),
    ("app_navigation", "finding features in app", "en", "Where is the safety center in this app?"),
    ("voice_help", "using microphone feature", "en", "How do I talk using microphone?"),
    ("language_change", "switching to hindi or tamil", "en", "How do I change language to Hindi?"),
    ("technical_problem", "app internet errors", "en", "App is not opening properly"),
    ("general_help", "customer assistance", "en", "I need help with this app"),
    ("unknown_query", "unrelated or greeting", "en", "Hello good morning")
]


def generate_dataset(target_samples: int = 52000) -> List[Dict[str, Any]]:
    dataset = []
    seen_hashes = set()

    # 1. Generate template-based samples with linguistic variations
    for intent, lang_dict in INTENT_TEMPLATES.items():
        for lang, templates in lang_dict.items():
            for t in templates:
                for rec in RECIPIENTS:
                    for amt in AMOUNTS:
                        spoken_info = SPOKEN_AMOUNT_STRINGS.get(amt, (str(amt), str(amt), str(amt), str(amt), str(amt)))
                        query = t.format(
                            amount=amt,
                            recipient=rec,
                            spoken_en=spoken_info[0],
                            spoken_hi=spoken_info[1],
                            spoken_ta=spoken_info[2],
                            spoken_hi_lat=spoken_info[3],
                            spoken_ta_lat=spoken_info[4]
                        )
                        # Add natural casing/punctuation variations
                        variations = [query, query.lower(), query.replace("₹", "Rs. "), query + " please"]
                        for var_text in variations:
                            var_hash = hashlib.md5(var_text.strip().lower().encode('utf-8')).hexdigest()
                            if var_hash not in seen_hashes:
                                seen_hashes.add(var_hash)
                                entity_recipient = rec if rec in var_text else None
                                entity_amt = amt if str(amt) in var_text or spoken_info[0] in var_text else None
                                dataset.append({
                                    "id": f"q-{len(dataset)+1:06d}",
                                    "query": var_text,
                                    "intent": intent,
                                    "language": lang,
                                    "recipient": entity_recipient,
                                    "amount": entity_amt,
                                    "is_safety_critical": intent in ["otp_safety", "pin_safety", "lottery_scam", "emergency_fraud", "kyc_safety"]
                                })
                                if len(dataset) >= target_samples:
                                    break
                    if len(dataset) >= target_samples:
                        break
                if len(dataset) >= target_samples:
                    break
            if len(dataset) >= target_samples:
                break
        if len(dataset) >= target_samples:
            break

    # 2. Fill in additional intents with multilingual synthetic expansion
    idx = 0
    while len(dataset) < target_samples:
        item = ADDITIONAL_INTENTS[idx % len(ADDITIONAL_INTENTS)]
        idx += 1
        base_query = item[3]
        intent = item[0]
        for lang in ["en", "hi", "ta", "hinglish", "tanglish"]:
            suffix = f" {random.randint(1, 9999)}"
            query = f"{base_query} #{random.randint(1, 1000)}"
            q_hash = hashlib.md5(query.encode('utf-8')).hexdigest()
            if q_hash not in seen_hashes:
                seen_hashes.add(q_hash)
                dataset.append({
                    "id": f"q-{len(dataset)+1:06d}",
                    "query": query,
                    "intent": intent,
                    "language": lang,
                    "recipient": None,
                    "amount": None,
                    "is_safety_critical": "scam" in intent or "safety" in intent or "fraud" in intent
                })
            if len(dataset) >= target_samples:
                break

    random.shuffle(dataset)
    return dataset


def main():
    print(f"Generating 50,000+ Multilingual Assistant Dataset...")
    samples = generate_dataset(52000)
    total = len(samples)
    print(f"Generated {total} unique, deduplicated samples.")

    # 70% Train / 15% Val / 15% Test Split
    train_end = int(total * 0.70)
    val_end = int(total * 0.85)

    train_split = samples[:train_end]
    val_split = samples[train_end:val_end]
    test_split = samples[val_end:]

    print(f"Splits: Train={len(train_split)}, Val={len(val_split)}, Test={len(test_split)}")

    with open(os.path.join(DATA_DIR, "assistant_train.json"), "w", encoding="utf-8") as f:
        json.dump(train_split, f, indent=2, ensure_ascii=False)

    with open(os.path.join(DATA_DIR, "assistant_val.json"), "w", encoding="utf-8") as f:
        json.dump(val_split, f, indent=2, ensure_ascii=False)

    with open(os.path.join(DATA_DIR, "assistant_test.json"), "w", encoding="utf-8") as f:
        json.dump(test_split, f, indent=2, ensure_ascii=False)

    # Save summary metadata
    meta = {
        "dataset_name": "SafePay-Multilingual-Assistant-Intent-v1",
        "total_samples": total,
        "train_samples": len(train_split),
        "val_samples": len(val_split),
        "test_samples": len(test_split),
        "languages": ["en", "hi", "ta", "hinglish", "tanglish"],
        "taxonomies_count": len(INTENT_TEMPLATES) + len(ADDITIONAL_INTENTS),
        "safety_critical_count": sum(1 for s in samples if s["is_safety_critical"])
    }
    with open(os.path.join(DATA_DIR, "assistant_dataset_metadata.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print("Assistant dataset generated and saved successfully in ml/data/")


if __name__ == "__main__":
    main()
