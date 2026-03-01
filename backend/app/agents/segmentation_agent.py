"""
Agent 3: Segmentation Agent
Filters the customer cohort based on target persona criteria.
Works with the real InXiteOut customer cohort (City, Occupation, Monthly_Income * 12).
"""
import logging
from typing import List, Dict, Any
from app.schemas import StrategyOutput, SegmentationOutput
from app.utils.groq_client import call_llm_json

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a data-driven customer segmentation specialist for a BFSI company in India.
Given a target persona description and the EXACT list of occupation values in the cohort, produce a segmentation filter plan.

Rules:
- occupation_keywords must be substrings of the EXACT occupation values listed — choose keywords that will match relevant occupations.
  EXACT available occupations (use substrings of these): Accountant, Advocate, Bank Employee, Business Analyst,
  Consultant, Data Analyst, Designer, Doctor, Driver, Electrician, Engineer, Entrepreneur, Government Employee,
  HR Manager, Homemaker, IT Professional, Marketing Manager, Nurse, Operations Manager, Pharmacist, Plumber,
  Retail Associate, Sales Executive, Student, Teacher.
  For "salaried professional" personas, map to: engineer, it professional, consultant, accountant, doctor,
  nurse, teacher, hr manager, bank employee, business analyst, data analyst, marketing manager, operations manager.
  Use keywords that are actual substrings of the occupation names (e.g. "engineer" matches "Engineer").
- cities: IMPORTANT — use only the EXACT city spellings from the cohort:
  Bengaluru (NOT Bangalore), Mumbai, Delhi, Chennai, Hyderabad, Pune, Kolkata, Ahmedabad, Jaipur, Surat,
  Noida, Gurugram, Lucknow, Bhopal, Chandigarh, Coimbatore, Indore, Kochi, Nagpur, Visakhapatnam.
  NOTE: "Bangalore" in user objectives means "Bengaluru" in the cohort — always translate Bangalore → Bengaluru.
  If no specific city is mentioned, return an empty list (do NOT filter by city unless explicitly required).
- income values must be ANNUAL INR (the cohort stores monthly income, but the agent receives annual = monthly * 12).
  Typical annual incomes range from ₹200,000 to ₹5,000,000.
- require_app_installed: set to true ONLY when targeting digitally-active customers (e.g. for digital product campaigns,
  app-based offers). This filters to customers who have the bank app installed — typically higher engagement.
  Default false (do not restrict unnecessarily).
- require_social_media_active: set to true ONLY when targeting social-media savvy customers. Default false.
- Be inclusive — avoid overly narrow filtering unless the persona explicitly demands it.
- Respond ONLY with valid JSON — no markdown, no extra text.

Required JSON format:
{
  "occupation_keywords": ["<keyword1>", "<keyword2>"],
  "cities": ["<city1>", "<city2>"],
  "min_income": <annual INR number or null>,
  "max_income": <annual INR number or null>,
  "min_credit_score": <number or null>,
  "max_credit_score": <number or null>,
  "require_app_installed": <true or false>,
  "require_social_media_active": <true or false>,
  "reasoning": "<explanation of why these filters match the persona>"
}"""


def _parse_filters_from_llm(persona: str, available_occupations: List[str]) -> Dict[str, Any]:
    """Use LLM to extract structured filter criteria from persona description."""
    user_prompt = f"""Target Persona:
\"\"\"{persona}\"\"\"

Available occupation values in cohort: {', '.join(available_occupations)}

