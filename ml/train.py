import json
import os
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from preprocess import clean_text

os.makedirs('ml/models', exist_ok=True)

def train_and_export():
    # 1. Load Dataset
    data_path = 'ml/data/scam_dataset.json'
    with open(data_path, 'r', encoding='utf-8') as f:
        dataset = json.load(f)

    print(f"Loaded {len(dataset)} samples from {data_path}")

    texts = [clean_text(item['text']) for item in dataset]
    labels = [1 if item['label'] == 'scam' else 0 for item in dataset]
    categories = [item.get('category', 'OTHER_FINANCIAL_SCAM') for item in dataset]

    # 2. Train / Test Split (80% train, 20% test, stratified)
    X_train, X_test, y_train, y_test, cat_train, cat_test = train_test_split(
        texts, labels, categories, test_size=0.20, random_state=42, stratify=labels
    )

    print(f"Train size: {len(X_train)}, Test size: {len(X_test)}")

    # 3. TF-IDF Vectorization with unigrams & bigrams
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=1,
        max_features=1500,
        sublinear_tf=True
    )
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    # 4. Train Logistic Regression Classifier
    # High regularization parameter C=5.0 to ensure strong signal response
    clf = LogisticRegression(C=5.0, max_iter=1000, class_weight='balanced', random_state=42)
    clf.fit(X_train_vec, y_train)

    # 5. Evaluate on Test Set
    y_pred = clf.predict(X_test_vec)
    y_prob = clf.predict_proba(X_test_vec)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    cm = confusion_matrix(y_test, y_pred).tolist()

    # Calculate False Positive Rate on legitimate messages: FP / (FP + TN)
    tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    scam_recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0

    metrics = {
        "model_version": "safepay-nlp-v1.0",
        "dataset_samples": len(dataset),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "accuracy": round(float(acc), 4),
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "scam_recall": round(float(scam_recall), 4),
        "f1_score": round(float(f1), 4),
        "false_positive_rate": round(float(fpr), 4),
        "confusion_matrix": {
            "true_negatives_legit": int(tn),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_positives_scam": int(tp)
        }
    }

    print("\n================ MODEL EVALUATION METRICS ================")
    print(f"Accuracy:            {metrics['accuracy'] * 100:.2f}%")
    print(f"Precision:           {metrics['precision'] * 100:.2f}%")
    print(f"Recall (Overall):    {metrics['recall'] * 100:.2f}%")
    print(f"Scam Recall:         {metrics['scam_recall'] * 100:.2f}%")
    print(f"F1-Score:            {metrics['f1_score'] * 100:.2f}%")
    print(f"False Positive Rate: {metrics['false_positive_rate'] * 100:.2f}%")
    print(f"Confusion Matrix:    TN={tn}, FP={fp}, FN={fn}, TP={tp}")
    print("=========================================================\n")

    # 6. Build Category Keyword Signatures for Sub-Categorization
    category_signatures = {}
    for item in dataset:
        cat = item.get("category", "OTHER_FINANCIAL_SCAM")
        if cat == "LEGITIMATE":
            continue
        if cat not in category_signatures:
            category_signatures[cat] = set()
        words = clean_text(item["text"]).split()
        for w in words:
            if len(w) > 3:
                category_signatures[cat].add(w)

    # Convert sets to list of top characteristic words per category
    serialized_categories = {k: list(v)[:25] for k, v in category_signatures.items()}

    # 7. Export Model to Portable JSON for 0ms Native Local Inference
    vocabulary = {word: int(idx) for word, idx in vectorizer.vocabulary_.items()}
    idf_weights = [float(x) for x in vectorizer.idf_]
    coef = [float(x) for x in clf.coef_[0]]
    intercept = float(clf.intercept_[0])

    model_export = {
        "model": "safepay-nlp-v1.0",
        "algorithm": "TF-IDF + Logistic Regression",
        "ngram_range": [1, 2],
        "vocabulary_size": len(vocabulary),
        "vocabulary": vocabulary,
        "idf": idf_weights,
        "coefficients": coef,
        "intercept": intercept,
        "categories": serialized_categories,
        "metrics": metrics
    }

    with open('ml/models/safepay_nlp_model.json', 'w', encoding='utf-8') as f:
        json.dump(model_export, f, indent=2, ensure_ascii=False)

    with open('ml/models/metrics.json', 'w', encoding='utf-8') as f:
        json.dump(metrics, f, indent=2)

    # Also copy to backend/data/ for direct Node.js runtime loading
    os.makedirs('backend/data', exist_ok=True)
    with open('backend/data/safepay_nlp_model.json', 'w', encoding='utf-8') as f:
        json.dump(model_export, f, indent=2, ensure_ascii=False)

    print("Successfully exported model to:")
    print("  - ml/models/safepay_nlp_model.json")
    print("  - backend/data/safepay_nlp_model.json")
    print("  - ml/models/metrics.json")

if __name__ == '__main__':
    train_and_export()
