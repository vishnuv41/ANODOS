"""
ANODOS Expanded System Integration & Robustness Test Suite.
Tests API Endpoints, Ingestion Validation, WebSocket Lifecycle, AI Adapter, Fleet API, RUL, and Maintenance Engine.
"""

import sys
import os
import unittest
from fastapi.testclient import TestClient

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.main import app
from ai.adapter import get_ai_adapter

class ComprehensiveIntegrationTestCase(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")

    def test_health_api_alias(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")

    def test_ai_adapter_predictions(self):
        adapter = get_ai_adapter()
        telemetry = {"motor_temperature": 90.0, "vibration": 2.1}
        prediction = adapter.predict(telemetry)
        self.assertIn("risk_score", prediction)
        self.assertIn("fault_state", prediction)
        self.assertIn("affected_component", prediction)
        self.assertIn("explanations", prediction)
        self.assertTrue(len(prediction["explanations"]) > 0)

    def test_simulate_endpoint_valid(self):
        payload = {
            "elevator_id": "E001",
            "mode": "simulation",
            "controls": {"motor_temperature": 105.0}
        }
        response = self.client.post("/api/elevator/E001/simulate", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["elevator_id"], "E001")
        self.assertGreaterEqual(data["prediction"]["risk_score"], 0.4)

    def test_telemetry_ingestion_boundary_values(self):
        payload = {"motor_temperature": 140.0, "vibration": 12.0, "brake_force": 0.0}
        response = self.client.post("/api/elevator/E001/telemetry", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["ok"])
        self.assertEqual(data["components"]["motor"], "fault")

    def test_telemetry_ingestion_missing_fields(self):
        # Missing fields should fall back gracefully to baselines
        payload = {"motor_temperature": 70.0}
        response = self.client.post("/api/elevator/E001/telemetry", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["ok"])

    def test_fleet_status_api(self):
        response = self.client.get("/api/fleet/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["fleet_count"], 5)
        self.assertIn("E001", data["elevators"])
        self.assertIn("E005", data["elevators"])

    def test_rul_endpoint(self):
        response = self.client.get("/api/elevator/E001/rul")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("estimated_rul_simulation_units", data)
        self.assertIn("simulation units", data["unit"])

    def test_history_endpoint(self):
        response = self.client.get("/api/elevator/E001/history?points=5")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["history"]), 5)

    def test_maintenance_insight(self):
        response = self.client.get("/api/elevator/E001/maintenance")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("maintenance_priority", data)
        self.assertIn("recommended_action", data)

    def test_websocket_connect_and_subscribe(self):
        with self.client.websocket_connect("/ws/elevator/E001") as websocket:
            # Initial state frame
            data = websocket.receive_json()
            self.assertEqual(data["type"], "component_state_update")
            self.assertEqual(data["elevator_id"], "E001")

            # Ping/Pong test
            websocket.send_json({"type": "ping"})
            pong = websocket.receive_json()
            self.assertEqual(pong["type"], "pong")

if __name__ == "__main__":
    unittest.main()
