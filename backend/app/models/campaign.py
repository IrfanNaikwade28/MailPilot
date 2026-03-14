from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Float, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    objective = Column(Text, nullable=False)
    strategy_json = Column(JSON, nullable=True)
    email_json = Column(JSON, nullable=True)
    segmentation_json = Column(JSON, nullable=True)
    compliance_json = Column(JSON, nullable=True)
    status = Column(String(20), default="draft")  # draft | approved | rejected | sent
    approved_by = Column(String(100), nullable=True)
    approval_timestamp = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    send_time = Column(String(30), nullable=True)           # scheduled send time (IST) 'DD:MM:YY HH:MM:SS'
    campaignx_campaign_id = Column(String(100), nullable=True)  # UUID from InXiteOut send_campaign API
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CampaignPerformance(Base):
    __tablename__ = "campaign_performance"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, nullable=False, index=True)
    open_rate = Column(Float, nullable=True)
    click_rate = Column(Float, nullable=True)
    sentiment_score = Column(Float, nullable=True)
    emails_sent = Column(Integer, default=0)
    emails_opened = Column(Integer, default=0)
    emails_clicked = Column(Integer, default=0)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SentEmail(Base):
    __tablename__ = "sent_emails"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, nullable=False, index=True)
    recipient_email = Column(String(150), nullable=False)
    recipient_name = Column(String(100), nullable=False)
    subject = Column(String(300), nullable=False)
    status = Column(String(20), default="sent")  # sent | opened | clicked
    sent_at = Column(DateTime(timezone=True), server_default=func.now())


class CampaignCoverage(Base):
    """
    Tracks which customer_id has been targeted by which campaign.
    Used to:
    - Ensure full 1000-customer cohort coverage
    - Prevent duplicate targeting in subsequent campaigns
    - Drive the optimization loop (target only non-openers / non-clickers)
    """
    __tablename__ = "campaign_coverage"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, nullable=False, index=True)
    customer_id = Column(String(20), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("campaign_id", "customer_id", name="uq_campaign_customer"),
    )
