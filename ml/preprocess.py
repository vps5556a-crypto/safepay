import re
import unicodedata

def clean_text(text: str) -> str:
    """
    Cleans and normalizes text for NLP classification while preserving critical
    financial and security signals (₹, OTP, UPI, KYC, URLs).
    """
    if not isinstance(text, str):
        return ""
    
    # 1. Unicode NFKC normalization
    text = unicodedata.normalize('NFKC', text)
    
    # 2. Strip HTML tags if any
    text = re.sub(r'<[^>]+>', ' ', text)
    
    # 3. Currency normalization: standardize Rs., INR, Rs to ₹
    text = re.sub(r'\b(Rs\.?|INR)\s*', '₹', text, flags=re.IGNORECASE)
    
    # 4. URL detection & tokenization
    text = re.sub(r'https?://\S+|www\.\S+', ' http_url ', text, flags=re.IGNORECASE)
    
    # 5. Phone number masking / tokenization (Indian mobile 10-digit with optional +91)
    text = re.sub(r'(\+91[\-\s]?)?[6-9]\d{9}', ' phone_number ', text)
    
    # 6. Normalize UPI ID formats
    text = re.sub(r'[a-zA-Z0-9.\-_]+@[a-zA-Z]+', ' upi_id ', text)
    
    # 7. Normalize multiple whitespaces
    text = re.sub(r'\s+', ' ', text).strip()
    
    # 8. Lowercase
    return text.lower()

if __name__ == "__main__":
    sample = "Your SBI account will be blocked. Send Rs. 2000 to user@okhdfcbank or click http://sbi.co.in/verify"
    cleaned = clean_text(sample)
    print("Original:", sample)
    print("Cleaned: ", cleaned)
