import json
import sys
import os
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from evaluate import predict

def main():
    model_path = 'ml/models/safepay_nlp_model.json'
    if not os.path.exists(model_path):
        print(f"Error: Model file {model_path} not found. Run train.py first.")
        sys.exit(1)

    with open(model_path, 'r', encoding='utf-8') as f:
        model_data = json.load(f)

    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
    else:
        query = "Your bank account will be blocked today. Send ₹2,000 immediately."

    result = predict(query, model_data)
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
