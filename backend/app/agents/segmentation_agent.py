"""
Agent 3: Segmentation Agent
Filters the users table based on target persona criteria.
"""
import logging
from typing import List, Dict, Any
from app.schemas import StrategyOutput, SegmentationOutput
from app.utils.groq_client import call_llm_json

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a data-driven customer segmentation specialist for a BFSI company in India.
Given a target persona description and the EXACT list of profession values in the database, produce a segmentation filter plan.

Rules:
- profession_keywords must be substrings of the EXACT profession values listed below — choose keywords that will match relevant professions.
  Available professions: Architect, Business Owner, Chartered Accountant, Doctor, Farmer, Government Employee,
  HR Manager, Homemaker, IT Consultant, Investment Banker, Jeweller, Lawyer, Nurse, Professor, Software Engineer, Teacher.
  For "salaried professional" personas, map to: Software Engineer, IT Consultant, HR Manager, Teacher, Professor, Chartered Accountant, Lawyer, Doctor, Nurse, Government Employee, Architect.
  Use keywords that are actual parts of the profession names (e.g. "engineer", "consultant", "accountant").
- states: list only actual Indian state names like "Maharashtra", "Delhi", "Gujarat", etc. If no specific state is mentioned, return an empty list.
- income values must be ANNUAL INR (the DB stores annual income). Typical annual incomes range from ₹200,000 to ₹5,000,000.
- Be inclusive — avoid overly narrow filtering unless the persona explicitly demands it.
- Respond ONLY with valid JSON — no markdown, no extra text.

Required JSON format:
{
  "profession_keywords": ["<keyword1>", "<keyword2>"],
  "states": ["<state1>", "<state2>"],
  "min_income": <annual INR number or null>,
  "max_income": <annual INR number or null>,
  "min_credit_score": <number or null>,
  "max_credit_score": <number or null>,
  "reasoning": "<explanation of why these filters match the persona>"
}"""


def _parse_filters_from_llm(persona: str, available_professions: List[str]) -> Dict[str, Any]:
    """Use LLM to extract structured filter criteria from persona description."""
    user_prompt = f"""Target Persona:
\"\"\"{persona}\"\"\"

Available profession values in DB: {', '.join(available_professions)}

Extract segmentation filter criteria. Use actual substrings from the profession list above."""
    return call_llm_json(SYSTEM_PROMPT, user_prompt)


def run_segmentation_agent(
    strategy: StrategyOutput,
    all_users: List[Dict[str, Any]]
) -> SegmentationOutput:
    """
    Run the Segmentation Agent.

    Args:
        strategy: Output from the Strategy Agent containing target_persona.
        all_users: List of user dicts from the database.

    Returns:
        SegmentationOutput: Filter criteria, count, and reasoning.
    """
    logger.info(f"[SegmentationAgent] Segmenting {len(all_users)} users for persona: {strategy.target_persona[:80]}...")

    available_professions = sorted(set(u.get("profession", "") for u in all_users if u.get("profession")))
    filters = _parse_filters_from_llm(strategy.target_persona, available_professions)

    profession_keywords: List[str] = [k.lower() for k in filters.get("profession_keywords", [])]

    # Normalise states — discard catch-all phrases like "all indian states" or "all states"
    raw_states: List[str] = [s.lower() for s in filters.get("states", [])]
    states: List[str] = [
        s for s in raw_states
        if s not in ("all", "all states", "all indian states", "india", "pan india", "pan-india")
    ]

    min_income: float | None = filters.get("min_income")
    max_income: float | None = filters.get("max_income")

    # Guard against LLM returning monthly income figures instead of annual.
    # User incomes in the DB are annual INR. If max_income looks monthly (< 500,000)
    # multiply by 12 to convert to annual.
    if min_income is not None and min_income < 500_000:
        min_income = min_income * 12
    if max_income is not None and max_income < 500_000:
        max_income = max_income * 12
    min_credit: int | None = filters.get("min_credit_score")
    max_credit: int | None = filters.get("max_credit_score")
    reasoning: str = filters.get("reasoning", "")

    selected_ids: List[int] = []
    for user in all_users:
        # Profession filter
        if profession_keywords:
            prof = user.get("profession", "").lower()
            if not any(kw in prof for kw in profession_keywords):
                continue

        # State filter (if specified and non-empty)
        if states:
            user_state = user.get("state", "").lower()
            if not any(s in user_state for s in states):
                continue

        # Income filter
        income = user.get("income", 0)
        if min_income is not None and income < min_income:
            continue
        if max_income is not None and income > max_income:
            continue

        # Credit score filter
        credit = user.get("credit_score", 0)
        if min_credit is not None and credit < min_credit:
            continue
        if max_credit is not None and credit > max_credit:
            continue

        selected_ids.append(user["id"])

    # Build human-readable filter summary
    filter_parts = []
    if profession_keywords:
        filter_parts.append(f"Professions: {', '.join(profession_keywords)}")
    if states:
        filter_parts.append(f"States: {', '.join(states)}")
    if min_income or max_income:
        filter_parts.append(f"Income: ₹{min_income or 0:,.0f} – ₹{max_income or '∞'}")
    if min_credit or max_credit:
        filter_parts.append(f"Credit Score: {min_credit or 0} – {max_credit or 900}")
    filters_applied = "; ".join(filter_parts) if filter_parts else "All users (no restrictive filters)"

    logger.info(f"[SegmentationAgent] Selected {len(selected_ids)} users. Filters: {filters_applied}")

    return SegmentationOutput(
        filters_applied=filters_applied,
        selected_user_count=len(selected_ids),
        selected_user_ids=selected_ids,
        reasoning=reasoning,
    )
