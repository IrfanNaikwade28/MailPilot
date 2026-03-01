# BFSI Multi-Agent Email Marketing System

A production-ready multi-agent AI web application for planning, generating, and managing BFSI (Banking, Financial Services & Insurance) email marketing campaigns across India.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)               │
│  Dashboard → Create → Strategy Preview → Email Preview →    │
│            Approval Dashboard → Analytics                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP / REST (Axios)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI + Python)                  │
│  POST /campaign/create  GET /campaign/:id  POST /:id/approve │
│  POST /:id/send         GET /:id/analytics                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌─────────────────┐      ┌──────────────────────┐
│  Orchestrator   │      │  PostgreSQL Database  │
│  Agent          │      │  Users / Campaigns /  │
│                 │      │  Performance / Emails  │
│  ┌───────────┐  │      └──────────────────────┘
│  │ Strategy  │  │
│  │ Agent     │  │
│  └─────┬─────┘  │
│        ▼        │
│  ┌───────────┐  │
│  │ Content   │  │
│  │ Agent     │  │
│  └─────┬─────┘  │
│        ▼        │
│  ┌───────────┐  │      ┌─────────────────────┐
│  │Compliance │◄─┼──────│  Groq API            │
│  │ Agent     │  │      │  LLaMA3-70B-8192     │
│  └─────┬─────┘  │      └─────────────────────┘
│  (retry loop)   │
│        ▼        │
│  ┌───────────┐  │
│  │Segmentation│ │
│  │ Agent     │  │
│  └─────┬─────┘  │
└────────┼────────┘
         ▼
   Human Approval
   (Approve/Edit/Reject)
         ▼
   Email Send Simulation
         ▼
   Analytics + Learning Loop
```

---

## Multi-Agent System Design

### Agent 1 — Strategy Agent (`strategy_agent.py`)
- **Input:** Natural language campaign objective
- **Output:** `{ campaign_goal, target_persona, tone, cta_strategy, reasoning }`
- **Role:** Interprets intent and produces a structured BFSI campaign strategy

### Agent 2 — Content Agent (`content_agent.py`)
- **Input:** Strategy output (+ optional compliance revision notes)
- **Output:** `{ subject_line, email_body, cta_text, disclaimer }`
- **Role:** Generates professional BFSI-compliant email copy; accepts revision notes for re-generation

### Agent 3 — Compliance Agent (`compliance_agent.py`)
- **Input:** Email content object
- **Output:** `{ is_compliant, issues_found, suggested_fixes }`
- **Role:** Reviews email against RBI/SEBI/IRDAI guidelines; detects misleading claims, missing disclaimers, informal tone

### Agent 4 — Segmentation Agent (`segmentation_agent.py`)
- **Input:** Target persona string + all users from DB
- **Output:** `{ filters_applied, selected_user_count, selected_user_ids, reasoning }`
- **Role:** Uses LLM to extract filter criteria (profession, state, income, credit score) then applies them to the DB

### Agent 5 — Orchestrator (`orchestrator.py`)
- **Role:** Coordinates all agents in sequence
- **Flow:**
  ```
  Strategy Agent
      → Content Agent
      → Compliance Agent
          → (if fail) back to Content Agent (max 3 retries)
      → Segmentation Agent
      → Aggregate final result + generate summary explanation
  ```

---

## Compliance Logic

The Compliance Agent checks for:
1. **Misleading financial claims** — "guaranteed returns", "risk-free", "best in India"
2. **Missing disclaimer** — must mention RBI/SEBI/IRDAI
3. **Informal tone** — slang, clickbait, casual language
4. **Unverified superlatives** — without qualifying language
5. **Pressure tactics** — urgency manipulation
6. **Vague CTA** — unclear call-to-action

If non-compliant, the orchestrator sends revision notes back to the Content Agent and retries (up to `MAX_COMPLIANCE_RETRIES` times, default 3).

---

## Human-in-the-Loop Workflow

1. AI pipeline runs → campaign created in **draft** state
2. Full preview shown to human reviewer (strategy, email, segmentation, compliance)
3. Human can **edit** email fields (subject, body, CTA, disclaimer)
4. Human **approves** or **rejects** with their name and optional reason
5. Only approved campaigns can proceed to **send**
6. `approved_by` and `approval_timestamp` are stored in DB

---

## Learning Loop

After a campaign is sent, `GET /campaign/:id/analytics` returns learning insights:

- If `open_rate > threshold (0.25)` → **Reinforce** current tone and persona targeting
- If `open_rate <= threshold` → **Recommend** tone adjustment and persona refinement
- Click-through assessment for CTA effectiveness

---

## Project Structure

```
MultiAgent Email Marketing System/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan
│   │   ├── config.py            # Pydantic Settings (env-based)
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   ├── models/
│   │   │   ├── user.py          # User ORM model
│   │   │   └── campaign.py      # Campaign, CampaignPerformance, SentEmail
│   │   ├── schemas/
│   │   │   └── schemas.py       # All Pydantic schemas
│   │   ├── agents/
│   │   │   ├── strategy_agent.py
│   │   │   ├── content_agent.py
│   │   │   ├── segmentation_agent.py
│   │   │   ├── compliance_agent.py
│   │   │   └── orchestrator.py
│   │   ├── services/
│   │   │   ├── campaign_service.py
│   │   │   └── email_service.py
│   │   ├── api/
│   │   │   └── routes.py
│   │   └── utils/
│   │       └── groq_client.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/client.js        # Axios API client
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── AgentCard.jsx
    │   │   └── StatusBadge.jsx
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── CreateCampaign.jsx
    │   │   ├── CampaignPreview.jsx
    │   │   ├── EmailPreview.jsx
    │   │   ├── ApprovalDashboard.jsx
    │   │   └── Analytics.jsx
    │   ├── App.jsx
    │   └── main.jsx
    ├── vite.config.js
    └── .env.example
