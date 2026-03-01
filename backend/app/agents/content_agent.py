"""
Agent 2: Email Content Agent
Generates compliant, professional BFSI email content based on campaign strategy.
"""
import logging
from app.schemas import StrategyOutput, EmailContentOutput
from app.utils.groq_client import call_llm_json

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert BFSI email copywriter for the Indian market.
You write professional, compliant marketing emails for banks, NBFCs, insurance companies, and wealth managers.

Strict Rules:
1. Professional and formal tone — no slang or casual language.
2. No guaranteed returns, no misleading claims (e.g., "best rates guaranteed", "risk-free returns").
3. Always include a legal disclaimer at the end.
4. Subject line must be clear, concise (<60 chars), and not sensational.
5. Email body should be 150-250 words.
6. CTA must be clear and specific (e.g., "Apply Now", "Check Eligibility", "Schedule a Call").
7. Disclaimer must mention regulatory body (RBI/SEBI/IRDAI) where applicable.
8. Respond ONLY with valid JSON — no markdown, no extra text.

Required JSON format:
{
  "subject_line": "<email subject under 60 chars>",
  "email_body": "<full email body, 150-250 words, formal tone>",
  "cta_text": "<call-to-action button text>",
  "disclaimer": "<legal disclaimer mentioning applicable regulator>"
}"""


def run_content_agent(strategy: StrategyOutput, revision_notes: str = "") -> EmailContentOutput:
    """
    Run the Email Content Agent.

    Args:
        strategy: Output from the Strategy Agent.
        revision_notes: Optional notes from the Compliance Agent for revision.

    Returns:
        EmailContentOutput: Structured email content.
    """
    logger.info(f"[ContentAgent] Generating email for goal: {strategy.campaign_goal[:80]}...")

    revision_section = ""
    if revision_notes:
        revision_section = f"\n\nRevision Notes from Compliance Review:\n{revision_notes}\nPlease fix the above issues."

    user_prompt = f"""Campaign Strategy:
- Goal: {strategy.campaign_goal}
- Target Persona: {strategy.target_persona}
- Tone: {strategy.tone}
- CTA Strategy: {strategy.cta_strategy}
- Reasoning: {strategy.reasoning}
{revision_section}

Generate a professional BFSI marketing email based on the strategy above."""

    data = call_llm_json(SYSTEM_PROMPT, user_prompt)

    result = EmailContentOutput(
        subject_line=data.get("subject_line", ""),
        email_body=data.get("email_body", ""),
        cta_text=data.get("cta_text", "Learn More"),
        disclaimer=data.get("disclaimer", ""),
    )

    logger.info(f"[ContentAgent] Email generated. Subject: {result.subject_line}")
    return result
