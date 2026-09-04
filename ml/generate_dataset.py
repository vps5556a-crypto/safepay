import json
import os
import random

os.makedirs('ml/data', exist_ok=True)
random.seed(42)

CATEGORIES = [
    "LEGITIMATE",
    "BANK_PHISHING",
    "ACCOUNT_VERIFICATION",
    "KYC_SCAM",
    "OTP_THEFT",
    "PIN_THEFT",
    "UPI_SCAM",
    "PAYMENT_REQUEST_SCAM",
    "REFUND_SCAM",
    "CASHBACK_SCAM",
    "LOTTERY_SCAM",
    "PRIZE_SCAM",
    "INVESTMENT_SCAM",
    "CRYPTO_SCAM",
    "LOAN_SCAM",
    "JOB_SCAM",
    "GOVERNMENT_IMPERSONATION",
    "POLICE_IMPERSONATION",
    "DELIVERY_SCAM",
    "PARCEL_SCAM",
    "ROMANCE_SCAM",
    "SEXTORTION",
    "MALICIOUS_LINK",
    "SOCIAL_ENGINEERING",
    "OTHER_FINANCIAL_SCAM"
]

DATASET = [
    # --- LEGITIMATE TRANSACTIONS & ALERTS ---
    {"text": "Your payment of ₹500 to Rahul was successful.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Your UPI payment of ₹2,000 to Rahul Kumar was successful. Ref No: 492019482910.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "₹450 paid to Grocery Mart via HDFC UPI. Available balance: ₹24,550.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Your account ACC-58291049 has been credited with ₹65,000 towards monthly salary from TechCorp Ltd.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Electricity bill of ₹1,450 paid successfully via BillDesk. Consumer No: 9812401.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "₹350 paid to Swiggy for Order #82910. Thank you for using Google Pay.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "ATM withdrawal of ₹2,000 from SBI ATM at MG Road. Txn ID: 9102830.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Your monthly credit card statement for ending 4091 is now generated. Total due: ₹3,240.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Dear customer, your FD interest of ₹1,250 has been credited to savings account.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Received ₹1,500 from Priya Sharma via PhonePe. Message: Movie tickets.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Payment of ₹199 to Netflix subscription renewed successfully.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Recharge of ₹299 for Airtel mobile +91 9876543210 successful. Validity: 28 days.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "₹10,000 transferred to Mother's savings account via NEFT. UTR: HDFCN8291048.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Your Zomato order has been delivered. Enjoy your meal!", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Your Fastag account has been recharged with ₹1,000. Balance: ₹1,420.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "SIP installment of ₹5,000 towards Nifty 50 Index Fund debited successfully.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},

    # --- LEGITIMATE PERSONAL MESSAGES ---
    {"text": "Rahul, please send me ₹500 for groceries. I'll return it tonight.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Hey, could you send ₹200 for the coffee we had earlier?", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Can you split the dinner bill? Your share is ₹650.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Please transfer ₹1,200 for the cab fare from airport.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Dad, I need ₹3,000 for college books purchase.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Bro, I sent you ₹500 on GPay. Let me know when you receive it.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Paid the flat maintenance of ₹2,500. Please send your 50% share ₹1,250.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Thanks for paying for lunch yesterday. I just sent you ₹400.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Can you pay the milkman ₹800 today? I'll repay you when I get home.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},
    {"text": "Bhai ₹200 bhej de chai sutta ka, sham ko wapas karta hu.", "label": "legitimate", "category": "LEGITIMATE", "language": "hinglish"},
    {"text": "Mummy ko dawai ke liye ₹1,500 transfer kar diye hain.", "label": "legitimate", "category": "LEGITIMATE", "language": "hinglish"},
    {"text": "Sir, society maintenance receipt attached for ₹2,400.", "label": "legitimate", "category": "LEGITIMATE", "language": "en"},

    # --- BANK PHISHING & ACCOUNT SUSPENSION SCAMS ---
    {"text": "Your bank account will be blocked today. Send ₹2,000 immediately to verify your account.", "label": "scam", "category": "BANK_PHISHING", "language": "en"},
    {"text": "Dear SBI user, your YONO account has been suspended due to pending security update. Send ₹1,000 to reactivate or visit http://sbi-unblock.xyz.", "label": "scam", "category": "BANK_PHISHING", "language": "en"},
    {"text": "URGENT: Your HDFC NetBanking is deactivated. Transfer ₹500 verification amount to upi: verify_hdfc@paytm within 2 hours.", "label": "scam", "category": "BANK_PHISHING", "language": "en"},
    {"text": "ICICI Alert: Unauthorized login attempt detected from Russia. Transfer your balance to Safe Account to protect funds.", "label": "scam", "category": "BANK_PHISHING", "language": "en"},
    {"text": "Your debit card has been disabled. Send ₹1,500 immediately for security unblocking.", "label": "scam", "category": "BANK_PHISHING", "language": "en"},
    {"text": "Bank alert: Your account is on hold. Pay ₹2,500 unfreeze fee to resume transactions.", "label": "scam", "category": "BANK_PHISHING", "language": "en"},
    {"text": "Account block ho jayega 2 ghante me. Turant ₹1,000 verify karo is link pe.", "label": "scam", "category": "BANK_PHISHING", "language": "hinglish"},
    {"text": "Apka SBI khata band hone wala hai. Abhi ₹2,000 bhejkar chalu karein.", "label": "scam", "category": "BANK_PHISHING", "language": "hinglish"},
    {"text": "Bank of Baroda warning: Account dormancy alert. Pay ₹500 activation fee.", "label": "scam", "category": "ACCOUNT_VERIFICATION", "language": "en"},
    {"text": "Account verification mandatory within 30 minutes or permanent termination.", "label": "scam", "category": "ACCOUNT_VERIFICATION", "language": "en"},

    # --- KYC SCAMS ---
    {"text": "Your KYC has expired today. Your bank account will be closed in 24 hours. Update KYC now at http://kyc-bank-portal.online.", "label": "scam", "category": "KYC_SCAM", "language": "en"},
    {"text": "Paytm Alert: Your Paytm KYC is incomplete. Your wallet will be blocked. Send ₹10 for KYC verification to 9812938192@paytm.", "label": "scam", "category": "KYC_SCAM", "language": "en"},
    {"text": "Dear customer, your SIM card will be deactivated tonight due to missing Aadhaar KYC. Call customer care 9182910283 and pay ₹50.", "label": "scam", "category": "KYC_SCAM", "language": "en"},
    {"text": "Bank KYC document re-verification mandatory under RBI guidelines. Pay ₹100 filing fee immediately.", "label": "scam", "category": "KYC_SCAM", "language": "en"},
    {"text": "Aadhaar PAN link failed. Pay fine of ₹1,000 to avoid bank freeze.", "label": "scam", "category": "KYC_SCAM", "language": "en"},
    {"text": "Apka KYC expire ho gaya hai. Abhi ₹10 bhejkar verify karein warna account band.", "label": "scam", "category": "KYC_SCAM", "language": "hinglish"},

    # --- OTP & PIN THEFT ---
    {"text": "Share the OTP you received to complete your refund.", "label": "scam", "category": "OTP_THEFT", "language": "en"},
    {"text": "Bank security team calling: We stopped a fraud transaction of ₹15,000. Please read out the 6-digit OTP to reverse it.", "label": "scam", "category": "OTP_THEFT", "language": "en"},
    {"text": "Enter your 4-digit UPI PIN to receive ₹5,000 cashback directly in your bank account.", "label": "scam", "category": "PIN_THEFT", "language": "en"},
    {"text": "Please tell me the OTP sent to your phone to confirm your delivery cancellation.", "label": "scam", "category": "OTP_THEFT", "language": "en"},
    {"text": "Type your UPI PIN on this page to claim ₹10,000 government subsidy.", "label": "scam", "category": "PIN_THEFT", "language": "en"},
    {"text": "Sir, verification ke liye mobile par aya OTP batayein turant.", "label": "scam", "category": "OTP_THEFT", "language": "hinglish"},
    {"text": "Paisa pane ke liye apna UPI PIN dalein.", "label": "scam", "category": "PIN_THEFT", "language": "hinglish"},

    # --- UPI & PAYMENT REQUEST SCAMS ---
    {"text": "Scan this QR code and approve the request to receive ₹8,000 for your OLX sofa.", "label": "scam", "category": "UPI_SCAM", "language": "en"},
    {"text": "I have sent you a payment request of ₹5,000 on PhonePe. Click Pay to accept money into your account.", "label": "scam", "category": "PAYMENT_REQUEST_SCAM", "language": "en"},
    {"text": "Accept the collect request of ₹2,500 to activate your merchant QR settlement.", "label": "scam", "category": "PAYMENT_REQUEST_SCAM", "language": "en"},
    {"text": "Money transfer failed: Approve ₹1 debit transaction on Google Pay to clear stuck payment of ₹12,000.", "label": "scam", "category": "UPI_SCAM", "language": "en"},
    {"text": "OLX buyer: QR code scan karke accept karo, paisa apke account me aa jayega.", "label": "scam", "category": "UPI_SCAM", "language": "hinglish"},

    # --- PRIZE, LOTTERY & CASHBACK SCAMS ---
    {"text": "Congratulations! You won ₹50,000. Send ₹500 processing fee to claim your prize.", "label": "scam", "category": "PRIZE_SCAM", "language": "en"},
    {"text": "You have won a brand new Tata Safari in Jio 5G Lucky Draw! Deposit ₹25,000 registration tax to dispatch car.", "label": "scam", "category": "LOTTERY_SCAM", "language": "en"},
    {"text": "KBC Winner: You won ₹25,00,000 lottery from Amitabh Bachchan KBC! Call Rana Pratap Singh on WhatsApp and pay ₹5,500 file charge.", "label": "scam", "category": "LOTTERY_SCAM", "language": "en"},
    {"text": "You received ₹1,999 cashback voucher on PhonePe! Send ₹99 to activate cashback in your account.", "label": "scam", "category": "CASHBACK_SCAM", "language": "en"},
    {"text": "Claim your Amazon Diwali ₹10,000 gift voucher now. Pay ₹199 shipping charge to receive voucher code.", "label": "scam", "category": "PRIZE_SCAM", "language": "en"},
    {"text": "Mubarak ho! Aapne ₹50,000 jeete hain. Claim karne ke liye ₹500 fee bhejein.", "label": "scam", "category": "PRIZE_SCAM", "language": "hinglish"},

    # --- REFUND SCAMS ---
    {"text": "Your electricity bill was charged twice ₹1,450. To receive your instant refund, install AnyDesk / TeamViewer and share code.", "label": "scam", "category": "REFUND_SCAM", "language": "en"},
    {"text": "Amazon customer care: We are issuing refund of ₹4,999 for returned laptop bag. Click link to enter UPI ID and claim.", "label": "scam", "category": "REFUND_SCAM", "language": "en"},
    {"text": "IRCTC refund of ₹1,850 pending. Approve the payment request to initiate refund.", "label": "scam", "category": "REFUND_SCAM", "language": "en"},
    {"text": "Income tax refund of ₹14,200 approved. Pay ₹500 processing fee to credit to bank account.", "label": "scam", "category": "REFUND_SCAM", "language": "en"},

    # --- LOAN & JOB SCAMS ---
    {"text": "Pre-approved instant personal loan of ₹5,00,000 at 1% interest without documents. Pay ₹1,999 loan insurance fee to disburse.", "label": "scam", "category": "LOAN_SCAM", "language": "en"},
    {"text": "Dhani Loan Approval: Your loan of ₹2,50,000 is ready. Deposit ₹2,500 NOC charges on UPI.", "label": "scam", "category": "LOAN_SCAM", "language": "en"},
    {"text": "Work from home part-time, earn ₹5,000 daily from home. Pay ₹999 registration fee.", "label": "scam", "category": "JOB_SCAM", "language": "en"},
    {"text": "Earn ₹1,000 to ₹3,000 per hour by liking YouTube videos and rating hotels on Google Maps. Pay ₹1,500 VIP activation deposit.", "label": "scam", "category": "JOB_SCAM", "language": "en"},
    {"text": "Part-time job offer: Like 5 Instagram posts and earn ₹500. Join our Telegram task group and send ₹1,000 task deposit.", "label": "scam", "category": "JOB_SCAM", "language": "en"},

    # --- INVESTMENT & CRYPTO SCAMS ---
    {"text": "Double your money in 24 hours with guaranteed crypto mining profits. Invest ₹5,000 and withdraw ₹10,000 tomorrow.", "label": "scam", "category": "INVESTMENT_SCAM", "language": "en"},
    {"text": "Exclusive stock market insider trading group: 100% daily returns. Send ₹10,000 joining fee to our UPI analyst.", "label": "scam", "category": "INVESTMENT_SCAM", "language": "en"},
    {"text": "Invest ₹2,000 in Bitcoin cloud trading and get ₹500 daily passive income directly in bank account.", "label": "scam", "category": "CRYPTO_SCAM", "language": "en"},

    # --- GOVERNMENT & POLICE IMPERSONATION ---
    {"text": "Delhi Police Cyber Crime: A non-bailable arrest warrant has been issued in your name for cyber fraud. Pay ₹25,000 bail settlement immediately.", "label": "scam", "category": "POLICE_IMPERSONATION", "language": "en"},
    {"text": "CBI Officer Sharma: Illegal drugs found in parcel sent to Taiwan with your Aadhaar. Transfer ₹50,000 to RBI verification account to avoid jail.", "label": "scam", "category": "POLICE_IMPERSONATION", "language": "en"},
    {"text": "Ministry of Finance: Penalty of ₹5,000 levied for late GST tax filing. Pay immediately or bank accounts will be attached.", "label": "scam", "category": "GOVERNMENT_IMPERSONATION", "language": "en"},
    {"text": "Electricity Board Officer: Your electricity power supply will be cut off tonight at 9:30 PM. Call 9812038102 and pay overdue immediately.", "label": "scam", "category": "GOVERNMENT_IMPERSONATION", "language": "en"},

    # --- DELIVERY & PARCEL SCAMS ---
    {"text": "India Post: Your package could not be delivered due to incorrect house number. Pay ₹25 re-delivery fee at http://indiapost-update.xyz.", "label": "scam", "category": "DELIVERY_SCAM", "language": "en"},
    {"text": "BlueDart tracking: International courier package detained at customs. Pay ₹1,500 duty fee to release shipment.", "label": "scam", "category": "PARCEL_SCAM", "language": "en"},
    {"text": "FedEx: Your courier parcel is on hold. Click here to confirm shipping address and pay ₹50 delivery charge.", "label": "scam", "category": "PARCEL_SCAM", "language": "en"},

    # --- ROMANCE & SEXTORTION SCAMS ---
    {"text": "Hi darling, I'm stuck at Delhi airport customs with gold jewelry gifts for you. Please transfer ₹30,000 customs clearance fee urgently.", "label": "scam", "category": "ROMANCE_SCAM", "language": "en"},
    {"text": "We have recorded your private webcam video. Send ₹15,000 to this UPI ID or we will publish it to all your contacts on WhatsApp.", "label": "scam", "category": "SEXTORTION", "language": "en"},

    # --- MALICIOUS LINK & SOCIAL ENGINEERING ---
    {"text": "Click this link to download new WhatsApp Pink with secret themes: http://apk-download-free.xyz/whatsapp.apk", "label": "scam", "category": "MALICIOUS_LINK", "language": "en"},
    {"text": "Urgent from your boss: I am in a board meeting and need you to buy 5 Apple gift cards worth ₹10,000 immediately.", "label": "scam", "category": "SOCIAL_ENGINEERING", "language": "en"},
    {"text": "Security Alert: Verify your payment credentials at http://safepay-verify-portal.top or account will be terminated.", "label": "scam", "category": "OTHER_FINANCIAL_SCAM", "language": "en"}
]

# Systematic expansion for diversity & real patterns
VARIATIONS = []
contacts = ["Rahul Kumar", "Priya Sharma", "Amit Patel", "Sneha Roy", "Vikram Singh", "Ananya Gupta", "Rohan Mehta", "Pooja Verma", "Grocery Mart", "Apollo Pharmacy", "Swiggy", "Zomato", "Electricity Board", "Airtel", "Jio", "BookMyShow", "Urban Company", "Decathlon"]
amounts = [100, 250, 450, 500, 750, 1200, 1450, 2000, 3500, 5000, 8000, 10000, 25000]

for c in contacts:
    for a in amounts:
        VARIATIONS.append({
            "text": f"Your payment of ₹{a} to {c} was successful.",
            "label": "legitimate",
            "category": "LEGITIMATE",
            "language": "en"
        })
        VARIATIONS.append({
            "text": f"₹{a} sent to {c.lower().replace(' ', '')}@upi. Transaction ref: {random.randint(100000000000, 999999999999)}.",
            "label": "legitimate",
            "category": "LEGITIMATE",
            "language": "en"
        })
        if a <= 5000:
            VARIATIONS.append({
                "text": f"Hey {c.split()[0]}, please send me ₹{a} for the dinner split tonight.",
                "label": "legitimate",
                "category": "LEGITIMATE",
                "language": "en"
            })
            VARIATIONS.append({
                "text": f"Please send me ₹{a} for groceries. I'll return it tonight.",
                "label": "legitimate",
                "category": "LEGITIMATE",
                "language": "en"
            })

banks = ["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Punjab National Bank", "Kotak Mahindra Bank", "Bank of Baroda", "Canara Bank"]
for b in banks:
    for a in [500, 1000, 2000, 2500, 5000]:
        VARIATIONS.append({
            "text": f"Your {b} account will be blocked today. Send ₹{a} immediately to verify your account.",
            "label": "scam",
            "category": "BANK_PHISHING",
            "language": "en"
        })
        VARIATIONS.append({
            "text": f"Dear {b} customer, NetBanking access suspended. Send ₹{a} unblock verification fee.",
            "label": "scam",
            "category": "BANK_PHISHING",
            "language": "en"
        })
        VARIATIONS.append({
            "text": f"{b} Alert: KYC expired. Deposit ₹{a} verification charge to avoid account freeze.",
            "label": "scam",
            "category": "KYC_SCAM",
            "language": "en"
        })

for a in [5000, 10000, 25000, 50000, 100000, 2500000]:
    VARIATIONS.append({
        "text": f"Congratulations! You won ₹{a} prize in lucky draw. Pay ₹500 processing fee to claim.",
        "label": "scam",
        "category": "PRIZE_SCAM",
        "language": "en"
    })
    VARIATIONS.append({
        "text": f"You have won ₹{a} cashback from PhonePe. Enter your UPI PIN to claim reward.",
        "label": "scam",
        "category": "CASHBACK_SCAM",
        "language": "en"
    })
    VARIATIONS.append({
        "text": f"Instant loan of ₹{a} approved with zero interest. Pay ₹1,500 file charges to release funds.",
        "label": "scam",
        "category": "LOAN_SCAM",
        "language": "en"
    })

otp_phrases = [
    "Share the OTP you received to complete your refund.",
    "Please tell me the 6-digit OTP to reverse the accidental transfer.",
    "Tell the OTP sent by your bank to cancel unauthorized transaction.",
    "Bank manager needs your OTP code to verify mobile banking update.",
    "Share SMS OTP code to confirm your package re-delivery.",
    "Enter OTP code on phone to unfreeze blocked debit card.",
    "Provide OTP received from UIDAI to confirm Aadhaar KYC update."
]
for p in otp_phrases:
    VARIATIONS.append({
        "text": p,
        "label": "scam",
        "category": "OTP_THEFT",
        "language": "en"
    })

pin_phrases = [
    "Enter your UPI PIN to receive money into your bank account.",
    "Type your 6-digit UPI PIN to claim ₹2,000 cashback on Google Pay.",
    "To accept payment on PhonePe, please enter your UPI PIN now.",
    "Enter your ATM PIN on this verification form to unlock internet banking."
]
for p in pin_phrases:
    VARIATIONS.append({
        "text": p,
        "label": "scam",
        "category": "PIN_THEFT",
        "language": "en"
    })

delivery_phrases = [
    "India Post: Address incomplete for parcel #IN981240. Pay ₹25 address update fee at http://post-in.top",
    "BlueDart: Your parcel delivery is held at transit hub. Pay ₹50 delivery re-attempt charge.",
    "DTDC Courier: Pay customs clearance charge of ₹200 to dispatch pending package."
]
for p in delivery_phrases:
    VARIATIONS.append({
        "text": p,
        "label": "scam",
        "category": "DELIVERY_SCAM",
        "language": "en"
    })

TOTAL_DATASET = DATASET + VARIATIONS
seen = set()
UNIQUE_DATASET = []
for item in TOTAL_DATASET:
    norm = item["text"].strip().lower()
    if norm not in seen:
        seen.add(norm)
        UNIQUE_DATASET.append(item)

print(f"Total Unique Labeled Samples: {len(UNIQUE_DATASET)}")
category_counts = {}
for item in UNIQUE_DATASET:
    cat = item["category"]
    category_counts[cat] = category_counts.get(cat, 0) + 1

for cat, count in sorted(category_counts.items()):
    print(f"  - {cat}: {count}")

with open('ml/data/scam_dataset.json', 'w', encoding='utf-8') as f:
    json.dump(UNIQUE_DATASET, f, indent=2, ensure_ascii=False)

print("Saved cleanly to ml/data/scam_dataset.json")
