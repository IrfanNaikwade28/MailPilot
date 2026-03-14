"""
API Routes — all endpoints for MailPilot.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.schemas import (
    CampaignCreate, CampaignRead, CampaignApprove, CampaignEdit,
    CampaignAnalytics, OrchestratorResult, APIResponse, UserCreate, UserRead,
    OptimizationRequest, OptimizationResult, CoverageStats,
)
from app.services import (
    create_campaign, run_campaign_pipeline, get_campaign, list_campaigns,
    approve_campaign, edit_campaign_email, get_campaign_analytics,
    send_approved_campaign, run_optimization_loop, refresh_cohort,
    get_coverage_stats, get_uncovered_customer_ids,
)
from app.services.campaign_service import debug_segment_size, list_campaigns_with_stats
from app.services.customer_data_service import (
    get_data_source_settings,
    save_data_source_settings,
    upload_csv,
    get_csv_preview,
)
from app.models.user import User


class SettingsSaveRequest(BaseModel):
    data_source: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Campaign Endpoints ────────────────────────────────────────────────────────

@router.post("/campaign/create", response_model=OrchestratorResult, tags=["Campaign"])
async def create_campaign_endpoint(
    payload: CampaignCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new campaign from a natural language objective.
    Runs the full multi-agent pipeline (Strategy → Content → Compliance → Segmentation).
    Returns the full orchestrated result for human review.
    """
    try:
        campaign = create_campaign(db, payload)
        result = run_campaign_pipeline(db, campaign.id)
        return result
    except Exception as e:
        logger.error(f"Campaign creation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/campaign/list", response_model=list[CampaignRead], tags=["Campaign"])
def list_campaigns_endpoint(db: Session = Depends(get_db)):
    """List all campaigns ordered by creation date (newest first)."""
    campaigns = list_campaigns(db)
    return campaigns


@router.get("/campaign/list-with-stats", tags=["Campaign"])
def list_campaigns_with_stats_endpoint(db: Session = Depends(get_db)):
    """
    List all campaigns enriched with performance data (emails_sent, opened, clicked, rates).
    Used by Dashboard to display per-campaign EO/EC counts and total hackathon score.
    """
    return list_campaigns_with_stats(db)


@router.get("/campaign/{campaign_id}", response_model=CampaignRead, tags=["Campaign"])
def get_campaign_endpoint(campaign_id: int, db: Session = Depends(get_db)):
    """Fetch a single campaign by ID."""
    campaign = get_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found")
    return campaign


