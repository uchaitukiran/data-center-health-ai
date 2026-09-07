"""
Enterprise GenAI Root Cause Analysis (RCA) Engine
Leverages Groq Llama-3.3-70B to synthesize telemetry anomalies and raw log lines
into actionable, plain-English incident triage cards for operations engineers.
"""

import json
import hashlib
from typing import Dict, Any, List, Optional
from pathlib import Path
from groq import Groq

from config.config import GROQ_API_KEY, GROQ_MODEL, LLM_CACHE_FILE
from config.logging_config import logger

class GroqRCAEngine:
    """
    High-throughput Root Cause Analyzer powered by Groq and Llama-3.3-70B.
    Features automated disk caching, schema validation, and fail-safe offline fallback.
    """

    def __init__(self, api_key: str = GROQ_API_KEY, model: str = GROQ_MODEL):
        self.api_key = api_key
        self.model = model
        self.client: Optional[Groq] = None
        self.cache: Dict[str, Any] = self._load_cache()

        if self.api_key and not self.api_key.startswith("your_"):
            try:
                self.client = Groq(api_key=self.api_key)
                logger.info(f"[GroqRCAEngine] Initialized client with model '{self.model}'")
            except Exception as e:
                logger.error(f"[GroqRCAEngine] Client initialization failed: {e}")
        else:
            logger.warning("[GroqRCAEngine] No valid GROQ_API_KEY configured. Fallback mode enabled.")

    def _load_cache(self) -> Dict[str, Any]:
        if LLM_CACHE_FILE.exists():
            try:
                with open(LLM_CACHE_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to read LLM cache: {e}")
        return {}

    def _save_cache(self):
        try:
            with open(LLM_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(self.cache, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to persist LLM cache: {e}")

    def _generate_cache_key(self, machine_id: str, severity: str, sensors: List[str], logs: List[str]) -> str:
        raw_str = f"{machine_id}:{severity}:{sorted(sensors)}:{logs[:3]}"
        return hashlib.md5(raw_str.encode("utf-8")).hexdigest()

    def analyze_incident(
        self,
        machine_id: str,
        risk_score: float,
        severity: str,
        anomalous_sensors: List[str],
        recent_log_snippets: List[str]
    ) -> Dict[str, Any]:
        """
        Synthesizes multimodal operations telemetry (time-series anomalies + system logs)
        into an actionable RCA diagnosis card.
        """
        cache_key = self._generate_cache_key(machine_id, severity, anomalous_sensors, recent_log_snippets)
        if cache_key in self.cache:
            logger.debug(f"[GroqRCAEngine] Cache hit for incident {cache_key}")
            return self.cache[cache_key]

        if not self.client:
            return self._heuristic_fallback(machine_id, risk_score, severity, anomalous_sensors, recent_log_snippets)

        prompt = f"""You are a Principal Site Reliability Engineer (SRE) and AIOps Diagnostic System for high-density enterprise data centers.
A severe telemetry anomaly has been detected on server node '{machine_id}'.

CURRENT INCIDENT CONTEXT:
- Node ID: {machine_id}
- Health Risk Score: {risk_score:.1f} / 100 ({severity} Level)
- Anomalous Drifting Sensors: {', '.join(anomalous_sensors) if anomalous_sensors else 'General system load drift'}
- Recent System Logs:
{chr(10).join(f'  [LOG] {l}' for l in recent_log_snippets[:5]) if recent_log_snippets else '  [LOG] No explicit error stacktrace captured; abnormal sensor drift detected.'}

TASK:
Diagnose the failure root cause, assess operational risk, and provide crisp triage recommendations.
Respond ONLY with a valid JSON object matching the following structure:
{{
  "root_cause_summary": "1-2 sentence direct explanation of what is failing and why",
  "probable_culprit": "Specific subsystem or process (e.g. JVM Garbage Collection Stall, PCIe bus error, SSD Write Saturation)",
  "impact_assessment": "Impact on services, data loss risk, or cascading cluster effects",
  "recommended_action": "Exact command or action for on-call engineer (e.g., 'Drain node traffic and restart daemon X')",
  "urgency": "Immediate | High | Medium"
}}"""

        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an automated AIOps diagnostic engine. Output JSON only."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            response_text = completion.choices[0].message.content
            result = json.loads(response_text)
            result["cached"] = False
            result["model"] = self.model
            
            # Cache the response
            self.cache[cache_key] = result
            self._save_cache()
            logger.info(f"[GroqRCAEngine] Successfully generated RCA diagnosis for {machine_id} ({result['probable_culprit']})")
            return result

        except Exception as e:
            logger.error(f"[GroqRCAEngine] Groq API call failed: {e}. Reverting to heuristic fallback.")
            return self._heuristic_fallback(machine_id, risk_score, severity, anomalous_sensors, recent_log_snippets)

    def _heuristic_fallback(
        self,
        machine_id: str,
        risk_score: float,
        severity: str,
        anomalous_sensors: List[str],
        recent_log_snippets: List[str]
    ) -> Dict[str, Any]:
        """Deterministic rule-based fallback when external API quota or network is constrained."""
        primary_sensor = anomalous_sensors[0] if anomalous_sensors else "System Load"
        return {
            "root_cause_summary": f"Abnormal deviation detected across {len(anomalous_sensors)} vital metrics on {machine_id}, primarily driven by {primary_sensor}.",
            "probable_culprit": f"Sensor threshold breach on {primary_sensor}",
            "impact_assessment": f"Potential throughput degradation or service stall if metric remains above {risk_score:.0f} risk threshold.",
            "recommended_action": f"Inspect active processes on {machine_id} and review syslog around failure timestamp.",
            "urgency": "Immediate" if risk_score >= 70 else "High",
            "cached": False,
            "fallback": True
        }

# Global singleton
rca_engine = GroqRCAEngine()
