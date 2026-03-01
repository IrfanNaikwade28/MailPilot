"""
Agent 1: Campaign Strategy Agent
Interprets the natural-language objective and returns a structured campaign strategy.
"""
import logging
from app.schemas import StrategyOutput
from app.utils.groq_client import call_llm_json

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a senior BFSI (Banking, Financial Services & Insurance) marketing strategist operating in India.
Your task is to analyse a campaign objective and produce a concise, structured campaign strategy.

Rules:
- Target audience must be realistic for the Indian BFSI market.
- Tone must be professional, compliant and empathetic.
- CTA strategy must align with RBI/SEBI/IRDAI regulatory guidelines.
- No exaggerated claims. No guaranteed return promises.
- Respond ONLY with a valid JSON object — no markdown, no extra text.

Required JSON format:
{
  "campaign_goal": "<clear one-sentence goal>",
  "target_persona": "<description: profession, age range, income bracket, financial need>",
  "tone": "<formal | semi-formal | empathetic | urgent | informational>",
  "cta_strategy": "<what action the email should drive the reader to take>",
  "reasoning": "<2-3 sentences explaining why this strategy fits the objective>"
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
