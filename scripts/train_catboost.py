"""
Reproducible 8-Feature CatBoost Model Training & Evaluation Pipeline.
Dataset: ANODOS_MASTER_DATASET_1M_72COL.csv (1,000,000 samples)
Split: 70% Train (700,000), 15% Validation (150,000), 15% Held-out Test (150,000)

Exact 8 CatBoost Input Features:
1. load (kg)
2. speed (m/s)
3. vibration (mm/s)
4. motor_current (A)
5. motor_temperature (°C)
6. door_cycles (cycles)
7. brake_force (kN)
8. operating_hours (hours)
"""

import os
import json
import pandas as pd
import numpy as np
from catboost import CatBoostClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix, classification_report

DATASET_PATH_PRIMARY = os.path.join(os.path.dirname(__file__), "..", "data", "ANODOS_MASTER_DATASET_1M_72COL.csv")
DATASET_PATH_SECONDARY = os.path.join(os.path.dirname(__file__), "..", "data", "ANODOS_MASTER_DATASET.csv")

DATASET_PATH = DATASET_PATH_PRIMARY if os.path.exists(DATASET_PATH_PRIMARY) else DATASET_PATH_SECONDARY

MODEL_OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "ai", "model", "fault_model.cbm")
METRICS_OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "ai", "model", "model_metrics.json")

FEATURE_CONTRACT = [
    "load",
    "speed",
    "vibration",
    "motor_current",
    "motor_temperature",
    "door_cycles",
    "brake_force",
    "operating_hours"
]

def load_and_preprocess_dataset():
    print(f"Loading full dataset from {DATASET_PATH}...")
    df = pd.read_csv(DATASET_PATH, low_memory=False)
    print(f"Dataset loaded successfully: {df.shape[0]} rows, {df.shape[1]} columns.")

    # Determine braking force & operating hours column mappings without mapping maintenance days to operating hours
    brake_col = "Braking_Force" if "Braking_Force" in df.columns else "Brake_Force"
    hours_col = "Component_Age" if "Component_Age" in df.columns else ("Operating_Hours" if "Operating_Hours" in df.columns else None)

    feature_col_map = {
        "Load": "load",
        "Speed": "speed",
        "Vibration_Level": "vibration",
        "Motor_Current": "motor_current",
        "Motor_Temperature": "motor_temperature",
        "Door_Cycles": "door_cycles",
        brake_col: "brake_force",
    }
    if hours_col:
        feature_col_map[hours_col] = "operating_hours"

    X = pd.DataFrame()
    for raw_col, clean_name in feature_col_map.items():
        X[clean_name] = pd.to_numeric(df[raw_col], errors='coerce').fillna(df[raw_col].median())

    if "operating_hours" not in X.columns:
        # If component age column is absent, fallback to 0.0 without substituting Days_Since_Maintenance
        X["operating_hours"] = 0.0

    # Reorder columns to strictly match feature contract
    X = X[FEATURE_CONTRACT]

    # Target Mapping: 0 = Normal, 1 = Fault
    def map_target(val):
        v = str(val).strip().lower()
        if v in ('1', '1.0', 'fault'):
            return 1
        return 0

    y = df['Fault_State'].apply(map_target)

    return X, y

def train_and_evaluate():
    X, y = load_and_preprocess_dataset()

    print("\n--- DATASET CLASS DISTRIBUTION ---")
    print(y.value_counts())

    # Strict Reproducible 70% Train, 15% Validation, 15% Held-Out Test Split
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.30, random_state=42, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp
    )

    print(f"\nData Splits:")
    print(f"  Training Set:   {len(X_train)} samples (70%)")
    print(f"  Validation Set: {len(X_val)} samples (15%)")
    print(f"  Held-Out Test:  {len(X_test)} samples (15%)")

    model = CatBoostClassifier(
        iterations=800,
        learning_rate=0.05,
        depth=6,
        auto_class_weights='Balanced',
        verbose=200,
        random_seed=42
    )

    print("\nTraining CatBoost Model...")
    model.fit(
        X_train, y_train,
        eval_set=(X_val, y_val),
        early_stopping_rounds=40
    )

    # Save model binary
    os.makedirs(os.path.dirname(MODEL_OUTPUT_PATH), exist_ok=True)
    model.save_model(MODEL_OUTPUT_PATH)
    print(f"\nSaved trained model binary to: {MODEL_OUTPUT_PATH}")

    # Evaluate strictly on held-out test set
    y_pred = model.predict(X_test)
    acc = float(accuracy_score(y_test, y_pred))
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='weighted')
    macro_precision, macro_recall, macro_f1, _ = precision_recall_fscore_support(y_test, y_pred, average='macro')
    cm = confusion_matrix(y_test, y_pred).tolist()
    class_report = classification_report(y_test, y_pred, output_dict=True)

    metrics_payload = {
        "model": "CatBoostClassifier",
        "version": "ANODOS-v3.0-Strict8Feature",
        "total_samples": len(X),
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "test_samples": len(X_test),
        "accuracy": round(acc, 4),
        "weighted_precision": round(float(precision), 4),
        "weighted_recall": round(float(recall), 4),
        "weighted_f1": round(float(f1), 4),
        "macro_f1": round(float(macro_f1), 4),
        "confusion_matrix": cm,
        "feature_names": FEATURE_CONTRACT,
        "feature_importances": [round(float(v), 4) for v in model.get_feature_importance()],
        "class_report": class_report
    }

    with open(METRICS_OUTPUT_PATH, "w") as f:
        json.dump(metrics_payload, f, indent=2)
    print(f"Saved metrics report to: {METRICS_OUTPUT_PATH}")

    print("\n================ HELD-OUT TEST METRICS ================")
    print(f"Held-Out Test Samples: {len(X_test)}")
    print(f"Accuracy:            {acc * 100:.2f}%")
    print(f"Weighted Precision:  {precision * 100:.2f}%")
    print(f"Weighted Recall:     {recall * 100:.2f}%")
    print(f"Weighted F1-Score:   {f1 * 100:.2f}%")
    print("\nConfusion Matrix:")
    print(np.array(cm))
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['Normal (0)', 'Fault (1)']))

if __name__ == "__main__":
    train_and_evaluate()