```

---

## Setup Instructions

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Groq API key (free at https://console.groq.com)

### 1. Database Setup

```bash
psql -U postgres
CREATE DATABASE email_marketing;
\q
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtualenv
python3 -m venv venv
source venv/bin/activate        # Linux/macOS
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env — set GROQ_API_KEY and DATABASE_URL

# Run the server
uvicorn app.main:app --reload --port 8000
```

The backend will auto-create all database tables on first run.

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

### 4. Seed Demo Users

After both servers are running, either:
- Click the **"Seed Users"** button on the Create Campaign page, or
- Call `POST http://localhost:8000/api/v1/admin/seed-users`

---

## API Documentation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/campaign/create` | Create campaign + run full agent pipeline |
| `GET`  | `/api/v1/campaign/list` | List all campaigns |
| `GET`  | `/api/v1/campaign/{id}` | Get campaign by ID |
| `PATCH`| `/api/v1/campaign/{id}/edit` | Edit email fields (human review) |
| `POST` | `/api/v1/campaign/{id}/approve` | Approve or reject campaign |
| `POST` | `/api/v1/campaign/{id}/send` | Simulate email sending |
| `GET`  | `/api/v1/campaign/{id}/analytics` | Get analytics + learning insights |
| `GET`  | `/api/v1/users` | List all users |
| `POST` | `/api/v1/users` | Create a user |
| `POST` | `/api/v1/admin/seed-users` | Seed 30 demo users (idempotent) |
| `GET`  | `/api/v1/health` | Health check |

Full interactive docs: `http://localhost:8000/docs` (Swagger UI)

### Example: Create Campaign

```bash
curl -X POST http://localhost:8000/api/v1/campaign/create \
  -H "Content-Type: application/json" \
  -d '{"objective": "Promote our new home loan product targeting salaried professionals in Maharashtra"}'
```

### Example: Approve Campaign

```bash
curl -X POST http://localhost:8000/api/v1/campaign/1/approve \
  -H "Content-Type: application/json" \
  -d '{"approved_by": "Priya Sharma", "action": "approve"}'
```

---

## Environment Variables

### Backend (`.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/email_marketing` |
| `GROQ_API_KEY` | Your Groq API key | _(required)_ |
| `GROQ_MODEL` | LLM model identifier | `llama3-70b-8192` |
| `OPEN_RATE_THRESHOLD` | Threshold for learning loop | `0.25` |
| `MAX_COMPLIANCE_RETRIES` | Max compliance re-generation attempts | `3` |
| `ALLOWED_ORIGINS` | CORS allowed origins (JSON array) | `["http://localhost:5173"]` |

### Frontend (`.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000/api/v1` |

---

## Design Decisions

- **Structured JSON communication** — every agent uses `call_llm_json()` which strips markdown fences and validates JSON before processing. This ensures deterministic inter-agent data exchange.
- **Compliance retry loop** — the orchestrator retries content generation up to `MAX_COMPLIANCE_RETRIES` times, passing the compliance agent's `issues_found` and `suggested_fixes` as revision notes to the content agent.
- **Segmentation uses LLM + deterministic filter** — the LLM extracts structured filter criteria from the free-text persona description; the actual filtering is then done deterministically in Python against the database, ensuring reproducibility.
- **Simulated email sending** — `SentEmail` records are stored per recipient; open/click rates are randomly simulated for demo purposes.
- **Learning loop is stateless** — insights are computed on-the-fly from stored performance data; no separate ML model needed for the demo.
