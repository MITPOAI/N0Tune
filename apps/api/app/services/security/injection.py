"""Gateway compatibility wrapper for N0Tune Core prompt-injection scanning."""

from n0tune_core.security import RISK_PHRASES, InjectionRisk, analyze_injection_risk

__all__ = ["InjectionRisk", "RISK_PHRASES", "analyze_injection_risk"]
