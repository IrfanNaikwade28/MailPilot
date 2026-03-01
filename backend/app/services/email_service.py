"""
Email Service
Handles simulated email sending, performance tracking, and the learning loop.
"""
import logging
import random
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignPerformance, SentEmail
from app.models.user import User

logger = logging.getLogger(__name__)


def simulate_send_campaign(db: Session, campaign_id: int) -> CampaignPerformance:
    """
    Simulate sending emails to all segmented users.
    - Store individual SentEmail records.
    - Generate random open/click rates for demo.
    - Create CampaignPerformance record.
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found")
    if campaign.status != "approved":
        raise ValueError(f"Campaign {campaign_id} must be approved before sending")

    segmentation = campaign.segmentation_json or {}
    email_json = campaign.email_json or {}
    selected_ids = segmentation.get("selected_user_ids", [])

    if not selected_ids:
        logger.warning(f"[EmailService] No users selected for campaign {campaign_id}")

    # Fetch selected users
    users = db.query(User).filter(User.id.in_(selected_ids)).all()
    subject = email_json.get("subject_line", "Important Update")

    sent_count = 0
    for user in users:
        sent_email = SentEmail(
            campaign_id=campaign_id,
            recipient_email=user.email,
            recipient_name=user.name,
            subject=subject,
            status="sent",
            sent_at=datetime.now(timezone.utc),
        )
        db.add(sent_email)
        sent_count += 1

    db.flush()

    # Simulate performance metrics
    open_rate = round(random.uniform(0.18, 0.45), 4)
    click_rate = round(random.uniform(0.04, 0.20), 4)
    sentiment_score = round(random.uniform(0.60, 0.95), 4)

    emails_opened = int(sent_count * open_rate)
    emails_clicked = int(sent_count * click_rate)

    performance = CampaignPerformance(
        campaign_id=campaign_id,
        open_rate=open_rate,
        click_rate=click_rate,
        sentiment_score=sentiment_score,
        emails_sent=sent_count,
        emails_opened=emails_opened,
        emails_clicked=emails_clicked,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(performance)

    # Mark campaign as sent
    campaign.status = "sent"
    db.commit()
    db.refresh(performance)

    logger.info(
        f"[EmailService] Sent {sent_count} emails for campaign {campaign_id}. "
        f"Open rate: {open_rate:.1%}, Click rate: {click_rate:.1%}"
    )
    return performance


def seed_demo_users(db: Session) -> int:
    """
    Seed the database with realistic Indian BFSI demo users.
    Returns count of users inserted.
    """
    existing = db.query(User).count()
    if existing > 0:
        logger.info(f"[EmailService] Demo users already exist ({existing} records). Skipping seed.")
        return existing

    demo_users = [
        {"name": "Arjun Sharma", "email": "arjun.sharma@example.in", "state": "Maharashtra", "profession": "Software Engineer", "income": 1400000, "credit_score": 780},
        {"name": "Priya Patel", "email": "priya.patel@example.in", "state": "Gujarat", "profession": "Doctor", "income": 2500000, "credit_score": 820},
        {"name": "Rahul Verma", "email": "rahul.verma@example.in", "state": "Delhi", "profession": "Business Owner", "income": 3200000, "credit_score": 750},
        {"name": "Sneha Reddy", "email": "sneha.reddy@example.in", "state": "Telangana", "profession": "IT Consultant", "income": 1800000, "credit_score": 800},
        {"name": "Vikram Singh", "email": "vikram.singh@example.in", "state": "Punjab", "profession": "Government Employee", "income": 800000, "credit_score": 720},
        {"name": "Anjali Nair", "email": "anjali.nair@example.in", "state": "Kerala", "profession": "Teacher", "income": 600000, "credit_score": 680},
        {"name": "Deepak Joshi", "email": "deepak.joshi@example.in", "state": "Rajasthan", "profession": "Chartered Accountant", "income": 1600000, "credit_score": 790},
        {"name": "Kavitha Krishnan", "email": "kavitha.krishnan@example.in", "state": "Tamil Nadu", "profession": "Software Engineer", "income": 1200000, "credit_score": 760},
        {"name": "Mohit Agarwal", "email": "mohit.agarwal@example.in", "state": "Uttar Pradesh", "profession": "Business Owner", "income": 2800000, "credit_score": 710},
        {"name": "Ritu Gupta", "email": "ritu.gupta@example.in", "state": "Madhya Pradesh", "profession": "Nurse", "income": 450000, "credit_score": 640},
        {"name": "Suresh Iyer", "email": "suresh.iyer@example.in", "state": "Karnataka", "profession": "Lawyer", "income": 2200000, "credit_score": 810},
        {"name": "Meena Bhatt", "email": "meena.bhatt@example.in", "state": "Gujarat", "profession": "Homemaker", "income": 300000, "credit_score": 600},
        {"name": "Aakash Malhotra", "email": "aakash.malhotra@example.in", "state": "Delhi", "profession": "Investment Banker", "income": 5000000, "credit_score": 850},
        {"name": "Pooja Yadav", "email": "pooja.yadav@example.in", "state": "Bihar", "profession": "Government Employee", "income": 700000, "credit_score": 690},
        {"name": "Ramesh Naidu", "email": "ramesh.naidu@example.in", "state": "Andhra Pradesh", "profession": "Farmer", "income": 250000, "credit_score": 580},
        {"name": "Nisha Choudhary", "email": "nisha.choudhary@example.in", "state": "Haryana", "profession": "HR Manager", "income": 1100000, "credit_score": 730},
        {"name": "Sanjeev Kumar", "email": "sanjeev.kumar@example.in", "state": "West Bengal", "profession": "Doctor", "income": 2100000, "credit_score": 800},
        {"name": "Lalitha Murthy", "email": "lalitha.murthy@example.in", "state": "Karnataka", "profession": "Professor", "income": 900000, "credit_score": 740},
        {"name": "Vishal Thakur", "email": "vishal.thakur@example.in", "state": "Himachal Pradesh", "profession": "Software Engineer", "income": 1500000, "credit_score": 770},
        {"name": "Sunita Pandey", "email": "sunita.pandey@example.in", "state": "Uttarakhand", "profession": "Business Owner", "income": 1900000, "credit_score": 755},
        {"name": "Girish Menon", "email": "girish.menon@example.in", "state": "Kerala", "profession": "Chartered Accountant", "income": 1700000, "credit_score": 785},
        {"name": "Rekha Srivastava", "email": "rekha.srivastava@example.in", "state": "Uttar Pradesh", "profession": "Teacher", "income": 550000, "credit_score": 660},
        {"name": "Kiran Desai", "email": "kiran.desai@example.in", "state": "Maharashtra", "profession": "Architect", "income": 2000000, "credit_score": 795},
        {"name": "Tanvir Ahmed", "email": "tanvir.ahmed@example.in", "state": "West Bengal", "profession": "IT Consultant", "income": 1300000, "credit_score": 745},
        {"name": "Bharati Patil", "email": "bharati.patil@example.in", "state": "Maharashtra", "profession": "Nurse", "income": 480000, "credit_score": 635},
        {"name": "Harish Garg", "email": "harish.garg@example.in", "state": "Punjab", "profession": "Business Owner", "income": 4000000, "credit_score": 830},
        {"name": "Meghna Pillai", "email": "meghna.pillai@example.in", "state": "Kerala", "profession": "Software Engineer", "income": 1600000, "credit_score": 775},
        {"name": "Rajesh Tiwari", "email": "rajesh.tiwari@example.in", "state": "Madhya Pradesh", "profession": "Government Employee", "income": 650000, "credit_score": 695},
        {"name": "Anita Jain", "email": "anita.jain@example.in", "state": "Rajasthan", "profession": "Jeweller", "income": 3500000, "credit_score": 820},
        {"name": "Prakash Nambiar", "email": "prakash.nambiar@example.in", "state": "Tamil Nadu", "profession": "Lawyer", "income": 1900000, "credit_score": 800},
    ]

    for u in demo_users:
        db.add(User(**u))

    db.commit()
    logger.info(f"[EmailService] Seeded {len(demo_users)} demo users.")
    return len(demo_users)
