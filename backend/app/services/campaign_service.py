"""
Campaign Service
Handles all database operations for campaigns and orchestration coordination.
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignPerformance
from app.models.user import User
from app.schemas import (
    CampaignCreate, CampaignRead, CampaignApprove, CampaignEdit,
    CampaignAnalytics, OrchestratorResult
)
from app.agents.orchestrator import run_orchestrator

logger = logging.getLogger(__name__)


def create_campaign(db: Session, payload: CampaignCreate) -> Campaign:
    """Create a new campaign record in draft state."""
    campaign = Campaign(objective=payload.objective, status="draft")
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    logger.info(f"[CampaignService] Created campaign id={campaign.id}")
    return campaign


def run_campaign_pipeline(db: Session, campaign_id: int) -> OrchestratorResult:
    """
    Fetch all users, run the full orchestration pipeline,
    and persist results to the Campaign record.
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found")

    # Fetch all users as dicts for segmentation
    users = db.query(User).all()
    all_users = [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "state": u.state,
            "profession": u.profession,
            "income": u.income,
            "credit_score": u.credit_score,
        }
        for u in users
    ]

    result = run_orchestrator(campaign.objective, campaign_id, all_users)

    # Persist agent outputs to DB
    campaign.strategy_json = result.strategy.model_dump()
    campaign.email_json = result.email_content.model_dump()
    campaign.segmentation_json = result.segmentation.model_dump()
    campaign.compliance_json = result.compliance.model_dump()
    campaign.status = "draft"

    db.commit()
    db.refresh(campaign)

    logger.info(f"[CampaignService] Pipeline complete for campaign id={campaign_id}")
    return result


def get_campaign(db: Session, campaign_id: int) -> Optional[Campaign]:
    return db.query(Campaign).filter(Campaign.id == campaign_id).first()


def list_campaigns(db: Session) -> List[Campaign]:
    return db.query(Campaign).order_by(Campaign.created_at.desc()).all()


def approve_campaign(db: Session, campaign_id: int, payload: CampaignApprove) -> Campaign:
    """Approve or reject a campaign. On approval, trigger email sending simulation."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found")
    if campaign.status not in ("draft",):
        raise ValueError(f"Campaign {campaign_id} is already '{campaign.status}' — cannot change.")

    if payload.action == "approve":
        campaign.status = "approved"
        campaign.approved_by = payload.approved_by
        campaign.approval_timestamp = datetime.now(timezone.utc)
        db.commit()
        db.refresh(campaign)
        logger.info(f"[CampaignService] Campaign {campaign_id} APPROVED by {payload.approved_by}")
    elif payload.action == "reject":
        campaign.status = "rejected"
        campaign.approved_by = payload.approved_by
        campaign.rejection_reason = payload.rejection_reason
        campaign.approval_timestamp = datetime.now(timezone.utc)
        db.commit()
        db.refresh(campaign)
        logger.info(f"[CampaignService] Campaign {campaign_id} REJECTED")
    else:
        raise ValueError("action must be 'approve' or 'reject'")

    return campaign


def edit_campaign_email(db: Session, campaign_id: int, payload: CampaignEdit) -> Campaign:
    """Allow human editor to manually tweak email fields before approval."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found")

    email_json = dict(campaign.email_json or {})
    if payload.subject_line is not None:
        email_json["subject_line"] = payload.subject_line
    if payload.email_body is not None:
        email_json["email_body"] = payload.email_body
    if payload.cta_text is not None:
        email_json["cta_text"] = payload.cta_text
    if payload.disclaimer is not None:
        email_json["disclaimer"] = payload.disclaimer

    campaign.email_json = email_json
    db.commit()
    db.refresh(campaign)
    return campaign


def get_campaign_analytics(db: Session, campaign_id: int) -> CampaignAnalytics:
    """Fetch campaign + performance data with learning insights."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found")

    perf = db.query(CampaignPerformance).filter(
        CampaignPerformance.campaign_id == campaign_id
    ).first()

    learning_insights = None
    if perf:
        from app.config import settings
        open_rate = perf.open_rate or 0.0
        click_rate = perf.click_rate or 0.0

        if open_rate > settings.OPEN_RATE_THRESHOLD:
            engagement = "high"
            tone_recommendation = f"Reinforce '{campaign.strategy_json.get('tone', 'formal')}' tone — it resonated well."
            persona_recommendation = f"Target similar persona: '{campaign.strategy_json.get('target_persona', '')}' in future campaigns."
        else:
            engagement = "low"
            tone_recommendation = "Consider adjusting tone to be more personalised or empathetic."
            persona_recommendation = "Review persona targeting — the current segment may need refinement."

        learning_insights = {
            "engagement_level": engagement,
            "open_rate_vs_threshold": f"{open_rate:.1%} vs {settings.OPEN_RATE_THRESHOLD:.1%} threshold",
            "tone_recommendation": tone_recommendation,
            "persona_recommendation": persona_recommendation,
            "click_through_assessment": (
                "Strong CTA performance." if click_rate > 0.05
                else "CTA needs improvement — consider A/B testing the button text."
            ),
        }

    return CampaignAnalytics(
        campaign=CampaignRead.model_validate(campaign),
        performance=perf,
        learning_insights=learning_insights,
    )
