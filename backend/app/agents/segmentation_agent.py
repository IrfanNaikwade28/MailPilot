"""
Agent 3: Segmentation Agent
============================
Filters the customer cohort based on target persona criteria.
Works with the real InXiteOut 1000-customer cohort.

Final round changes:
- Accepts exclude_ids: list of already-covered customer_ids to skip
- When exclude_ids covers all users matching filters, falls back to returning
  ALL remaining uncovered IDs (ensures we never produce an empty segment)
- When segment < 50 after filters, relaxes city filter then expands occupations
  to guarantee a usable segment size every time
"""
import logging
from typing import List, Dict, Any, Optional
from app.schemas import StrategyOutput, SegmentationOutput
from app.utils.groq_client import call_llm_json

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LIVE API occupations — exactly 25 values present in the final-round cohort
# ---------------------------------------------------------------------------
LIVE_OCCUPATIONS = [
    "Accountant",
    "Advocate",
    "Bank Employee",
    "Business Analyst",
    "Consultant",
    "Data Analyst",
    "Designer",
    "Doctor",
    "Driver",
    "Electrician",
    "Engineer",
    "Entrepreneur",
    "Government Employee",
    "HR Manager",
    "Homemaker",
    "IT Professional",
    "Marketing Manager",
    "Nurse",
    "Operations Manager",
    "Pharmacist",
    "Plumber",
    "Retail Associate",
    "Sales Executive",
    "Student",
    "Teacher",
]

SYSTEM_PROMPT = """You are a customer segmentation specialist for a BFSI company in India.
Given a target persona, produce a segmentation filter plan to select the RIGHT customers from the cohort.

CRITICAL RULES — READ CAREFULLY:
1. occupation_keywords must be substrings of EXACT occupation values in the cohort.
   EXACT available occupations (use ONLY these 25 values):
     Accountant, Advocate, Bank Employee, Business Analyst, Consultant, Data Analyst,
     Designer, Doctor, Driver, Electrician, Engineer, Entrepreneur, Government Employee,
     HR Manager, Homemaker, IT Professional, Marketing Manager, Nurse, Operations Manager,
     Pharmacist, Plumber, Retail Associate, Sales Executive, Student, Teacher.
   Use lowercase substrings: e.g. "engineer" matches "Engineer", "it professional" matches "IT Professional".
   Include ALL relevant occupations for the persona — be BROAD, not narrow.
   Do NOT invent occupations that are not in the list above.

2. cities: ONLY filter by city if the objective EXPLICITLY names a city. Otherwise return [].
   If filtering, use exact spellings: Bengaluru, Mumbai, Delhi, Chennai, Hyderabad, Pune, Kolkata,
   Ahmedabad, Jaipur, Bhopal, Lucknow, Chandigarh, Coimbatore, Indore, Kochi, Nagpur, Visakhapatnam.

3. income values are ANNUAL INR. Cohort annual income ranges from Rs 300,000 to Rs 3,000,000.
   Set min_income / max_income to null UNLESS the objective explicitly specifies an income band.
   DO NOT set income filters just because a persona sounds "high income" — leave them null.

4. require_app_installed and require_social_media_active: set to FALSE unless the objective
   EXPLICITLY says "app users only" or "social media active only". Do NOT set these true by default.

5. min_credit_score / max_credit_score: set to null unless explicitly required.

6. BE INCLUSIVE. The goal is to cover as many relevant customers as possible.
   A segment of 100-400 customers per campaign is ideal.

- Respond ONLY with valid JSON — no markdown, no extra text.

Required JSON format:
{
  "occupation_keywords": ["<keyword1>", "<keyword2>"],
  "cities": [],
  "min_income": null,
  "max_income": null,
  "min_credit_score": null,
  "max_credit_score": null,
  "require_app_installed": false,
  "require_social_media_active": false,
  "reasoning": "<explanation of filter choices>"
}"""


def _parse_filters_from_llm(persona: str, available_occupations: List[str]) -> Dict[str, Any]:
    """Use LLM to extract structured filter criteria from persona description."""
    user_prompt = f"""Target Persona:
\"\"\"{persona}\"\"\"

Available occupation values in cohort: {', '.join(available_occupations)}

Extract segmentation filter criteria. Use actual substrings from the occupation list above."""
    return call_llm_json(SYSTEM_PROMPT, user_prompt)


