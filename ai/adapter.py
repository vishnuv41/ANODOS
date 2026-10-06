"""
AI Module Entry point — Exposes unified model adapter factory.
"""

from ai.model.catboost_adapter import CatBoostAdapter
from ai.model.demo_adapter import DemoAdapter

_instance = None

def get_ai_adapter():
    global _instance
    if _instance is None:
        _instance = CatBoostAdapter()
    return _instance
