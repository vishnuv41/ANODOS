"""
Demo AI Adapter — Rule & Heuristic Based Fallback Model.
Used when CatBoost model file (fault_model.cbm) is absent.
"""

from typing import Dict, Any

class DemoAdapter:
    def __init__(self):
        self.name = "DemoRuleAdapter"

    def predict(self, telemetry: Dict[str, float]) -> Dict[str, Any]:
        temp = telemetry.get("motor_temperature", 65.0)
        current = telemetry.get("motor_current", 8.4)
        vibration = telemetry.get("vibration", 1.8)
        brake_force = telemetry.get("brake_force", 92.0)
        door_cycles = telemetry.get("door_cycles", 40.0)

        risk_score = 0.15
        affected = "motor"
        category = "Normal Operation"

        if temp >= 85.0:
            risk_score = 0.88 if temp >= 100 else 0.65
            affected = "motor"
            category = "Motor Overheating"
        elif brake_force < 70.0:
            risk_score = 0.92 if brake_force < 50 else 0.70
            affected = "brake"
            category = "Brake Wear / Degradation"
        elif door_cycles >= 180.0:
            risk_score = 0.58
            affected = "door"
            category = "Door Operator Strain"
        elif vibration >= 5.0:
            risk_score = 0.62
            affected = "bearing"
            category = "Bearing Raceway Stress"

        severity = "High" if risk_score >= 0.7 else ("Moderate" if risk_score >= 0.4 else "Low")
        fault_state = "fault" if risk_score >= 0.8 else ("high_risk" if risk_score >= 0.55 else ("warning" if risk_score >= 0.3 else "normal"))

        return {
            "risk_score": round(risk_score, 4),
            "fault_state": fault_state,
            "fault_category": category,
            "fault_severity": severity,
            "affected_component": affected,
            "model_version": "demo-v1.0"
        }