def _apply_filters(
    all_users: List[Dict[str, Any]],
    exclude_set: set,
    occupation_keywords: List[str],
    cities: List[str],
    min_income: Optional[float],
    max_income: Optional[float],
    min_credit: Optional[int],
    max_credit: Optional[int],
    require_app: bool,
    require_social: bool,
) -> List[str]:
    """
    Apply the given filter criteria to all_users, skipping excluded IDs.
    Returns list of matching customer_id strings.
    """
    selected: List[str] = []
    for user in all_users:
        uid = str(user["id"])
        if uid in exclude_set:
            continue
        if occupation_keywords:
            occ = user.get("profession", "").lower()
            if not any(kw in occ for kw in occupation_keywords):
                continue
        if cities:
            user_city = user.get("state", "").lower()
            if not any(c in user_city for c in cities):
                continue
        income = user.get("income", 0)
        if min_income is not None and income < min_income:
            continue
        if max_income is not None and income > max_income:
            continue
        credit = user.get("credit_score", 0)
        if min_credit is not None and credit < min_credit:
            continue
        if max_credit is not None and credit > max_credit:
            continue
        if require_app:
            if str(user.get("app_installed", "")).strip().upper() not in ("YES", "Y", "TRUE", "1"):
                continue
        if require_social:
            if str(user.get("social_media_active", "")).strip().upper() not in ("YES", "Y", "TRUE", "1"):
                continue
        selected.append(uid)
    return selected


