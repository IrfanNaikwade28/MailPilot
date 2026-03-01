# MailPilot — AI Multi-Agent BFSI Email Marketing System

**FrostHack / XPECTO 2026 @ IIT Mandi — CampaignX Hackathon by InXiteOut**
Team: **CodeAkatsuki**

MailPilot is a production-ready multi-agent AI web application for planning, generating, and autonomously optimising BFSI (Banking, Financial Services & Insurance) email marketing campaigns across India. It integrates directly with the **InXiteOut CampaignX live API** — real 5000-customer cohort, real sends, real open/click metrics.

---

## Live Test Results

| Campaign | Objective | Recipients | Open Rate | Click Rate |
|----------|-----------|------------|-----------|------------|
| #5 | Home loan — salaried professionals | 800 | 17.0% | 8.5% |
| #6 | Credit card — IT professionals | 170 | 17.6% | 8.8% |
| #8 | Health savings — doctors/nurses | 520 | 18.1% | 8.5% |
| #9 | Business loan — entrepreneurs | 492 | 18.9% | 8.7% |
| #10 | High-yield FD — broad salaried | 867 | 16.4% | 8.0% |

**Total emails sent: 2,849 across 5 live campaigns**
All metrics sourced directly from InXiteOut `GET /api/v1/get_report`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React + Vite)                    │
│  Dashboard → Create → Campaign Preview → Email Preview →    │
│            Approval Dashboard → Analytics                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP / REST (Axios, 3 min timeout)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend (FastAPI + Python)                   │
│  /campaign/create   /campaign/:id/approve                    │
│  /campaign/:id/send /campaign/:id/analytics                  │
│  /campaign/:id/optimize  /admin/refresh-cohort               │
└──────────┬──────────────────────────┬────────────────────────┘
           │                          │
           ▼                          ▼
┌────────────────────┐    ┌─────────────────────────────────┐
│   Orchestrator     │    │  InXiteOut CampaignX API (LIVE) │
│                    │    │  GET  /api/v1/get_customer_cohort│
│  Strategy Agent    │    │  POST /api/v1/send_campaign      │
│       ↓            │    │  GET  /api/v1/get_report         │
│  Content Agent     │◄───┤  (5000 real customers, IST time) │
│       ↓            │    └─────────────────────────────────┘
│  Compliance Agent  │    ┌─────────────────────────────────┐
│  (retry loop ≤3)   │    │  Groq API (LLM Brain)           │
│       ↓            │◄───┤  llama-3.3-70b-versatile        │
│  Segmentation Agent│    │  All agent reasoning + tool     │
│       ↓            │    │  selection (dynamic discovery)  │
│  Human Approval    │    └─────────────────────────────────┘
│       ↓            │    ┌─────────────────────────────────┐
│  Send + Report     │    │  SQLite DB (email_marketing.db) │
└────────────────────┘    │  Campaign / Performance tables  │
                          └─────────────────────────────────┘
```

---

## Multi-Agent Pipeline

### Agent 1 — Strategy Agent
- **Input:** Natural language campaign objective
- **Output:** `{ campaign_goal, target_persona, tone, cta_strategy, reasoning }`
- **Role:** Interprets intent and produces a structured BFSI campaign strategy compliant with RBI/SEBI/IRDAI guidelines

### Agent 2 — Content Agent
- **Input:** Strategy output + optional compliance revision notes
- **Output:** `{ subject_line, email_body, cta_text, disclaimer }`
- **Role:** Generates professional BFSI-compliant email copy with high-converting subject lines (personalised question, curiosity gap, specific numbers, genuine urgency); enforces CTA URL `https://superbfsi.com/xdeposit/explore/`

### Agent 3 — Compliance Agent
- **Input:** Email content
- **Output:** `{ is_compliant, issues_found, suggested_fixes }`
- **Role:** Reviews email against RBI/SEBI/IRDAI guidelines — detects misleading claims, missing disclaimers, informal tone; feeds revision notes back to Content Agent (up to 3 retries)

### Agent 4 — Segmentation Agent
- **Input:** Target persona + real 5000-customer cohort
- **Output:** `{ filters_applied, selected_user_count, selected_user_ids, reasoning }`
- **Role:** LLM extracts filter criteria from persona (occupation keywords, cities, income range, credit score, app/social engagement signals); deterministic Python filter applied to cohort — 25 exact occupation values, 20 exact city spellings, city alias map (Bangalore→Bengaluru)

### Agent 5 — Orchestrator
- **Role:** Coordinates all agents; builds summary explanation; runs autonomous optimization loop

---

## Dynamic Tool Discovery

The InXiteOut API client (`utils/inxiteout_api.py`) implements **LLM-based dynamic tool discovery**:

1. Fetches live OpenAPI spec from `https://campaignx.inxiteout.ai/openapi.json`
2. LLM selects the correct tool (returns only `tool_name / method / path` — 3 fields)
3. **Actual payload is injected by the caller** — LLM never touches email bodies or ID lists
4. This prevents truncation of 500+ customer ID lists and long email bodies

---

## Human-in-the-Loop Workflow

1. AI pipeline runs → campaign created in **draft** state
2. Full preview shown: strategy, email content, segmentation map, compliance status
3. Human can **edit** email fields (subject, body, CTA, disclaimer)
4. Human **approves** with name + picks send time (IST datetime picker), or **rejects** with reason
5. Send dispatched to InXiteOut CampaignX API
6. Real open/click metrics fetched from `get_report` API and stored
7. Analytics page shows learning insights + optimization trigger

---

