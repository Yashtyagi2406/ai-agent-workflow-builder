# FlowMind — AI Agent Workflow Builder

A full-stack autonomous AI agent workflow builder and execution engine built with **Nhost** (Postgres + Hasura + Auth + Serverless Functions) and **Next.js 14** (App Router, Apollo Client, TailwindCSS, Glassmorphism UI).

---

## 🌟 Live Demo Deployments

- 🚀 **Live Frontend (Vercel)**: [https://ai-agent-workflow-builder-flax.vercel.app](https://ai-agent-workflow-builder-flax.vercel.app)
- ⚡ **Live GraphQL Engine (Nhost Cloud)**: `https://clhxwjtdykywhpltopmh.hasura.ap-south-1.nhost.run/v1/graphql`
- ⚙️ **Live Serverless Functions**: `https://clhxwjtdykywhpltopmh.functions.ap-south-1.nhost.run/v1`

---

## ✨ Features

- **6 Step Types**:
  - 🤖 `llm_call`: Execute AI prompts via Groq Llama 3.3 70B (with automatic fallback stub).
  - 🌐 `http_request`: Perform GET/POST REST calls to external APIs.
  - 💾 `db_write`: Append structured audit results directly into PostgreSQL.
  - 🔔 `notify`: Send alerts to team channels or email.
  - 🔀 `conditional_branch`: Evaluate JSON logic expressions dynamically to branch execution.
  - ⏸️ `approval_gate`: Pause workflow execution mid-flight until an authorized owner/editor approves.
- **4 Trigger Mechanisms**: Manual execution, Webhook endpoints, Scheduled Cron jobs, and DB Event Triggers.
- **Strict Multi-Tenancy & Access Control**:
  - Hasura Row-Level Security (RLS) + org-level & role-level checks (`owner`, `editor`, `viewer`).
  - Strict cross-org isolation (Org B cannot view/edit/trigger Org A workflows even by pasting real URLs).
- **Live GraphQL Subscriptions**: Real-time step progress and status updates without page refresh.

---

## 🔑 One-Click Demo Credentials

You can use the one-click demo buttons on the login screen, or sign in manually with these pre-seeded accounts (Password: `Password123!`):

| Role | Email | Organization | Permissions |
| :--- | :--- | :--- | :--- |
| 👑 **Org A Owner** | `owner-orga@example.com` | Org A — AI Research | Full create, run, edit, approve & delete permissions |
| ✏️ **Org A Editor** | `editor-orga@example.com` | Org A — AI Research | Create, run, edit & approve permissions |
| 🏢 **Org B Owner** | `owner-orgb@example.com` | Org B — Data Team | Full owner access for Org B (Isolated from Org A) |
| 👁️ **Org B Viewer** | `viewer-orgb@example.com` | Org B — Data Team | Read-only view permissions |

---

## ⚡ Quick Start (Local Setup)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Yashtyagi2406/ai-agent-workflow-builder.git
cd ai-agent-workflow-builder
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

`.env` configuration:
```env
# Local Hasura & Functions
HASURA_GRAPHQL_ADMIN_SECRET=nhost-admin-secret
HASURA_GRAPHQL_URL=http://localhost:8080/v1/graphql

# Groq LLM API Key (optional — leave blank to use disclosed artificial delay stub)
LLM_API_KEY=your_groq_api_key
LLM_PROVIDER=groq

# Frontend Environment Variables
NEXT_PUBLIC_NHOST_SUBDOMAIN=local
NEXT_PUBLIC_NHOST_REGION=
NEXT_PUBLIC_HASURA_URL=http://localhost:8080/v1/graphql
NEXT_PUBLIC_FUNCTIONS_URL=http://localhost:5005
```

### 3. Start Backend Services (Docker Compose)

```bash
npm run db:up
```

This starts:
- **PostgreSQL 15** on port `5432`
- **Hasura GraphQL Engine** on port `8080` (Console available at `http://localhost:8080`)

### 4. Initialize Schema & Seed Demo Data

```bash
npm run seed
```

This runs database migrations, tracks Hasura relationships, sets up action endpoints, and seeds Org A and Org B accounts and sample workflows.

### 5. Start Development Servers

In separate terminals:

```bash
# Terminal 1: Functions Server (Port 5005)
npm run dev:functions

# Terminal 2: Next.js Frontend (Port 3000)
npm run dev:frontend
```

Open `http://localhost:3000` in your browser.

---

## 🧪 Webhook Integration

Trigger any workflow externally via HTTP POST:

```bash
curl -X POST https://clhxwjtdykywhpltopmh.functions.ap-south-1.nhost.run/v1/webhookTrigger \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "workflow_id": "7f937382-7028-4798-8aab-548f3116fbdf",
      "api_key": "demo-webhook-api-key-org-a-2024",
      "payload": { "query": "Latest AI trends 2026" }
    }
  }'
```

---

## 📁 Repository Structure

```
├── nhost/
│   ├── migrations/default/     # PostgreSQL schema migrations
│   ├── metadata/               # Hasura metadata (relationships, permissions, actions)
│   └── functions/              # Serverless Functions
│       ├── triggerWorkflowRun.ts
│       ├── approveStep.ts
│       ├── webhookTrigger.ts
│       ├── scheduledRunner.ts
│       └── server.ts           # Local Node/Express runner
├── frontend/
│   └── src/
│       ├── app/                # Next.js App Router pages
│       ├── components/         # WorkflowBuilder, RunStatus, QuotaIndicator
│       ├── graphql/            # Queries, Mutations, Subscriptions
│       └── lib/                # Apollo Client & DemoSession context
└── scripts/
    ├── init-hasura.ts          # Schema & relationship initialization
    ├── seed.ts                 # Demo data seeder
    └── demo-webhook-curl.sh    # Webhook cURL test script
```

---

## 🛡️ License

MIT License. Developed for the AI Agent Workflow Builder Challenge.
