from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


# ─── User Schemas ─────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    name: str
    email: str
    state: str
    profession: str
    income: float
    credit_score: int


class UserCreate(UserBase):
    pass


class UserRead(UserBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Agent Output Schemas ──────────────────────────────────────────────────────

class StrategyOutput(BaseModel):
    campaign_goal: str
    target_persona: str
    tone: str
    cta_strategy: str
    reasoning: str


class EmailContentOutput(BaseModel):
    subject_line: str
    email_body: str
    cta_text: str
    disclaimer: str


class SegmentationOutput(BaseModel):
    filters_applied: str
    selected_user_count: int
    selected_user_ids: List[str]
    reasoning: str


class ComplianceOutput(BaseModel):
    is_compliant: bool
    issues_found: List[str]
    suggested_fixes: List[str]


# ─── Campaign Schemas ──────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    objective: str = Field(..., min_length=10, description="Natural language campaign objective")


class CampaignRead(BaseModel):
    id: int
    objective: str
    strategy_json: Optional[Dict[str, Any]] = None
    email_json: Optional[Dict[str, Any]] = None
    segmentation_json: Optional[Dict[str, Any]] = None
    compliance_json: Optional[Dict[str, Any]] = None
    status: str
    approved_by: Optional[str] = None
    approval_timestamp: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    send_time: Optional[str] = None
    campaignx_campaign_id: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CampaignApprove(BaseModel):
    approved_by: str = Field(..., description="Name or ID of the approver")
    action: str = Field(..., description="approve or reject")
    rejection_reason: Optional[str] = None
    send_time: Optional[str] = None  # 'DD:MM:YY HH:MM:SS' IST — set on approval


class CampaignEdit(BaseModel):
    subject_line: Optional[str] = None
    email_body: Optional[str] = None
    cta_text: Optional[str] = None
    disclaimer: Optional[str] = None


# ─── Performance Schemas ───────────────────────────────────────────────────────

class CampaignPerformanceRead(BaseModel):
    id: int
    campaign_id: int
    open_rate: Optional[float] = None
    click_rate: Optional[float] = None
    sentiment_score: Optional[float] = None
    emails_sent: int
    emails_opened: int
    emails_clicked: int
    sent_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CampaignAnalytics(BaseModel):
    campaign: CampaignRead
    performance: Optional[CampaignPerformanceRead] = None
    learning_insights: Optional[Dict[str, Any]] = None


# ─── Orchestrator Output ───────────────────────────────────────────────────────

class OrchestratorResult(BaseModel):
    campaign_id: int
    strategy: StrategyOutput
    email_content: EmailContentOutput
    segmentation: SegmentationOutput
    compliance: ComplianceOutput
    compliance_retries: int
    summary_explanation: str
    status: str


# ─── API Response Wrappers ─────────────────────────────────────────────────────

class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None


# ─── Optimization Loop ─────────────────────────────────────────────────────────

class OptimizationRequest(BaseModel):
    approved_by: str = Field(..., description="Approver name for the optimized variant")
    send_time: Optional[str] = None  # if None, agent auto-schedules


class OptimizationResult(BaseModel):
    original_campaign_id: int
    new_campaign_id: int
    strategy: StrategyOutput
    email_content: EmailContentOutput
    segmentation: SegmentationOutput
    compliance: ComplianceOutput
    compliance_retries: int
    summary_explanation: str
    optimization_reasoning: str
    status: str


# ─── Coverage Tracking (Final Round) ──────────────────────────────────────────

class CoverageStats(BaseModel):
    """
    Coverage statistics for the 1000-customer cohort.
    Scoring is based on maximizing total EO=Y + EC=Y raw counts across the cohort.
    All 1000 customers must be covered before the evaluation window closes.
    """
    total_cohort_size: int
    covered_count: int
    uncovered_count: int
    coverage_percent: float
    covered_ids: List[str]
    uncovered_ids: List[str]


class CampaignCoverageRead(BaseModel):
    id: int
    campaign_id: int
    customer_id: str
    timestamp: Optional[datetime] = None

    class Config:
        from_attributes = True
