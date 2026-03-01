"""
Agent 4: Compliance Agent
Checks email content for BFSI regulatory compliance (RBI/SEBI/IRDAI guidelines).
"""
import logging
from app.schemas import EmailContentOutput, ComplianceOutput
from app.utils.groq_client import call_llm_json

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a BFSI regulatory compliance officer in India specialising in email marketing.
You review marketing emails for compliance with RBI, SEBI, and IRDAI guidelines.

Check for the following violations:
1. Misleading or exaggerated financial claims (e.g., "guaranteed returns", "risk-free", "best in India").
2. Missing or inadequate disclaimer — must mention the applicable regulator (RBI/SEBI/IRDAI).
3. Informal or unprofessional tone (slang, casual language, clickbait subject lines).
4. Unverified superlatives (e.g., "lowest rates", "highest returns") without qualifying language.
5. Pressure tactics (e.g., "Act NOW or lose forever", countdown timers implied).
6. Missing CTA or vague CTA that could mislead the reader.
7. Personal data privacy concerns or collection of sensitive info without consent language.

Respond ONLY with valid JSON — no markdown, no extra text.

Required JSON format:
{
  "is_compliant": true or false,
  "issues_found": ["<issue 1>", "<issue 2>"],
  "suggested_fixes": ["<fix for issue 1>", "<fix for issue 2>"]
}

If fully compliant, return empty arrays for issues_found and suggested_fixes."""


def run_compliance_agent(email_content: EmailContentOutput) -> ComplianceOutput:
    """
    Run the Compliance Agent on email content.

    Args:
        email_content: Output from the Email Content Agent.

    Returns:
        ComplianceOutput: Compliance status, issues, and suggested fixes.
    """
    logger.info(f"[ComplianceAgent] Reviewing email: '{email_content.subject_line}'")

    user_prompt = f"""Email to Review:

Subject Line: {email_content.subject_line}

Email Body:
{email_content.email_body}

CTA Text: {email_content.cta_text}

Disclaimer:
{email_content.disclaimer}

Review this BFSI marketing email for compliance violations."""

    data = call_llm_json(SYSTEM_PROMPT, user_prompt)

    result = ComplianceOutput(
        is_compliant=bool(data.get("is_compliant", False)),
        issues_found=data.get("issues_found", []),
        suggested_fixes=data.get("suggested_fixes", []),
    )

    if result.is_compliant:
        logger.info("[ComplianceAgent] Email is COMPLIANT.")
    else:
        logger.warning(f"[ComplianceAgent] Email FAILED compliance. Issues: {result.issues_found}")

    return result
