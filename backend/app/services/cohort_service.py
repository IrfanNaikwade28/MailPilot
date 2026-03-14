"""
Cohort Service
==============
Manages the 1000-customer cohort for the final round of CampaignX hackathon.

Responsibilities:
- Fetch fresh cohort from InXiteOut get_customer_cohort API
- Cache cohort in memory for the process lifetime
- Expose mapped user dicts for the segmentation agent
- Allow force-refresh (call at window open: 9 March 11:59 PM IST)
"""
import logging
from typing import List, Dict, Any, Optional

from app.utils.inxiteout_api import get_customer_cohort as _api_get_cohort

logger = logging.getLogger(__name__)

# ── In-memory cache (reset on process restart or explicit refresh) ─────────────
_cohort_cache: Optional[List[Dict[str, Any]]] = None  # raw API rows
_agent_users_cache: Optional[List[Dict[str, Any]]] = None  # mapped for agents


def fetch_customer_cohort() -> List[Dict[str, Any]]:
    """
    Fetch the raw cohort from the CampaignX API (no cache).
    Returns list of raw customer dicts as returned by the API.
    """
    logger.info("[CohortService] Fetching fresh cohort from CampaignX API...")
    data = _api_get_cohort()
    logger.info(f"[CohortService] Fetched {len(data)} customers from API.")
    return data


def refresh_customer_cohort() -> int:
    """
    Force-refresh both caches from the live API.
    Call this at window open (9 March 11:59 PM IST) to get the new 1000-customer cohort.
    Returns the cohort size.
    """
    global _cohort_cache, _agent_users_cache
    _cohort_cache = None
    _agent_users_cache = None
    cohort = get_customer_cohort_cached()
    return len(cohort)


def get_customer_cohort_cached() -> List[Dict[str, Any]]:
    """
    Return the raw cohort (cached). Fetches from API on first call.
    Returns list of raw customer dicts.
    """
    global _cohort_cache
    if _cohort_cache is None:
        _cohort_cache = fetch_customer_cohort()
    return _cohort_cache


def get_all_cohort_ids() -> List[str]:
    """Return all customer_id strings in the current cohort."""
    cohort = get_customer_cohort_cached()
    return [c["customer_id"] for c in cohort if c.get("customer_id")]


def cohort_to_agent_users(cohort: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    """
    Map raw InXiteOut cohort fields to the format expected by the segmentation agent.

    InXiteOut fields  → agent fields
    customer_id       → id
    Full_name         → name
    email             → email
    City              → state
    Occupation        → profession
    Monthly_Income*12 → income  (annual)
    Credit score      → credit_score
    Gender            → gender
    Age               → age
    Marital_Status    → marital_status
    KYC status        → kyc_status
    Existing Customer → existing_customer
    App_Installed     → app_installed
    Social_Media_Active → social_media_active
    """
    global _agent_users_cache
    if cohort is None:
        if _agent_users_cache is not None:
            return _agent_users_cache
        cohort = get_customer_cohort_cached()

    users = []
    for c in cohort:
        users.append({
            "id": c.get("customer_id", ""),
            "name": c.get("Full_name", ""),
            "email": c.get("email", ""),
            "state": c.get("City", ""),
            "profession": c.get("Occupation", ""),
            "income": (c.get("Monthly_Income") or 0) * 12,
            "credit_score": c.get("Credit score") or c.get("credit_score") or 0,
            "gender": c.get("Gender", ""),
            "age": c.get("Age", 0),
            "marital_status": c.get("Marital_Status", ""),
            "kyc_status": c.get("KYC status", ""),
            "existing_customer": c.get("Existing Customer", ""),
            "app_installed": c.get("App_Installed", ""),
            "social_media_active": c.get("Social_Media_Active", ""),
        })

    if _agent_users_cache is None:
        _agent_users_cache = users
    return users