@router.patch("/campaign/{campaign_id}/edit", response_model=CampaignRead, tags=["Campaign"])
def edit_campaign_endpoint(
    campaign_id: int,
    payload: CampaignEdit,
    db: Session = Depends(get_db),
):
    """
    Human-in-the-loop: Edit email content before approval.
    Only editable fields: subject_line, email_body, cta_text, disclaimer.
    """
    try:
        campaign = edit_campaign_email(db, campaign_id, payload)
        return campaign
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/campaign/{campaign_id}/approve", response_model=CampaignRead, tags=["Campaign"])
def approve_campaign_endpoint(
    campaign_id: int,
    payload: CampaignApprove,
    db: Session = Depends(get_db),
):
    """
    Human-in-the-loop approval.
    action = 'approve' → marks campaign approved.
    action = 'reject'  → marks campaign rejected with reason.
    """
    try:
        campaign = approve_campaign(db, campaign_id, payload)
        return campaign
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/campaign/{campaign_id}/send", response_model=APIResponse, tags=["Campaign"])
def send_campaign_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    """
    Send an approved campaign via the InXiteOut CampaignX API.
    Must be approved before sending. Fetches real open/click metrics.
    """
    try:
        perf = send_approved_campaign(db, campaign_id)
        return APIResponse(
            success=True,
            message=f"Campaign sent to {perf.emails_sent} recipients via CampaignX API. "
                    f"Open rate: {perf.open_rate:.1%}, click rate: {perf.click_rate:.1%}",
            data={
                "emails_sent": perf.emails_sent,
                "emails_opened": perf.emails_opened,
                "emails_clicked": perf.emails_clicked,
                "open_rate": perf.open_rate,
                "click_rate": perf.click_rate,
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Send campaign failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/campaign/{campaign_id}/analytics", response_model=CampaignAnalytics, tags=["Campaign"])
def get_analytics_endpoint(campaign_id: int, db: Session = Depends(get_db)):
    """
    Get campaign analytics with learning loop insights.
    Includes open rate, click rate, sentiment score, and AI-driven recommendations.
    """
    try:
        return get_campaign_analytics(db, campaign_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/campaign/{campaign_id}/optimize", response_model=OptimizationResult, tags=["Campaign"])
def optimize_campaign_endpoint(
    campaign_id: int,
    payload: OptimizationRequest,
    db: Session = Depends(get_db),
):
    """
    Autonomous Optimization Loop.
    Reads performance from a sent campaign, generates an improved variant,
    auto-approves it, and sends it via CampaignX API.
    Returns the OptimizationResult for human visibility.
    """
    try:
        return run_optimization_loop(db, campaign_id, payload.approved_by, payload.send_time)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Optimization loop failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── User Endpoints ────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserRead], tags=["Users"])
def list_users(db: Session = Depends(get_db)):
    """List all users in the system."""
    return db.query(User).all()


@router.post("/users", response_model=UserRead, tags=["Users"])
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    """Create a new user."""
    user = User(**payload.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ─── Admin / Utility Endpoints ────────────────────────────────────────────────

@router.post("/admin/refresh-cohort", response_model=APIResponse, tags=["Admin"])
def refresh_cohort_endpoint(db: Session = Depends(get_db)):
    """Force-refresh the customer cohort from the CampaignX API (use at start of Test phase)."""
    count = refresh_cohort()
    return APIResponse(success=True, message=f"Cohort refreshed: {count} customers loaded.", data={"count": count})


# ─── Coverage Endpoints ────────────────────────────────────────────────────────

@router.get("/coverage", response_model=CoverageStats, tags=["Coverage"])
def get_coverage_endpoint(db: Session = Depends(get_db)):
    """Get cohort coverage stats: total, covered, uncovered, and per-campaign breakdown."""
    return get_coverage_stats(db)


@router.get("/coverage/uncovered-ids", response_model=list[str], tags=["Coverage"])
def get_uncovered_ids_endpoint(db: Session = Depends(get_db)):
    """Return the list of customer IDs not yet covered by any sent campaign."""
    return get_uncovered_customer_ids(db)


@router.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "MailPilot"}


# ─── Debug Endpoints ──────────────────────────────────────────────────────────

@router.get("/debug/segment-size", tags=["Debug"])
def debug_segment_size_endpoint(db: Session = Depends(get_db)):
    """
    Temporary diagnostic endpoint — run segmentation once with a broad generic
    persona and return segment_size, occupations chosen, and excluded_count.

    Use this to verify segmentation is healthy before running real campaigns.

    Returns:
        {
          "segment_size": int,
          "occupations": list[str],
          "excluded_count": int,
          "filters_applied": str
        }
    """
    try:
        return debug_segment_size(db)
    except Exception as e:
        logger.error(f"debug_segment_size failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Settings Endpoints ───────────────────────────────────────────────────────

@router.get("/settings", tags=["Settings"])
def get_settings_endpoint():
    """Get current data source settings (data_source, api_key, base_url, csv_uploaded)."""
    return get_data_source_settings()


@router.post("/settings", tags=["Settings"])
def save_settings_endpoint(payload: SettingsSaveRequest):
    """
    Save data source selection.
    data_source must be 'api' or 'csv'.
    Optionally update api_key and base_url when using CampaignX API mode.
    """
    try:
        return save_data_source_settings(
            data_source=payload.data_source,
            api_key=payload.api_key,
            base_url=payload.base_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/settings/upload-csv", tags=["Settings"])
async def upload_csv_endpoint(file: UploadFile = File(...)):
    """
    Upload a CSV file as the customer dataset.
    The file is stored at backend/data/uploaded_dataset.csv.
    Returns a preview: { row_count, columns, first_10_rows }.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")
    try:
        contents = await file.read()
        preview = upload_csv(contents, file.filename or "dataset.csv")
        return {"success": True, "filename": file.filename, **preview}
    except Exception as e:
        logger.error(f"CSV upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings/dataset-preview", tags=["Settings"])
def dataset_preview_endpoint():
    """
    Return a preview of the currently uploaded CSV dataset.
    Returns: { row_count, columns, first_10_rows }
    """
    try:
        return get_csv_preview()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Dataset preview failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
