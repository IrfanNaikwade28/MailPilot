"""
Customer Data Service
=====================
Abstracts the data source used by the segmentation agent.

Supports two modes:
- "api"  : fetch customers from the CampaignX cohort (default, existing behaviour)
- "csv"  : read customers from an uploaded CSV file

Settings are persisted in backend/data/settings.json.
Uploaded CSV is stored at backend/data/uploaded_dataset.csv.
"""
import csv
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.cohort_service import cohort_to_agent_users

logger = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────────
_DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
_SETTINGS_FILE = _DATA_DIR / "settings.json"
_CSV_FILE = _DATA_DIR / "uploaded_dataset.csv"

# ── Column alias maps ──────────────────────────────────────────────────────────
# Maps standard field → list of accepted CSV header aliases (case-insensitive)
_COLUMN_ALIASES: Dict[str, List[str]] = {
    "customer_id": ["customer_id", "customerid", "id", "user_id"],
    "name":        ["name", "full_name", "fullname", "full name"],
    "email":       ["email", "email_address", "emailaddress"],
    "occupation":  ["occupation", "job", "profession", "role"],
    "city":        ["city", "location", "state", "region"],
    "age":         ["age"],
    "income":      ["income", "salary", "monthly_income", "annual_income"],
    "credit_score":["credit_score", "creditscore", "credit score"],
    "gender":      ["gender", "sex"],
    "marital_status": ["marital_status", "marital status", "maritalstatus"],
    "kyc_status":  ["kyc_status", "kyc status", "kyc"],
    "existing_customer": ["existing_customer", "existing customer", "existingcustomer"],
    "app_installed":     ["app_installed", "app installed", "appinstalled"],
    "social_media_active": ["social_media_active", "social media active", "socialmediaactive"],
}


def _default_settings() -> Dict[str, Any]:
    return {
        "data_source": "api",
        "api_key": "",
        "base_url": "",
        "csv_uploaded": False,
    }


