"""
Agent 1: Campaign Strategy Agent
Interprets the natural-language objective and returns a structured campaign strategy.
"""
import logging
from app.schemas import StrategyOutput
from app.utils.groq_client import call_llm_json

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a senior BFSI (Banking, Financial Services & Insurance) email marketing strategist operating in India.
Your PRIMARY goal is to maximise raw email OPENS and CLICKS for each campaign.

Rules:
- Target audience must be realistic for the Indian BFSI market.
- CTA must always drive readers to: https://superbfsi.com/xdeposit/explore/
- No exaggerated claims. No guaranteed return promises. No RBI/SEBI violations.
- Respond ONLY with a valid JSON object — no markdown, no extra text.

Strategies for high open rates:
- Curiosity-gap or benefit-driven subject lines (e.g. "Your savings could be working harder")
- Personalise by profession/life stage (e.g. "For salaried professionals in India")
- Create mild urgency without being salesy (e.g. "Limited time offer")
- Use a semi-formal or empathetic tone — avoid stiff corporate language

Strategies for high click rates:
- Single, crystal-clear CTA in the email body
- Short email body (3-5 sentences max) — do not bury the CTA
- Lead with the biggest benefit in the first sentence
- Use social proof or data points where appropriate (e.g. "over 2 lakh customers trust us")

Required JSON format:
{
  "campaign_goal": "<clear one-sentence goal focused on driving opens and clicks>",
  "target_persona": "<specific description: profession, age range, income bracket, financial need>",
  "tone": "<semi-formal | empathetic | urgent | conversational>",
  "cta_strategy": "<single clear action: what the email should make the reader click on>",
  "reasoning": "<2-3 sentences explaining why this strategy will maximise opens and clicks for this segment>"
}"""


def run_strategy_agent(objective: str) -> StrategyOutput:
    """
    Run the Campaign Strategy Agent.

    Args:
        objective: Natural language campaign objective.

    Returns:
        StrategyOutput: Structured strategy with reasoning.
    """
    logger.info(f"[StrategyAgent] Processing objective: {objective[:100]}...")

    user_prompt = f"""Campaign Objective:
\"\"\"{objective}\"\"\"

Analyse the above objective and return a campaign strategy JSON."""

    data = call_llm_json(SYSTEM_PROMPT, user_prompt)

    result = StrategyOutput(
        campaign_goal=data.get("campaign_goal", ""),
        target_persona=data.get("target_persona", ""),
        tone=data.get("tone", "formal"),
        cta_strategy=data.get("cta_strategy", ""),
        reasoning=data.get("reasoning", ""),
    )

    logger.info(f"[StrategyAgent] Strategy generated. Goal: {result.campaign_goal[:80]}")
    return result