def run_segmentation_agent(
    strategy: StrategyOutput,
    all_users: List[Dict[str, Any]],
    exclude_ids: Optional[List[str]] = None,
) -> SegmentationOutput:
    """
    Filter the customer cohort for the given strategy persona.

    Args:
        strategy: Output from the Strategy Agent.
        all_users: Full list of customer dicts (from cohort_service.cohort_to_agent_users).
        exclude_ids: Customer IDs already covered by previous campaigns.
                     These are excluded to prevent duplicate targeting.
                     If None or empty, no exclusion is applied.
    """
    exclude_set = set(exclude_ids or [])
    logger.info(
        f"[SegmentationAgent] Segmenting {len(all_users)} users "
        f"(excluding {len(exclude_set)} already-covered) "
        f"for persona: {strategy.target_persona[:80]}..."
    )

    available_occupations = sorted(set(u.get("profession", "") for u in all_users if u.get("profession")))
    filters = _parse_filters_from_llm(strategy.target_persona, available_occupations)

    occupation_keywords: List[str] = [k.lower() for k in filters.get("occupation_keywords", [])]

    CITY_ALIASES = {
        "bangalore": "bengaluru",
        "bombay": "mumbai",
        "calcutta": "kolkata",
        "madras": "chennai",
    }
    raw_cities: List[str] = [c.lower() for c in filters.get("cities", [])]
    cities: List[str] = [
        CITY_ALIASES.get(c, c)
        for c in raw_cities
        if c not in ("all", "all cities", "all indian cities", "india", "pan india", "pan-india",
                     "all states", "all indian states")
    ]

    min_income: Optional[float] = filters.get("min_income")
    max_income: Optional[float] = filters.get("max_income")
    min_credit: Optional[int] = filters.get("min_credit_score")
    max_credit: Optional[int] = filters.get("max_credit_score")
    require_app: bool = filters.get("require_app_installed", False)
    require_social: bool = filters.get("require_social_media_active", False)

    # ── Coverage-first override ────────────────────────────────────────────────
    # When less than 100% of the cohort is covered, relax all secondary filters.
    # Only occupation (and optionally city) filtering is retained — income, credit,
    # app, social filters shrink segments drastically and hurt full-cohort coverage.
    uncovered_count = len([u for u in all_users if str(u["id"]) not in exclude_set])
    total_count = len(all_users)
    coverage_pct = 1.0 - (uncovered_count / total_count) if total_count else 1.0
    if coverage_pct < 1.0:
        min_income = None
        max_income = None
        min_credit = None
        max_credit = None
        require_app = False
        require_social = False
        logger.info(
            f"[SegmentationAgent] Coverage-first mode ({coverage_pct:.0%} covered) — "
            "income/credit/app/social filters disabled to maximise segment size."
        )

    reasoning: str = filters.get("reasoning", "")

    # ── Apply filters ──────────────────────────────────────────────────────────
    selected_ids = _apply_filters(
        all_users, exclude_set,
        occupation_keywords, cities,
        min_income, max_income,
        min_credit, max_credit,
        require_app, require_social,
    )

    # ── Size fallback Stage 1: drop city filter if segment < 50 ───────────────
    MIN_SEGMENT_SIZE = 50
    if len(selected_ids) < MIN_SEGMENT_SIZE and cities:
        logger.warning(
            f"[SegmentationAgent] Segment too small ({len(selected_ids)}) with city filter "
            f"{cities} — retrying without city filter."
        )
        selected_ids = _apply_filters(
            all_users, exclude_set,
            occupation_keywords, [],            # drop city
            min_income, max_income,
            min_credit, max_credit,
            require_app, require_social,
        )
        cities = []  # reflect the relaxation in the filter summary
        if len(selected_ids) >= MIN_SEGMENT_SIZE:
            reasoning += " (City filter removed to meet minimum segment size.)"

    # ── Size fallback Stage 2: expand to adjacent occupations ─────────────────
    if len(selected_ids) < MIN_SEGMENT_SIZE and occupation_keywords:
        logger.warning(
            f"[SegmentationAgent] Segment still too small ({len(selected_ids)}) after dropping city — "
            "expanding to all live API occupations."
        )
        # Expand to ALL live occupations as lowercase keywords
        expanded_keywords = [occ.lower() for occ in LIVE_OCCUPATIONS]
        selected_ids = _apply_filters(
            all_users, exclude_set,
            expanded_keywords, [],
            None, None, None, None,
            False, False,
        )
        occupation_keywords = expanded_keywords
        reasoning += " (Occupation filter expanded to all available occupations to meet minimum segment size.)"

    # ── Fallback Stage 3: empty result → all remaining uncovered ──────────────
    if not selected_ids and exclude_set:
        logger.warning(
            "[SegmentationAgent] All fallbacks exhausted — "
            "targeting ALL remaining uncovered customers."
        )
        selected_ids = [str(u["id"]) for u in all_users if str(u["id"]) not in exclude_set]
        reasoning = (
            f"Fallback: no uncovered users matched the persona filters. "
            f"Targeting all {len(selected_ids)} remaining uncovered customers to ensure full coverage."
        )

    # ── Build filter summary ───────────────────────────────────────────────────
    filter_parts = []
    if occupation_keywords:
        filter_parts.append(f"Occupations: {', '.join(occupation_keywords)}")
    if cities:
        filter_parts.append(f"Cities: {', '.join(cities)}")
    if min_income or max_income:
        filter_parts.append(f"Income: Rs {min_income or 0:,.0f} - Rs {max_income or 'no limit'}")
    if min_credit or max_credit:
        filter_parts.append(f"Credit Score: {min_credit or 0} - {max_credit or 900}")
    if require_app:
        filter_parts.append("App Installed: Yes")
    if require_social:
        filter_parts.append("Social Media Active: Yes")
    if exclude_set:
        filter_parts.append(f"Excluded (already covered): {len(exclude_set)}")

    filters_applied = "; ".join(filter_parts) if filter_parts else "All uncovered customers (no restrictive filters)"

    # ── Structured SEGMENTATION RESULT log ────────────────────────────────────
    logger.info(
        f"[SegmentationAgent] SEGMENTATION RESULT | "
        f"segment_size={len(selected_ids)} | "
        f"occupations={occupation_keywords} | "
        f"filters_applied={filters_applied!r} | "
        f"excluded_ids_count={len(exclude_set)}"
    )

    return SegmentationOutput(
        filters_applied=filters_applied,
        selected_user_count=len(selected_ids),
        selected_user_ids=selected_ids,
        reasoning=reasoning,
    )