## Autonomous Optimization Loop

`POST /campaign/:id/optimize` triggers:

1. Reads real performance from the sent campaign
2. Builds enriched objective with performance context (open rate, click rate, tone, persona, subject)
3. Directs agents to improve: subject line, tone, or target a higher-engagement micro-segment
4. Runs full pipeline → new campaign auto-approved → sent via CampaignX API
5. Returns `OptimizationResult` for human visibility

---

## Project Structure

```
MultiAgent Email Marketing System/
├── backend/
│   ├── .env                        # GROQ_API_KEY, CAMPAIGNX_API_KEY, APP_NAME="MailPilot"
│   ├── email_marketing.db          # SQLite — Campaign, CampaignPerformance tables
│   └── app/
│       ├── main.py                 # FastAPI app, CORS, lifespan
│       ├── config.py               # Pydantic Settings (env-based)
│       ├── database.py             # SQLAlchemy engine + session
│       ├── models/campaign.py      # Campaign, CampaignPerformance ORM models
│       ├── schemas/schemas.py      # All Pydantic v2 schemas
│       ├── agents/
│       │   ├── strategy_agent.py   # Agent 1: campaign strategy
│       │   ├── content_agent.py    # Agent 2: email copy + high-converting subjects
│       │   ├── compliance_agent.py # Agent 3: RBI/SEBI/IRDAI compliance check
│       │   ├── segmentation_agent.py # Agent 4: real cohort filtering
│       │   └── orchestrator.py     # Agent 5: coordination + optimization
│       ├── services/
│       │   └── campaign_service.py # DB ops, send, metrics, optimization loop
│       ├── api/routes.py           # All 10 REST endpoints
│       └── utils/
│           ├── groq_client.py      # Groq LLM client
│           └── inxiteout_api.py    # Dynamic tool discovery client
└── frontend/
    ├── index.html                  # <title>MailPilot</title>
    └── src/
        ├── api/client.js           # Axios client (3 min timeout)
        ├── components/
        │   ├── Navbar.jsx          # MailPilot branding
        │   └── StatusBadge.jsx
        └── pages/
            ├── Dashboard.jsx
            ├── CreateCampaign.jsx  # Real cohort info banner
            ├── CampaignPreview.jsx
            ├── EmailPreview.jsx
            ├── ApprovalDashboard.jsx # IST send time picker
            └── Analytics.jsx       # Send + optimization loop panels
```

---

## Setup & Running

### Prerequisites
- Python 3.11+ with venv
- Node.js 18+
- Groq API key (free at https://console.groq.com)

### Backend

```bash
cd "MultiAgent Email Marketing System/backend"

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure .env: GROQ_API_KEY, CAMPAIGNX_API_KEY, CAMPAIGNX_API_BASE
cp .env.example .env

# Start server (NO --reload flag)
venv/bin/uvicorn app.main:app --port 8000
```

### Frontend

```bash
cd "MultiAgent Email Marketing System/frontend"
npm install
npm run dev
# → http://localhost:5173
```

### Interactive API Docs
`http://localhost:8000/docs` (Swagger UI)

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/campaign/create` | Create campaign + run full agent pipeline |
| `GET`  | `/api/v1/campaign/list` | List all campaigns (newest first) |
| `GET`  | `/api/v1/campaign/{id}` | Get campaign by ID |
| `PATCH`| `/api/v1/campaign/{id}/edit` | Edit email fields (human review) |
| `POST` | `/api/v1/campaign/{id}/approve` | Approve or reject campaign (with send_time) |
| `POST` | `/api/v1/campaign/{id}/send` | Send via InXiteOut CampaignX API |
| `GET`  | `/api/v1/campaign/{id}/analytics` | Analytics + learning insights |
| `POST` | `/api/v1/campaign/{id}/optimize` | Autonomous optimization loop |
| `POST` | `/api/v1/admin/refresh-cohort` | Force-refresh 5000-customer cohort |
| `GET`  | `/api/v1/health` | Health check |

---

## Environment Variables

### Backend (`.env`)

| Variable | Description |
|----------|-------------|
| `APP_NAME` | `MailPilot` |
| `DATABASE_URL` | `sqlite:///./email_marketing.db` |
| `GROQ_API_KEY` | Groq API key (required) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `CAMPAIGNX_API_KEY` | InXiteOut CampaignX API key |
| `CAMPAIGNX_API_BASE` | `https://campaignx.inxiteout.ai` |
| `OPEN_RATE_THRESHOLD` | `0.25` (triggers optimization recommendation) |
| `MAX_COMPLIANCE_RETRIES` | `3` |
| `ALLOWED_ORIGINS` | `["http://localhost:5173"]` |

---

## Key Design Decisions

- **LLM selection-only tool discovery** — LLM chooses the API tool (3-field JSON) but never constructs the payload, preventing truncation of large bodies and ID lists.
- **Deterministic segmentation** — LLM extracts filter criteria; Python applies them. Reproducible, auditable, no hallucinated customer IDs.
- **Compliance retry loop** — Content Agent regenerates email up to 3 times with precise revision notes from Compliance Agent.
- **City alias map** — `Bangalore → Bengaluru`, `Bombay → Mumbai` etc. ensures LLM-generated city names match exact cohort spellings.
- **Engagement signal filters** — Segmentation Agent can filter on `App_Installed` and `Social_Media_Active` to target digitally-active customers.
- **SQLite for portability** — no PostgreSQL install required; schema auto-created on first run.
- **No `--reload`** — cohort is cached in memory; reload would clear cache and waste API rate limit calls.
