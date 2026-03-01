"""
Agent 2: Email Content Agent
Generates compliant, professional BFSI email content based on campaign strategy.
"""
import logging
from app.schemas import StrategyOutput, EmailContentOutput
from app.utils.groq_client import call_llm_json

logger = logging.getLogger(__name__)

CTA_URL = "https://superbfsi.com/xdeposit/explore/"

SYSTEM_PROMPT = f"""You are an expert BFSI email copywriter for the Indian market.
You write professional, compliant, high-converting marketing emails for banks, NBFCs, insurance companies, and wealth managers.

Strict Rules:
1. Professional and formal tone — no slang or casual language.
2. No guaranteed returns, no misleading claims (e.g., "best rates guaranteed", "risk-free returns").
3. Always include a legal disclaimer at the end.
4. Subject line: CRITICAL — this is the single biggest driver of open rates. Follow these guidelines:
   - Under 55 characters. English text only — no URLs, no special characters beyond punctuation.
   - Use ONE of these proven high-open-rate techniques:
     a) Personalised question: "Are you maximising your savings, [Profession]?"
     b) Curiosity gap: "What most IT professionals don't know about FD rates"
     c) Specific benefit with number: "Earn up to 7.5% on your idle savings"
     d) Time-sensitivity (genuine, not fake): "Last few days: Pre-approved offer for you"
     e) Direct personal address: "Your exclusive home loan offer — just for you"
   - NEVER use generic phrases like "Exclusive Offers", "Grow Your Savings", "Apply Now", "Important Update".
   - NEVER use ALL CAPS or excessive punctuation.
5. Email body should be 150-220 words. Open with the customer's pain point or aspiration, not with "Dear customer".
6. CTA must be clear, specific, and action-oriented (e.g., "Check Your Eligibility", "Calculate Your Returns", "Book a Free Consultation").
7. Disclaimer must mention regulatory body (RBI/SEBI/IRDAI) where applicable.
8. IMPORTANT: The email body MUST include the following CTA URL exactly as written: {CTA_URL}
   Include it naturally in a sentence like "Explore your options at {CTA_URL}" or "Visit {CTA_URL} to get started".
9. Respond ONLY with valid JSON — no markdown, no extra text.

Required JSON format:
{{
  "subject_line": "<high-converting email subject under 55 chars, English text only, uses a proven open-rate technique>",
  "email_body": "<full email body, 150-220 words, opens with customer pain point or aspiration, MUST contain {CTA_URL}>",
  "cta_text": "<specific action-oriented call-to-action button text>",
  "disclaimer": "<legal disclaimer mentioning applicable regulator>"
}}"""


def run_content_agent(strategy: StrategyOutput, revision_notes: str = "") -> EmailContentOutput:
    """
    Run the Email Content Agent.

    Args:
        strategy: Output from the Strategy Agent.
        revision_notes: Optional notes from the Compliance Agent for revision.

    Returns:
        EmailContentOutput: Structured email content with CTA URL guaranteed in body.
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

Generate a professional BFSI marketing email based on the strategy above.

Subject line guidance: The subject line must use a proven open-rate technique (personalised question, curiosity gap, specific number/benefit, or genuine urgency). Reference the target persona's profession or aspiration directly if possible. AVOID generic phrases.

IMPORTANT: The email_body must include this exact URL: {CTA_URL}"""

    data = call_llm_json(SYSTEM_PROMPT, user_prompt)

    email_body = data.get("email_body", "")

    # Guarantee CTA URL is in the body even if LLM missed it
    if CTA_URL not in email_body:
        cta_text = data.get("cta_text", "Explore Now")
        email_body = f"{email_body}\n\n{cta_text}: {CTA_URL}"
        logger.warning("[ContentAgent] CTA URL was missing from body — appended automatically.")

    result = EmailContentOutput(
        subject_line=data.get("subject_line", ""),
        email_body=email_body,
        cta_text=data.get("cta_text", "Explore Now"),
        disclaimer=data.get("disclaimer", ""),
    )

    logger.info(f"[ContentAgent] Email generated. Subject: {result.subject_line}")
    return result
