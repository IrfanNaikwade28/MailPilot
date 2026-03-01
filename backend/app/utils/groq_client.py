"""
Groq API client utility.
Provides a shared Groq client instance and helper for structured JSON responses.
"""
import json
import logging
import re
from typing import Any, Dict

from groq import Groq
from app.config import settings

logger = logging.getLogger(__name__)

_client: Groq | None = None


def get_groq_client() -> Groq:
    """Return a singleton Groq client."""
    global _client
    if _client is None:
        _client = Groq(api_key=settings.GROQ_API_KEY)
    return _client


def call_llm(system_prompt: str, user_prompt: str, temperature: float = 0.3) -> str:
    """
    Call Groq LLM and return raw text response.
    """
    client = get_groq_client()
    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
        max_tokens=2048,
    )
    return response.choices[0].message.content.strip()


def call_llm_json(system_prompt: str, user_prompt: str, temperature: float = 0.2) -> Dict[str, Any]:
    """
    Call Groq LLM expecting a JSON response.
    Strips markdown code fences if present, then parses JSON.
    Raises ValueError if JSON cannot be parsed.
    """
    raw = call_llm(system_prompt, user_prompt, temperature)

    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}\nRaw response:\n{raw}")
        raise ValueError(f"LLM did not return valid JSON. Error: {e}\nRaw: {raw[:500]}")
