"""
Campaign Service
Handles all database operations for campaigns and orchestration coordination.
Uses the InXiteOut CampaignX API for customer cohort, campaign sending, and
performance reporting via dynamic tool discovery.
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignPerformance
from app.schemas import (
    CampaignCreate, CampaignRead, CampaignApprove, CampaignEdit,
    CampaignAnalytics, OrchestratorResult, OptimizationResult,
)
from app.agents.orchestrator import run_orchestrator
from app.utils.inxiteout_api import (
    get_customer_cohort, send_campaign as api_send_campaign,
    get_report, make_send_time,
)
from app.config import settings

logger = logging.getLogger(__name__)

# Cache cohort for the duration of the process (reset by restarting server)
_cohort_cache: Optional[List[Dict[str, Any]]] = None


def _get_cohort() -> List[Dict[str, Any]]:
    """Return the customer cohort from InXiteOut API (cached in memory)."""
    global _cohort_cache
    if _cohort_cache is None:
        logger.info("[CampaignService] Fetching fresh customer cohort from CampaignX API...")
        _cohort_cache = get_customer_cohort()
        logger.info(f"[CampaignService] Cohort loaded: {len(_cohort_cache)} customers")
    return _cohort_cache


def refresh_cohort() -> int:
    """Force-refresh the cohort cache. Call this at start of Test phase (14 March)."""
    global _cohort_cache
    _cohort_cache = None
    cohort = _get_cohort()
    return len(cohort)


def _cohort_to_agent_users(cohort: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Map InXiteOut cohort fields to the format expected by the segmentation agent.
    InXiteOut fields: customer_id, Full_name, Occupation, Monthly_Income,
                      Credit score, City, Gender, Age, Marital_Status, etc.
    """
    users = []
    for c in cohort:
        users.append({
            "id": c.get("customer_id", ""),          # string e.g. "CUST0001"
            "name": c.get("Full_name", ""),
            "email": c.get("email", ""),
            "state": c.get("City", ""),               # City used as location filter
            "profession": c.get("Occupation", ""),
            "income": (c.get("Monthly_Income") or 0) * 12,  # annual
            "credit_score": c.get("Credit score") or c.get("credit_score") or 0,
            "gender": c.get("Gender", ""),
            "age": c.get("Age", 0),
            "marital_status": c.get("Marital_Status", ""),
            "kyc_status": c.get("KYC status", ""),
            "existing_customer": c.get("Existing Customer", ""),
            "app_installed": c.get("App_Installed", ""),
            "social_media_active": c.get("Social_Media_Active", ""),
        })
    return users


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
    Fetch real customer cohort from CampaignX API, run the full orchestration
    pipeline, and persist results to the Campaign record.
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found")

    # Use real cohort from InXiteOut API
    cohort = _get_cohort()
    all_users = _cohort_to_agent_users(cohort)

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
    """Approve or reject a campaign. Stores the human-selected send_time on approval."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found")
    if campaign.status not in ("draft",):
        raise ValueError(f"Campaign {campaign_id} is already '{campaign.status}' — cannot change.")

    if payload.action == "approve":
        campaign.status = "approved"
        campaign.approved_by = payload.approved_by
        campaign.approval_timestamp = datetime.now(timezone.utc)
        # Store the send_time set by the human (or auto-generate 5 min ahead)
        campaign.send_time = payload.send_time or make_send_time(minutes_ahead=5)
        db.commit()
        db.refresh(campaign)
        logger.info(f"[CampaignService] Campaign {campaign_id} APPROVED by {payload.approved_by}, "
                    f"scheduled for {campaign.send_time}")
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


def send_approved_campaign(db: Session, campaign_id: int) -> CampaignPerformance:
    """
    Send an approved campaign via the InXiteOut CampaignX API (dynamic tool discovery).
    Immediately fetches the performance report and stores real open/click metrics.
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found")
    if campaign.status != "approved":
        raise ValueError(f"Campaign {campaign_id} must be approved before sending")

    email_json = campaign.email_json or {}
    segmentation = campaign.segmentation_json or {}

    subject = email_json.get("subject_line", "")
    body = _build_email_body(email_json)
    customer_ids: List[str] = segmentation.get("selected_user_ids", [])

    if not customer_ids:
        raise ValueError("No customer IDs in segmentation — cannot send campaign")

    # Use stored send_time or auto-generate
    send_time = campaign.send_time or make_send_time(minutes_ahead=5)

    logger.info(f"[CampaignService] Calling CampaignX send_campaign API for {len(customer_ids)} customers "
                f"at {send_time}")

    # ── Call InXiteOut send_campaign via dynamic tool discovery ───────────────
    send_result = api_send_campaign(
        subject=subject,
        body=body,
        customer_ids=customer_ids,
        send_time=send_time,
    )

    campaignx_id = send_result.get("campaign_id", "")
    logger.info(f"[CampaignService] CampaignX campaign_id={campaignx_id}")

    # Store the CampaignX campaign UUID for report fetching
    campaign.campaignx_campaign_id = campaignx_id
    campaign.status = "sent"
    db.commit()

    # ── Fetch real performance report via dynamic tool discovery ──────────────
    report = get_report(campaignx_id)
    performance = _build_performance_from_report(db, campaign_id, report, len(customer_ids))

    db.refresh(campaign)
    logger.info(f"[CampaignService] Real metrics → open_rate={performance.open_rate:.1%}, "
                f"click_rate={performance.click_rate:.1%}")
    return performance


