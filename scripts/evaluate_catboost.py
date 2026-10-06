"""
ANODOS CatBoost Model Evaluation & Metrics Script.
Performs 80/20 Train/Test split on unseen test data to prevent data leakage.
Computes Accuracy, Precision, Recall, F1-Score, Confusion Matrix, and saves model_metrics.json.
"""

import os
import json
import pandas as pd
import numpy as np
from catboost import CatBoostClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, precision_recall_fscore_support, confusion_matrix

DATASET_PATH_PRIMARY = os.path.join(os.path.dirname(__file__), "..", "data", "ANODOS_MASTER_DATASET.csv")
DATASET_PATH_1M = os.path.join(os.path.dirname(__file__), "..", "data", "ANODOS_MASTER_DATASET_1M_72COL.csv")

DATASET_PATH = DATASET_PATH_PRIMARY if os.path.exists(DATASET_PATH_PRIMARY) else DATASET_PATH_1M

MODEL_OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "ai", "model", "fault_model.cbm")
METRICS_OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "ai", "model", "model_metrics.json")

def add_engineered_features(df_features: pd.DataFrame) -> pd.DataFrame:
    X = df_features.copy()
    X['thermal_current_ratio'] = X['motor_temperature'] / (X['motor_current'] + 1.0)
    X['vibration_speed_index'] = X['vibration'] * X['speed']
    X['door_wear_factor'] = (X['door_cycles'] / 1000.0) * X['operating_hours']
    X['thermal_braking_load'] = X['motor_temperature'] / (X['brake_force'] + 1.0)
    X['current_load_ratio'] = X['motor_current'] / (X['load'] + 1.0)
    return X

def evaluate():
    print(f"Loading dataset from {DATASET_PATH}...")
    df = pd.read_csv(DATASET_PATH, low_memory=False)
    print(f"Dataset loaded: {df.shape[0]} rows, {df.shape[1]} columns.")

    brake_col = "Brake_Force" if "Brake_Force" in df.columns else ("Braking_Force" if "Braking_Force" in df.columns else "Brake_Force")
    hours_col = "Days_Since_Maintenance" if "Days_Since_Maintenance" in df.columns else ("Last_Serviced_Days_Ago" if "Last_Serviced_Days_Ago" in df.columns else "Days_Since_Maintenance")

    feature_cols = [
        "Load", "Speed", "Vibration_Level", "Motor_Current", 
        "Motor_Temperature", "Door_Cycles", brake_col, hours_col
    ]

    def map_fault(val):
        v = str(val).strip().lower()
        if v in ('1', '1.0', 'fault', 'warning', 'high_risk'):
            return 1
        return 0

    df['Target_Fault'] = df['Fault_State'].apply(map_fault)

    X_base = df[feature_cols].copy()
    X_base.columns = ["load", "speed", "vibration", "motor_current", "motor_temperature", "door_cycles", "brake_force", "operating_hours"]
    for col in X_base.columns:
        X_base[col] = pd.to_numeric(X_base[col], errors='coerce').fillna(X_base[col].median())

    X = add_engineered_features(X_base)
    y = df['Target_Fault']

    # Strict 80/20 Train/Test split to prevent data leakage
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42, stratify=y)
    print(f"Split complete: {len(X_train)} training samples, {len(X_test)} unseen test samples.")

    model = CatBoostClassifier(
        iterations=1000,
        learning_rate=0.04,
        depth=8,
        l2_leaf_reg=5.0,
        border_count=128,
        auto_class_weights='Balanced',
        verbose=100,
        random_seed=42
    )

    print("Training CatBoost model...")
    model.fit(X_train, y_train, eval_set=(X_test, y_test), early_stopping_rounds=40)

    # Evaluate on unseen test data
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)

    acc = float(accuracy_score(y_test, y_pred))
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='weighted')
    macro_precision, macro_recall, macro_f1, _ = precision_recall_fscore_support(y_test, y_pred, average='macro')
    cm = confusion_matrix(y_test, y_pred).tolist()

    # Per-class metrics
    class_report = classification_report(y_test, y_pred, output_dict=True)

    metrics_payload = {
        "model": "CatBoostClassifier",
        "version": "ANODOS-v2.0-Optimized",
        "total_samples": len(df),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "accuracy": round(acc, 4),
        "weighted_precision": round(float(precision), 4),
        "weighted_recall": round(float(recall), 4),
        "weighted_f1": round(float(f1), 4),
        "macro_f1": round(float(macro_f1), 4),
        "confusion_matrix": cm,
        "feature_names": list(X.columns),
        "feature_importances": [round(float(val), 4) for val in model.get_feature_importance()],
        "class_report": class_report
    }

    os.makedirs(os.path.dirname(MODEL_OUTPUT_PATH), exist_ok=True)
    model.save_model(MODEL_OUTPUT_PATH)
    print(f"Saved trained model to {MODEL_OUTPUT_PATH}")

    with open(METRICS_OUTPUT_PATH, "w") as f:
        json.dump(metrics_payload, f, indent=2)
    print(f"Saved metrics report to {METRICS_OUTPUT_PATH}")

    print("\n--- EVALUATION SUMMARY ON UNSEEN TEST DATA ---")
    print(f"Accuracy: {acc * 100:.2f}%")
    print(f"Weighted F1: {f1 * 100:.2f}%")
    print(f"Macro F1: {macro_f1 * 100:.2f}%")

if __name__ == "__main__":
    evaluate()
