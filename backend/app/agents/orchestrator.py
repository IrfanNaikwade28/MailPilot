"""
Agent 5: Orchestrator Agent
Coordinates all agents in the correct order, manages the compliance retry loop,
and produces the final aggregated campaign object with a human-readable summary.
"""
import logging
from typing import List, Dict, Any

from app.schemas import (
    StrategyOutput, EmailContentOutput, SegmentationOutput,
    ComplianceOutput, OrchestratorResult
)
from app.agents.strategy_agent import run_strategy_agent
from app.agents.content_agent import run_content_agent
from app.agents.segmentation_agent import run_segmentation_agent
from app.agents.compliance_agent import run_compliance_agent
from app.config import settings

logger = logging.getLogger(__name__)


def _build_summary(
    objective: str,
    strategy: StrategyOutput,
    email: EmailContentOutput,
    segmentation: SegmentationOutput,
    compliance: ComplianceOutput,
    retries: int,
) -> str:
    """Build a human-readable summary explanation of all agent decisions."""
    compliance_note = (
        "The email passed compliance review on the first attempt."
        if retries == 0
        else f"The email required {retries} revision(s) to pass compliance review."
    )

    return (
        f"Campaign Objective: {objective}\n\n"
        f"Strategy Agent: The goal was identified as '{strategy.campaign_goal}'. "
        f"The campaign targets '{strategy.target_persona}' using a {strategy.tone} tone. "
        f"Reasoning: {strategy.reasoning}\n\n"
        f"Content Agent: Generated subject line '{email.subject_line}' with a {strategy.tone} tone "
        f"and CTA '{email.cta_text}'.\n\n"
        f"Compliance Agent: {compliance_note} "
        f"{'No issues found.' if compliance.is_compliant else 'Final email is compliant after revisions.'}\n\n"
        f"Segmentation Agent: Selected {segmentation.selected_user_count} users. "
        f"Filters applied: {segmentation.filters_applied}. "
        f"Reasoning: {segmentation.reasoning}\n\n"
        f"This campaign is now ready for human review and approval."
    )


def run_orchestrator(
    objective: str,
    campaign_id: int,
    all_users: List[Dict[str, Any]],
) -> OrchestratorResult:
    """
    Main orchestration flow:
    1. Strategy Agent
    2. Content Agent
    3. Compliance Agent (with retry loop)
    4. Segmentation Agent
    5. Aggregate and return

    Args:
        objective: Natural language campaign objective.
        campaign_id: DB campaign ID for reference.
        all_users: All users from DB as list of dicts.

    Returns:
        OrchestratorResult: Full aggregated campaign result.
    """
    logger.info(f"[Orchestrator] Starting pipeline for campaign_id={campaign_id}")

    # Step 1: Strategy
    logger.info("[Orchestrator] Step 1/4 — Strategy Agent")
    strategy = run_strategy_agent(objective)

    # Step 2: Content Generation
    logger.info("[Orchestrator] Step 2/4 — Content Agent")
    email_content = run_content_agent(strategy)

    # Step 3: Compliance loop
    logger.info("[Orchestrator] Step 3/4 — Compliance Agent")
    compliance_retries = 0
    compliance = run_compliance_agent(email_content)

    while not compliance.is_compliant and compliance_retries < settings.MAX_COMPLIANCE_RETRIES:
        compliance_retries += 1
        logger.warning(
            f"[Orchestrator] Compliance FAILED (attempt {compliance_retries}). "
            f"Sending back to Content Agent for revision."
        )
        revision_notes = (
            "Issues:\n" + "\n".join(f"- {i}" for i in compliance.issues_found) +
            "\n\nSuggested fixes:\n" + "\n".join(f"- {f}" for f in compliance.suggested_fixes)
        )
        email_content = run_content_agent(strategy, revision_notes=revision_notes)
        compliance = run_compliance_agent(email_content)

    if not compliance.is_compliant:
        logger.error(
            f"[Orchestrator] Email could not be made compliant after "
            f"{settings.MAX_COMPLIANCE_RETRIES} retries."
        )

    # Step 4: Segmentation
    logger.info("[Orchestrator] Step 4/4 — Segmentation Agent")
    segmentation = run_segmentation_agent(strategy, all_users)

    # Step 5: Build summary
    summary = _build_summary(objective, strategy, email_content, segmentation, compliance, compliance_retries)

    logger.info(f"[Orchestrator] Pipeline complete for campaign_id={campaign_id}.")

    return OrchestratorResult(
        campaign_id=campaign_id,
        strategy=strategy,
        email_content=email_content,
        segmentation=segmentation,
        compliance=compliance,
        compliance_retries=compliance_retries,
        summary_explanation=summary,
        status="draft",
    )
