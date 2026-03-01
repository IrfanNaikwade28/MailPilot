"""
API Routes — all endpoints for MailPilot.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    CampaignCreate, CampaignRead, CampaignApprove, CampaignEdit,
    CampaignAnalytics, OrchestratorResult, APIResponse, UserCreate, UserRead,
    OptimizationRequest, OptimizationResult,
)
from app.services import (
    create_campaign, run_campaign_pipeline, get_campaign, list_campaigns,
    approve_campaign, edit_campaign_email, get_campaign_analytics,
    send_approved_campaign, run_optimization_loop, refresh_cohort,
)
from app.models.user import User

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


@router.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "MailPilot"}