Extract segmentation filter criteria. Use actual substrings from the occupation list above."""
    return call_llm_json(SYSTEM_PROMPT, user_prompt)


def run_segmentation_agent(
    strategy: StrategyOutput,
    all_users: List[Dict[str, Any]]
) -> SegmentationOutput:
    """
    Run the Segmentation Agent.

    Args:
        strategy: Output from the Strategy Agent containing target_persona.
        all_users: List of user dicts from _cohort_to_agent_users() in campaign_service.
                   Fields: id (str "CUST0001"), name, email, state (City), profession (Occupation),
                           income (annual INR), credit_score, gender, age, marital_status, ...

    Returns:
        SegmentationOutput: Filter criteria, count, and reasoning.
    """
    logger.info(f"[SegmentationAgent] Segmenting {len(all_users)} users for persona: {strategy.target_persona[:80]}...")

    available_occupations = sorted(set(u.get("profession", "") for u in all_users if u.get("profession")))
    filters = _parse_filters_from_llm(strategy.target_persona, available_occupations)

    occupation_keywords: List[str] = [k.lower() for k in filters.get("occupation_keywords", [])]

    # Normalise cities — discard catch-all phrases and map common aliases
    CITY_ALIASES = {"bangalore": "bengaluru", "bombay": "mumbai", "calcutta": "kolkata", "madras": "chennai"}
    raw_cities: List[str] = [c.lower() for c in filters.get("cities", [])]
    cities: List[str] = [
        CITY_ALIASES.get(c, c)
        for c in raw_cities
        if c not in ("all", "all cities", "all indian cities", "india", "pan india", "pan-india",
                     "all states", "all indian states")
    ]

    min_income: float | None = filters.get("min_income")
    max_income: float | None = filters.get("max_income")

    # Guard against LLM returning monthly figures instead of annual.
    # Annual income in agent format = monthly * 12. Typical monthly salaries ≥ ₹20,000.
    # If max_income < 500,000 it's almost certainly a monthly figure — multiply by 12.
    if min_income is not None and min_income < 500_000:
        min_income = min_income * 12
    if max_income is not None and max_income < 500_000:
        max_income = max_income * 12

    min_credit: int | None = filters.get("min_credit_score")
    max_credit: int | None = filters.get("max_credit_score")
    require_app: bool = filters.get("require_app_installed", False)
    require_social: bool = filters.get("require_social_media_active", False)
    reasoning: str = filters.get("reasoning", "")

    selected_ids: List[str] = []
    for user in all_users:
        # Occupation filter
        if occupation_keywords:
            occ = user.get("profession", "").lower()
            if not any(kw in occ for kw in occupation_keywords):
                continue

        # City filter (if specified and non-empty)
        if cities:
            user_city = user.get("state", "").lower()  # 'state' key holds City in agent format
            if not any(c in user_city for c in cities):
                continue

        # Income filter (annual)
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

        # Engagement signal filters
        if require_app:
            if str(user.get("app_installed", "")).strip().upper() not in ("YES", "Y", "TRUE", "1"):
                continue
        if require_social:
            if str(user.get("social_media_active", "")).strip().upper() not in ("YES", "Y", "TRUE", "1"):
                continue

        selected_ids.append(str(user["id"]))  # always string e.g. "CUST0001"

    # Build human-readable filter summary
    filter_parts = []
    if occupation_keywords:
        filter_parts.append(f"Occupations: {', '.join(occupation_keywords)}")
    if cities:
        filter_parts.append(f"Cities: {', '.join(cities)}")
    if min_income or max_income:
        filter_parts.append(f"Income: ₹{min_income or 0:,.0f} – ₹{max_income or '∞'}")
    if min_credit or max_credit:
        filter_parts.append(f"Credit Score: {min_credit or 0} – {max_credit or 900}")
    if require_app:
        filter_parts.append("App Installed: Yes")
    if require_social:
        filter_parts.append("Social Media Active: Yes")
    filters_applied = "; ".join(filter_parts) if filter_parts else "All customers (no restrictive filters)"

    logger.info(f"[SegmentationAgent] Selected {len(selected_ids)} customers. Filters: {filters_applied}")

    return SegmentationOutput(
        filters_applied=filters_applied,
        selected_user_count=len(selected_ids),
        selected_user_ids=selected_ids,
        reasoning=reasoning,
    )