def get_data_source_settings() -> Dict[str, Any]:
    """Read current settings from settings.json. Returns defaults if file missing."""
    try:
        if _SETTINGS_FILE.exists():
            with open(_SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Merge with defaults to handle missing keys
            defaults = _default_settings()
            defaults.update(data)
            # Always reflect actual CSV presence
            defaults["csv_uploaded"] = _CSV_FILE.exists()
            return defaults
    except Exception as e:
        logger.warning(f"[CustomerDataService] Could not read settings.json: {e}")
    return _default_settings()


def save_data_source_settings(
    data_source: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Persist data source settings to settings.json.
    data_source must be "api" or "csv".
    """
    if data_source not in ("api", "csv"):
        raise ValueError("data_source must be 'api' or 'csv'")

    current = get_data_source_settings()
    current["data_source"] = data_source
    if api_key is not None:
        current["api_key"] = api_key
    if base_url is not None:
        current["base_url"] = base_url
    current["csv_uploaded"] = _CSV_FILE.exists()

    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(_SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)

    logger.info(f"[CustomerDataService] Settings saved: data_source={data_source}")
    return current


def _resolve_column(headers_lower: Dict[str, str], field: str) -> Optional[str]:
    """
    Given a mapping of lowercase_header → original_header, return the original
    header name that matches one of the aliases for `field`, or None.
    """
    for alias in _COLUMN_ALIASES.get(field, []):
        if alias.lower() in headers_lower:
            return headers_lower[alias.lower()]
    return None


def _normalize_csv_row(row: Dict[str, str], col_map: Dict[str, Optional[str]], idx: int) -> Dict[str, Any]:
    """
    Convert a raw CSV row (using original column names) into the agent user dict format.
    Missing columns get sensible defaults.
    """
    def get(field: str, default: Any = "") -> Any:
        col = col_map.get(field)
        return row.get(col, default) if col else default

    # Build a unique ID if not present
    raw_id = get("customer_id") or f"csv_{idx}"

    # Income: if column is monthly, multiply by 12; heuristic: if < 50000, treat as monthly
    raw_income = get("income", 0)
    try:
        income_val = float(str(raw_income).replace(",", "")) if raw_income else 0
        if 0 < income_val < 50000:
            income_val = income_val * 12  # assume monthly
    except (ValueError, TypeError):
        income_val = 0

    try:
        age_val = int(float(str(get("age", 0)).replace(",", ""))) if get("age") else 0
    except (ValueError, TypeError):
        age_val = 0

    try:
        credit_val = float(str(get("credit_score", 700)).replace(",", "")) if get("credit_score") else 700
    except (ValueError, TypeError):
        credit_val = 700

    return {
        "id": str(raw_id).strip(),
        "name": str(get("name", f"Customer {idx}")).strip(),
        "email": str(get("email", "")).strip(),
        "state": str(get("city", "")).strip(),
        "profession": str(get("occupation", "")).strip(),
        "income": income_val,
        "credit_score": credit_val,
        "gender": str(get("gender", "")).strip(),
        "age": age_val,
        "marital_status": str(get("marital_status", "")).strip(),
        "kyc_status": str(get("kyc_status", "")).strip(),
        "existing_customer": str(get("existing_customer", "")).strip(),
        "app_installed": str(get("app_installed", "")).strip(),
        "social_media_active": str(get("social_media_active", "")).strip(),
    }


def _read_csv_users() -> List[Dict[str, Any]]:
    """Parse the uploaded CSV and return list of agent-format user dicts."""
    if not _CSV_FILE.exists():
        raise FileNotFoundError("No CSV file uploaded yet. Please upload a dataset first.")

    users = []
    with open(_CSV_FILE, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            raise ValueError("CSV file has no headers.")

        # Build lowercase → original header map
        headers_lower = {h.lower().strip(): h for h in reader.fieldnames if h}

        # Resolve column positions once
        col_map = {field: _resolve_column(headers_lower, field) for field in _COLUMN_ALIASES}

        for idx, row in enumerate(reader, start=1):
            users.append(_normalize_csv_row(row, col_map, idx))

    logger.info(f"[CustomerDataService] Loaded {len(users)} customers from CSV.")
    return users


def get_customers() -> List[Dict[str, Any]]:
    """
    Return the customer list in agent-ready format.
    - data_source == "api" → CampaignX cohort (existing behaviour, cached)
    - data_source == "csv" → uploaded CSV file
    """
    config = get_data_source_settings()
    source = config.get("data_source", "api")

    if source == "csv":
        logger.info("[CustomerDataService] Using CSV data source.")
        return _read_csv_users()
    else:
        logger.info("[CustomerDataService] Using CampaignX API data source.")
        return cohort_to_agent_users()


def upload_csv(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Save uploaded file as uploaded_dataset.csv, parse it, and return a preview.
    Returns: { row_count, columns, first_10_rows }
    """
    _DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Save raw file
    with open(_CSV_FILE, "wb") as f:
        f.write(file_bytes)
    logger.info(f"[CustomerDataService] CSV saved ({len(file_bytes)} bytes) from '{filename}'.")

    # Update settings to mark csv_uploaded
    settings = get_data_source_settings()
    settings["csv_uploaded"] = True
    with open(_SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)

    return get_csv_preview()


def get_csv_preview() -> Dict[str, Any]:
    """
    Read the uploaded CSV and return { row_count, columns, first_10_rows }.
    Raises FileNotFoundError if no CSV has been uploaded yet.
    """
    if not _CSV_FILE.exists():
        raise FileNotFoundError("No CSV file uploaded yet.")

    rows = []
    columns = []
    with open(_CSV_FILE, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames:
            columns = list(reader.fieldnames)
        for row in reader:
            rows.append(dict(row))

    return {
        "row_count": len(rows),
        "columns": columns,
        "first_10_rows": rows[:10],
    }
