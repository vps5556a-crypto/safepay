import json
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from preprocess import clean_text

def sigmoid(z):
    import math
    return 1.0 / (1.0 + math.exp(-z))

def predict(text, model_data):
    cleaned = clean_text(text)
    words = cleaned.split()
    
    # Extract unigrams and bigrams
    ngrams = list(words)
    for i in range(len(words) - 1):
        ngrams.append(f"{words[i]} {words[i+1]}")
    
    vocab = model_data["vocabulary"]
    idf = model_data["idf"]
    coef = model_data["coefficients"]
    intercept = model_data["intercept"]
    
    # Compute dot product: sum(tf_idf * coef)
    # Simple sublinear tf: 1 + log(tf)
    tf_counts = {}
    for ng in ngrams:
        tf_counts[ng] = tf_counts.get(ng, 0) + 1
        
    dot_product = intercept
    for ng, count in tf_counts.items():
        if ng in vocab:
            idx = vocab[ng]
            tf_idf = (1.0 + (count - 1) * 0.5) * idf[idx]
            dot_product += tf_idf * coef[idx]
            
    probability = sigmoid(dot_product)
    is_scam = probability >= 0.50
    
    # Sub-categorization
    category = "LEGITIMATE"
    if is_scam:
        category = "OTHER_FINANCIAL_SCAM"
        best_score = 0
        categories_dict = model_data.get("categories", {})
        for cat, keywords in categories_dict.items():
            matches = sum(1 for kw in keywords if kw in cleaned)
            if matches > best_score:
                best_score = matches
                category = cat
                
        # Priority heuristics for high-severity keywords
        if "otp" in cleaned:
            category = "OTP_THEFT"
        elif "pin" in cleaned:
            category = "PIN_THEFT"
        elif "block" in cleaned or "suspended" in cleaned or "yono" in cleaned:
            category = "BANK_PHISHING"
        elif "kyc" in cleaned or "aadhaar" in cleaned or "pan" in cleaned:
            category = "KYC_SCAM"
        elif "won" in cleaned or "prize" in cleaned or "lottery" in cleaned:
            category = "PRIZE_SCAM"
        elif "loan" in cleaned:
            category = "LOAN_SCAM"
        elif "job" in cleaned or "earn" in cleaned:
            category = "JOB_SCAM"

    return {
        "text": text,
        "is_scam": is_scam,
        "category": category,
        "confidence": round(float(probability if is_scam else 1.0 - probability), 4)
    }

def run_evaluation():
    with open('ml/models/safepay_nlp_model.json', 'r', encoding='utf-8') as f:
        model_data = json.load(f)

    test_cases = [
        ("Your payment of ₹500 was successful.", False, "LEGITIMATE"),
        ("Rahul, please send me ₹500 for groceries. I'll return it tonight.", False, "LEGITIMATE"),
        ("Your UPI payment of ₹2,000 to Rahul Kumar was successful.", False, "LEGITIMATE"),
        ("Your bank account will be blocked today. Send ₹2,000 immediately to verify your account.", True, "BANK_PHISHING"),
        ("Share the OTP you received to complete your refund.", True, "OTP_THEFT"),
        ("Enter your 4-digit UPI PIN to receive ₹5,000 cashback directly in your bank account.", True, "PIN_THEFT"),
        ("Congratulations! You won ₹50,000. Send ₹500 processing fee to claim your prize.", True, "PRIZE_SCAM"),
        ("Earn ₹5,000 daily from home by liking YouTube videos. Pay ₹999 registration fee.", True, "JOB_SCAM"),
        ("Your KYC has expired today. Your bank account will be closed in 24 hours.", True, "KYC_SCAM"),
        ("Pre-approved instant personal loan of ₹5,00,000 at 1% interest. Pay ₹1,999 loan insurance fee.", True, "LOAN_SCAM"),
        ("Delhi Police Cyber Crime: An arrest warrant has been issued in your name. Pay ₹25,000 immediately.", True, "POLICE_IMPERSONATION")
    ]

    print("=== EVALUATION ON SECTIONS 15-19 & CANONICAL TEST BENCH ===")
    all_passed = True
    for text, expected_scam, expected_category in test_cases:
        res = predict(text, model_data)
        passed = (res["is_scam"] == expected_scam)
        status = "PASS" if passed else "FAIL"
        if not passed:
            all_passed = False
        print(f"[{status}] Expected Scam: {expected_scam} | Predicted: {res['is_scam']} (Conf: {res['confidence'] * 100:.1f}%) | Category: {res['category']}")
        print(f"       Message: \"{text[:75]}...\"")

    print("\nSummary:", "All canonical test cases passed!" if all_passed else "Some cases failed.")
    return all_passed

if __name__ == '__main__':
    run_evaluation()