def _build_email_body(email_json: Dict[str, Any]) -> str:
    """Compose the full email body with disclaimer, ensuring CTA URL is present."""
    body = email_json.get("email_body", "")
    cta = email_json.get("cta_text", "")
    disclaimer = email_json.get("disclaimer", "")
    cta_url = "https://superbfsi.com/xdeposit/explore/"

    # Always include the official CTA URL in the body
    if cta_url not in body:
        body = f"{body}\n\n{cta}: {cta_url}"

    if disclaimer and disclaimer not in body:
        body = f"{body}\n\n---\n{disclaimer}"

    return body[:5000]  # API max 5000 chars


def _build_performance_from_report(
    db: Session,
    campaign_id: int,
    report: Dict[str, Any],
    total_sent: int,
) -> CampaignPerformance:
    """Parse the InXiteOut report response and create a CampaignPerformance record."""
    rows = report.get("data", [])

    emails_opened = sum(1 for r in rows if r.get("EO") == "Y")
    emails_clicked = sum(1 for r in rows if r.get("EC") == "Y")
    emails_sent = total_sent

    open_rate  = round(emails_opened / emails_sent, 4) if emails_sent else 0.0
    click_rate = round(emails_clicked / emails_sent, 4) if emails_sent else 0.0

    performance = CampaignPerformance(
        campaign_id=campaign_id,
        open_rate=open_rate,
        click_rate=click_rate,
        sentiment_score=None,   # not provided by InXiteOut API
        emails_sent=emails_sent,
        emails_opened=emails_opened,
        emails_clicked=emails_clicked,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(performance)
    db.commit()
    db.refresh(performance)
    return performance


def get_campaign_analytics(db: Session, campaign_id: int) -> CampaignAnalytics:
    """Fetch campaign + performance data. If sent, re-fetch latest report from API."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found")

    perf = db.query(CampaignPerformance).filter(
        CampaignPerformance.campaign_id == campaign_id
    ).order_by(CampaignPerformance.id.desc()).first()

    # If we have a CampaignX ID and already have perf, optionally re-fetch
    # (helps get updated metrics; safe to call multiple times)
    if campaign.campaignx_campaign_id and not perf:
        try:
            report = get_report(campaign.campaignx_campaign_id)
            seg = campaign.segmentation_json or {}
            total_sent = len(seg.get("selected_user_ids", []))
            perf = _build_performance_from_report(db, campaign_id, report, total_sent)
        except Exception as e:
            logger.warning(f"[CampaignService] Could not re-fetch report: {e}")

    learning_insights = None
    if perf:
        open_rate  = perf.open_rate or 0.0
        click_rate = perf.click_rate or 0.0

        if open_rate > settings.OPEN_RATE_THRESHOLD:
            engagement = "high"
            tone_rec = f"Reinforce '{campaign.strategy_json.get('tone', 'formal')}' tone — it resonated well."
            persona_rec = f"Target similar persona: '{campaign.strategy_json.get('target_persona', '')}' in future."
        else:
            engagement = "low"
            tone_rec = "Consider adjusting tone — more personalised or empathetic copy may improve open rates."
            persona_rec = "Review persona targeting — the current segment may need refinement or micro-segmentation."

        learning_insights = {
            "engagement_level": engagement,
            "open_rate_vs_threshold": f"{open_rate:.1%} vs {settings.OPEN_RATE_THRESHOLD:.1%} threshold",
            "tone_recommendation": tone_rec,
            "persona_recommendation": persona_rec,
            "click_through_assessment": (
                "Strong CTA performance — reinforce this messaging."
                if click_rate > 0.05
                else "CTA needs improvement — consider adjusting wording or placement."
            ),
            "optimization_suggested": open_rate <= settings.OPEN_RATE_THRESHOLD or click_rate <= 0.05,
        }

    return CampaignAnalytics(
        campaign=CampaignRead.model_validate(campaign),
        performance=perf,
        learning_insights=learning_insights,
    )


def run_optimization_loop(
    db: Session,
    campaign_id: int,
    approved_by: str,
    send_time: Optional[str] = None,
) -> OptimizationResult:
    """
    Autonomous Optimization Loop (§6.8):
    1. Read performance from the original sent campaign.
    2. Build an enriched objective that instructs agents to fix weaknesses.
    3. Run the full agent pipeline on the new objective (new campaign row).
    4. Auto-approve + send the new campaign.
    5. Return the OptimizationResult for human visibility.
    """
    original = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not original:
        raise ValueError(f"Campaign {campaign_id} not found")
    if original.status != "sent":
        raise ValueError(f"Campaign {campaign_id} has not been sent yet — run it first")

    perf = db.query(CampaignPerformance).filter(
        CampaignPerformance.campaign_id == campaign_id
    ).order_by(CampaignPerformance.id.desc()).first()

    open_rate  = perf.open_rate  if perf else 0.0
    click_rate = perf.click_rate if perf else 0.0

    # Build an enriched objective with performance context for the agents
    strategy = original.strategy_json or {}
    email    = original.email_json or {}
    seg      = original.segmentation_json or {}

    optimization_context = (
        f"OPTIMIZATION RUN — Previous campaign performance: "
        f"open_rate={open_rate:.1%}, click_rate={click_rate:.1%}. "
        f"Previous tone: {strategy.get('tone','formal')}. "
        f"Previous persona: {strategy.get('target_persona','')}. "
        f"Previous subject: {email.get('subject_line','')}. "
    )
    if open_rate <= settings.OPEN_RATE_THRESHOLD:
        optimization_context += (
            "Open rate was below threshold. Improve subject line, try a different tone, "
            "or target a micro-segment with higher engagement propensity. "
        )
    if click_rate <= 0.05:
        optimization_context += (
            "Click rate was low. Strengthen the CTA, make the value proposition clearer, "
            "or personalise the body content further. "
        )

    new_objective = f"{optimization_context}\n\nOriginal objective: {original.objective}"

    # Create a new campaign row for the optimized variant
    new_campaign = Campaign(objective=new_objective, status="draft")
    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)

    # Run full pipeline on new campaign
    cohort = _get_cohort()
    all_users = _cohort_to_agent_users(cohort)
    result = run_orchestrator(new_objective, new_campaign.id, all_users)

    new_campaign.strategy_json    = result.strategy.model_dump()
    new_campaign.email_json       = result.email_content.model_dump()
    new_campaign.segmentation_json = result.segmentation.model_dump()
    new_campaign.compliance_json  = result.compliance.model_dump()
    new_campaign.status           = "approved"
    new_campaign.approved_by      = approved_by
    new_campaign.approval_timestamp = datetime.now(timezone.utc)
    new_campaign.send_time        = send_time or make_send_time(minutes_ahead=5)
    db.commit()
    db.refresh(new_campaign)

    # Send via real API
    send_approved_campaign(db, new_campaign.id)

    return OptimizationResult(
        original_campaign_id=campaign_id,
        new_campaign_id=new_campaign.id,
        strategy=result.strategy,
        email_content=result.email_content,
        segmentation=result.segmentation,
        compliance=result.compliance,
        compliance_retries=result.compliance_retries,
        summary_explanation=result.summary_explanation,
        optimization_reasoning=optimization_context,
        status="sent",
    )
