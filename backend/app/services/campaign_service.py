"""
Campaign Service
================
Handles all database operations for campaigns and orchestration coordination.

Changes for final round:
- Uses cohort_service for cohort management (replaces inline _get_cohort)
- record_campaign_coverage(): writes CampaignCoverage rows after every send
- get_coverage_stats(): returns CoverageStats for the /api/coverage endpoint
- get_uncovered_customer_ids(): returns IDs not yet covered (drives exclude_ids)
- Optimization loop now targets ONLY non-openers (EO=N) and non-clickers (EC=N)
  using the get_report API — does NOT re-send to already-engaged customers
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Set

from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignPerformance, CampaignCoverage
from app.schemas import (
    CampaignCreate, CampaignRead, CampaignApprove, CampaignEdit,
    CampaignAnalytics, OrchestratorResult, OptimizationResult, CoverageStats,
)
from app.agents.orchestrator import run_orchestrator
from app.utils.inxiteout_api import (
    send_campaign as api_send_campaign,
    get_report,
    make_send_time,
)
from app.services.cohort_service import (
    get_customer_cohort_cached,
    refresh_customer_cohort as _refresh_cohort,
    cohort_to_agent_users,
    get_all_cohort_ids,
)
from app.config import settings

logger = logging.getLogger(__name__)


# ── Cohort helpers (thin wrappers so routes.py can import from campaign_service) ─

def refresh_cohort() -> int:
    """Force-refresh the cohort from the CampaignX API. Returns new cohort size."""
    return _refresh_cohort()


def _get_agent_users() -> List[Dict[str, Any]]:
    """
    Return customers as agent-ready user dicts.
    Delegates to customer_data_service which picks the active data source
    (CampaignX API or uploaded CSV) based on settings.json.
    """
    from app.services.customer_data_service import get_customers
    return get_customers()


# ── Coverage functions ─────────────────────────────────────────────────────────

def record_campaign_coverage(db: Session, campaign_id: int, customer_ids: List[str]) -> int:
    """
    Write CampaignCoverage rows for every customer_id sent in this campaign.
    Uses UniqueConstraint to safely ignore duplicates.
    Returns number of newly recorded rows.
    """
    added = 0
    for cid in customer_ids:
        exists = db.query(CampaignCoverage).filter_by(
            campaign_id=campaign_id, customer_id=cid
        ).first()
        if not exists:
            db.add(CampaignCoverage(campaign_id=campaign_id, customer_id=cid))
            added += 1
    db.commit()
    logger.info(f"[Coverage] Recorded {added} new coverage rows for campaign {campaign_id}")
    return added


def get_covered_ids(db: Session) -> List[str]:
    """Return all customer_ids covered by at least one sent campaign."""
    rows = db.query(CampaignCoverage.customer_id).distinct().all()
    return [r[0] for r in rows]


def get_uncovered_customer_ids(db: Session) -> List[str]:
    """
    Return customer_ids from the live cohort that have NOT yet been covered.
    These drive the exclude_ids parameter in the segmentation agent so that
    new campaigns are automatically constrained to uncovered customers.
    Returns [] if the cohort is not yet loaded (before refresh-cohort is called).
    """
    try:
        all_ids: Set[str] = set(get_all_cohort_ids())
    except Exception as e:
        logger.warning(f"[Coverage] Could not load cohort IDs: {e}. Returning empty uncovered list.")
        return []
    covered: Set[str] = set(get_covered_ids(db))
    uncovered = sorted(all_ids - covered)
    logger.info(f"[Coverage] Cohort: {len(all_ids)} | Covered: {len(covered)} | Uncovered: {len(uncovered)}")
    return uncovered


def get_coverage_stats(db: Session) -> CoverageStats:
    """Return full coverage statistics for the GET /api/coverage endpoint."""
    try:
        all_ids = get_all_cohort_ids()
    except Exception as e:
        logger.warning(f"[Coverage] Could not load cohort IDs: {e}. Returning zeroed stats.")
        all_ids = []
    covered = get_covered_ids(db)
    covered_set = set(covered)
    uncovered = [cid for cid in all_ids if cid not in covered_set]
    total = len(all_ids)
    cov_count = len(covered_set)
    return CoverageStats(
        total_cohort_size=total,
        covered_count=cov_count,
        uncovered_count=len(uncovered),
        coverage_percent=round((cov_count / total * 100), 2) if total else 0.0,
        covered_ids=sorted(covered_set),
        uncovered_ids=uncovered,
    )


# ── Campaign CRUD ──────────────────────────────────────────────────────────────

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
    pipeline (strategy -> content -> compliance -> segmentation), and persist results.

    The orchestrator receives uncovered_ids so the segmentation agent automatically
    excludes already-covered customers — guaranteeing no duplicate targeting.
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found")

    all_users = _get_agent_users()

    # Pass already-COVERED IDs so segmentation agent excludes them (avoids duplicate targeting)
    covered_ids = get_covered_ids(db)
    logger.info(f"[CampaignService] {len(covered_ids)} already-covered IDs excluded from segmentation")

    result = run_orchestrator(campaign.objective, campaign_id, all_users, exclude_ids=covered_ids)

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


def list_campaigns_with_stats(db: Session) -> List[Dict[str, Any]]:
    """
    Return campaigns as dicts enriched with performance data:
    emails_sent, emails_opened, emails_clicked, open_rate, click_rate.
    Used by the Dashboard to show EO/EC counts per campaign and a total score.
    """
    campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).all()
    result = []
    for c in campaigns:
        perf = db.query(CampaignPerformance).filter(
            CampaignPerformance.campaign_id == c.id
        ).order_by(CampaignPerformance.id.desc()).first()

        row = CampaignRead.model_validate(c).model_dump()
        if perf:
            row["perf"] = {
                "emails_sent": perf.emails_sent,
                "emails_opened": perf.emails_opened,
                "emails_clicked": perf.emails_clicked,
                "open_rate": perf.open_rate,
                "click_rate": perf.click_rate,
            }
        else:
            row["perf"] = None
        result.append(row)
    return result


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
    Send an approved campaign via the InXiteOut CampaignX API.
    After a successful send:
    1. Records coverage (CampaignCoverage rows) for all recipients.
    2. Fetches real open/click metrics from the get_report API.
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

    send_time = campaign.send_time or make_send_time(minutes_ahead=5)

    logger.info(f"[CampaignService] Sending to {len(customer_ids)} customers at {send_time}")

    send_result = api_send_campaign(
        subject=subject,
        body=body,
        customer_ids=customer_ids,
        send_time=send_time,
    )

    campaignx_id = send_result.get("campaign_id", "")
    logger.info(f"[CampaignService] CampaignX campaign_id={campaignx_id}")

    campaign.campaignx_campaign_id = campaignx_id
    campaign.status = "sent"
    db.commit()

    # ── Record coverage automatically ──────────────────────────────────────────
    record_campaign_coverage(db, campaign_id, customer_ids)

    # ── Fetch live performance metrics ─────────────────────────────────────────
    report = get_report(campaignx_id)
    performance = _build_performance_from_report(db, campaign_id, report, len(customer_ids))

    db.refresh(campaign)
    logger.info(f"[CampaignService] Metrics: open_rate={performance.open_rate:.1%}, "
                f"click_rate={performance.click_rate:.1%}")
    return performance


def _build_email_body(email_json: Dict[str, Any]) -> str:
    """Compose full email body with disclaimer, ensuring CTA URL is present."""
    body = email_json.get("email_body", "")
    cta = email_json.get("cta_text", "")
    disclaimer = email_json.get("disclaimer", "")
    cta_url = "https://superbfsi.com/xdeposit/explore/"

    if cta_url not in body:
        body = f"{body}\n\n{cta}: {cta_url}"

    if disclaimer and disclaimer not in body:
        body = f"{body}\n\n---\n{disclaimer}"

    return body[:5000]


def _build_performance_from_report(
    db: Session,
    campaign_id: int,
    report: Dict[str, Any],
    total_sent: int,
) -> CampaignPerformance:
    """Parse InXiteOut report response and create a CampaignPerformance record."""
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
        sentiment_score=None,
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
    """Fetch campaign + performance data. Re-fetches latest report if available."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found")

    perf = db.query(CampaignPerformance).filter(
        CampaignPerformance.campaign_id == campaign_id
    ).order_by(CampaignPerformance.id.desc()).first()

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
            persona_rec = "Review persona targeting — the current segment may need refinement."

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
    Autonomous Optimization Loop — Final Round Edition.

    Scoring criterion: maximize raw EO=Y + EC=Y counts across the cohort.
    Strategy:
      1. Fetch report for the original campaign.
      2. Identify non-openers (EO=N) and non-clickers (EO=Y, EC=N).
      3. Target the larger sub-group with a new optimized email.
      4. Auto-approve and send. Record coverage.

    This avoids re-sending to already-engaged customers, maximising new EO/EC events.
    """
    original = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not original:
        raise ValueError(f"Campaign {campaign_id} not found")
    if original.status != "sent":
        raise ValueError(f"Campaign {campaign_id} has not been sent yet")
    if not original.campaignx_campaign_id:
        raise ValueError(f"Campaign {campaign_id} has no CampaignX ID — cannot fetch report")

    # ── 1. Fetch report and build engagement maps ──────────────────────────────
    logger.info(f"[OptimizationLoop] Fetching report for campaign_id={campaign_id}")
    report = get_report(original.campaignx_campaign_id)
    rows = report.get("data", [])

    eo_map: Dict[str, str] = {r["customer_id"]: r.get("EO", "N") for r in rows if "customer_id" in r}
    ec_map: Dict[str, str] = {r["customer_id"]: r.get("EC", "N") for r in rows if "customer_id" in r}

    original_seg = original.segmentation_json or {}
    original_ids: List[str] = original_seg.get("selected_user_ids", [])

    non_opener_ids  = [cid for cid in original_ids if eo_map.get(cid, "N") == "N"]
    non_clicker_ids = [cid for cid in original_ids if eo_map.get(cid, "N") == "Y" and ec_map.get(cid, "N") == "N"]

    logger.info(f"[OptimizationLoop] Non-openers: {len(non_opener_ids)}, Non-clickers: {len(non_clicker_ids)}")

    # ── 2. Choose target sub-group ─────────────────────────────────────────────
    perf = db.query(CampaignPerformance).filter(
        CampaignPerformance.campaign_id == campaign_id
    ).order_by(CampaignPerformance.id.desc()).first()

    open_rate  = perf.open_rate  if perf else 0.0
    click_rate = perf.click_rate if perf else 0.0

    if len(non_opener_ids) >= len(non_clicker_ids):
        target_ids = non_opener_ids
        weakness = "open"
        weakness_instruction = (
            "Non-openers did not open the email — the subject line failed to capture attention. "
            "Generate a completely different subject line using a bold curiosity gap, specific benefit "
            "with a number, or a direct personalised question. Under 55 characters, English only. "
            "Also rewrite the first two sentences of the body to be immediately compelling."
        )
    else:
        target_ids = non_clicker_ids
        weakness = "click"
        weakness_instruction = (
            "Non-clickers opened the email but did not click through. "
            "Rewrite the body with a clearer, more specific value proposition. "
            "Make the CTA more urgent and action-oriented. "
            "Ensure the URL https://superbfsi.com/xdeposit/explore/ is clearly prominent."
        )

    if not target_ids:
        raise ValueError(
            f"No {'non-openers' if weakness == 'open' else 'non-clickers'} found — "
            "all recipients already engaged with this campaign."
        )

    # ── 3. Build enriched objective ────────────────────────────────────────────
    strategy_data = original.strategy_json or {}
    email_data    = original.email_json or {}

    optimization_context = (
        f"OPTIMIZATION: targeting {len(target_ids)} {'non-openers' if weakness == 'open' else 'non-clickers'} "
        f"from campaign {campaign_id}.\n"
        f"Previous metrics: open_rate={open_rate:.1%}, click_rate={click_rate:.1%}.\n"
        f"Previous subject: \"{email_data.get('subject_line', '')}\".\n"
        f"Previous tone: {strategy_data.get('tone', 'formal')}.\n"
        f"Weakness: {weakness_instruction}"
    )
    new_objective = f"{optimization_context}\n\nOriginal objective: {original.objective}"

    # ── 4. Run agent pipeline on subset ───────────────────────────────────────
    all_users = _get_agent_users()
    target_id_set = set(target_ids)
    subset_users = [u for u in all_users if u["id"] in target_id_set]

    new_campaign = Campaign(objective=new_objective, status="draft")
    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)

    result = run_orchestrator(new_objective, new_campaign.id, subset_users, exclude_ids=[])

    # Force segmentation to exactly the target_ids (don't let agent narrow further)
    from app.schemas import SegmentationOutput
    forced_seg = SegmentationOutput(
        filters_applied=(
            f"Optimization resend — {'non-openers' if weakness == 'open' else 'non-clickers'} "
            f"from campaign {campaign_id} ({len(target_ids)} recipients)"
        ),
        selected_user_count=len(target_ids),
        selected_user_ids=target_ids,
        reasoning=f"Targeting {weakness} sub-group only to maximise new EO/EC counts.",
    )

    new_campaign.strategy_json     = result.strategy.model_dump()
    new_campaign.email_json        = result.email_content.model_dump()
    new_campaign.segmentation_json = forced_seg.model_dump()
    new_campaign.compliance_json   = result.compliance.model_dump()
    new_campaign.status            = "approved"
    new_campaign.approved_by       = approved_by
    new_campaign.approval_timestamp = datetime.now(timezone.utc)
    new_campaign.send_time         = send_time or make_send_time(minutes_ahead=5)
    db.commit()
    db.refresh(new_campaign)

    # ── 5. Send + auto-record coverage ────────────────────────────────────────
    send_approved_campaign(db, new_campaign.id)

    return OptimizationResult(
        original_campaign_id=campaign_id,
        new_campaign_id=new_campaign.id,
        strategy=result.strategy,
        email_content=result.email_content,
        segmentation=forced_seg,
        compliance=result.compliance,
        compliance_retries=result.compliance_retries,
        summary_explanation=result.summary_explanation,
        optimization_reasoning=optimization_context,
        status="sent",
    )


# ── Debug helpers ──────────────────────────────────────────────────────────────

def debug_segment_size(db: Session) -> Dict[str, Any]:
    """
    Run a single broad segmentation pass and return diagnostic info.
    Used by GET /api/debug/segment-size to verify segmentation health
    before committing to real campaign runs.

    Returns:
        {
          "segment_size": int,
          "occupations": list[str],
          "excluded_count": int,
          "filters_applied": str,
        }
    """
    from app.agents.segmentation_agent import run_segmentation_agent, LIVE_OCCUPATIONS
    from app.schemas import StrategyOutput

    all_users = _get_agent_users()
    covered_ids = get_covered_ids(db)

    # Broad generic persona — exercises the occupation filter path without
    # being so narrow that it triggers the size-fallback cascade.
    test_strategy = StrategyOutput(
        campaign_goal="Maximise email opens and clicks for a high-yield savings deposit offer",
        target_persona=(
            "Target IT professionals and engineers in India who would benefit from a high-yield "
            "savings deposit product. Include professionals with stable incomes who are likely "
            "to engage with financial products."
        ),
        tone="professional",
        key_message="Grow your savings with a high-yield fixed deposit — limited time offer.",
        reasoning="Debug run: broad IT/engineer persona to verify segment size and exclusion logic.",
    )

    result = run_segmentation_agent(test_strategy, all_users, exclude_ids=covered_ids)

    # Extract the occupation keywords the agent chose from filters_applied
    selected_occupations: List[str] = []
    for part in result.filters_applied.split(";"):
        part = part.strip()
        if part.lower().startswith("occupations:"):
            selected_occupations = [o.strip() for o in part[len("occupations:"):].split(",")]
            break

    logger.info(
        f"[DebugSegment] segment_size={result.selected_user_count} | "
        f"occupations={selected_occupations} | excluded={len(covered_ids)}"
    )

    return {
        "segment_size": result.selected_user_count,
        "occupations": selected_occupations,
        "excluded_count": len(covered_ids),
        "filters_applied": result.filters_applied,
    }
