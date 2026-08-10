# FlowMind — AI Agent Workflow Builder

A full-stack application for chaining AI agent steps into automated workflows, built with nhost (Postgres + Hasura + Auth + Functions) and Next.js 14.

## Features

- **6 step types**: `llm_call`, `http_request`, `db_write`, `notify`, `conditional_branch`, `approval_gate`
- **4 trigger types**: Manual, Webhook, Scheduled (cron), Database Event
- **Two permission layers**: org + role scoping (Hasura) + step-level gating (DB trigger + Action handler)
- **Live subscriptions**: Step-by-step progress with no page refresh
- **Approval gate**: Workflow pauses mid-execution; approver resumes via Action handler with re-verified role check

---

## Prerequisites

- [nhost CLI](https://docs.nhost.io/local-development) v1.x
- Docker + Docker Compose
- Node.js 18+
- `npx ts-node` for the seed script

---

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/Yashtyagi2406/ai-agent-workflow-builder.git
cd ai-agent-workflow-builder
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
# For local dev (nhost CLI), these are automatically set:
HASURA_GRAPHQL_ADMIN_SECRET=nhost-admin-secret
NHOST_SUBDOMAIN=local
NHOST_REGION=

# Optional — for real LLM calls:
LLM_API_KEY=your_groq_api_key_here
LLM_PROVIDER=groq  # or openrouter

# Frontend (same values for local):
NEXT_PUBLIC_NHOST_SUBDOMAIN=local
NEXT_PUBLIC_NHOST_REGION=
NEXT_PUBLIC_FUNCTIONS_URL=http://localhost:3000
```

> **No LLM key?** Leave `LLM_API_KEY` empty. The `llm_call` step will use a disclosed stub — 800ms artificial delay + fake response. This is explicitly allowed by the assignment spec and the UI shows stub responses clearly.

### 3. Start nhost (applies migrations + metadata automatically)

```bash
nhost up
```

This starts:
- PostgreSQL on port `5432`
- Hasura on port `8080` (console at http://localhost:8080)
- Auth service on port `4000`
- Functions runtime on port `3000`

### 4. Install function dependencies

```bash
cd nhost/functions && npm install && cd ../..
```

### 5. Seed demo data

```bash
npx ts-node scripts/seed.ts
```

This creates:
- **Org A** with 2 users: `owner-orga@example.com` (owner) and `editor-orga@example.com` (editor)
- **Org B** with 2 users: `owner-orgb@example.com` (owner) and `viewer-orgb@example.com` (viewer)
- A sample 5-step workflow in Org A with manual + webhook triggers

All passwords: `Password123!`

### 6. Run the frontend

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:3001

---

## Local Hasura Console

Open http://localhost:8080 — admin secret is `nhost-admin-secret` for local dev.

---

## Final Task Scenario (End-to-End Demo)

### Prerequisites
- Seed script must have run successfully

### Step 1: Two orgs exist
Log in as `owner-orga@example.com` — see Org A. Open a different browser/incognito and log in as `owner-orgb@example.com` — see Org B. Separate orgs, separate data.

### Step 2: Build a workflow (Org A)
The seed script creates a demo workflow with: `llm_call → http_request → conditional_branch → approval_gate → db_write`.

### Step 3: Trigger manually
Click **Run Workflow** — watch the live subscription update each step in real time without a page refresh.

### Step 4: Trigger via webhook
```bash
curl -X POST http://localhost:3000/webhookTrigger \
  -H "Content-Type: application/json" \
  -d '{"input":{"workflow_id":"WORKFLOW_ID_HERE","api_key":"demo-webhook-api-key-org-a-2024"}}'
```
A new run appears in the run history live.

### Step 5: Approval gate
When the run hits the `approval_gate` step, the run pauses. An amber banner appears. Click **Approve & Continue** — the run resumes and completes.

### Step 6: Cross-org isolation test
As Org B's owner (`owner-orgb@example.com`):
1. Try navigating to `/orgs/ORG_A_ID` — shows 404 or empty
2. Try triggering Org A's workflow via GraphQL:
   ```graphql
   mutation { triggerWorkflowRun(workflow_id: "ORG_A_WORKFLOW_ID") { status } }
   ```
   → Returns 403 (not a member of that org)
3. Try querying Org A's step_runs directly → returns empty array (Hasura row filter)

---

## Webhook Trigger

Find the API key in the workflow's Triggers tab, or in the DB at `workflow_triggers.config.api_key`.

```bash
curl -X POST http://localhost:3000/webhookTrigger \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "workflow_id": "your-workflow-uuid",
      "api_key": "your-api-key"
    }
  }'
```

---

## Deployment

### nhost Cloud
1. Create a project at [app.nhost.io](https://app.nhost.io)
2. `nhost deploy` — applies migrations + metadata to cloud
3. Set secrets: `LLM_API_KEY`, etc.

### Vercel (Frontend)
```bash
cd frontend
vercel --prod
```
Set env vars: `NEXT_PUBLIC_NHOST_SUBDOMAIN`, `NEXT_PUBLIC_NHOST_REGION`, `NEXT_PUBLIC_FUNCTIONS_URL`.

---

## Project Structure

```
├── nhost/
│   ├── migrations/default/     # 8 PostgreSQL migrations
│   ├── metadata/               # Hasura metadata (relationships, permissions, actions, cron)
│   └── functions/              # Serverless functions
│       ├── lib/
│       │   ├── types.ts        # TypeScript types
│       │   ├── db.ts           # Admin GraphQL client
│       │   ├── auth.ts         # Auth/quota helpers
│       │   ├── runEngine.ts    # Core step execution loop
│       │   └── steps/          # Step type handlers (llmCall, httpRequest, etc.)
│       ├── triggerWorkflowRun.ts
│       ├── approveStep.ts
│       ├── webhookTrigger.ts
│       ├── scheduledRunner.ts
│       └── eventTriggerHandler.ts
├── frontend/
│   └── src/
│       ├── app/                # Next.js 14 App Router pages
│       ├── components/         # React components
│       ├── graphql/            # Queries, mutations, subscriptions
│       ├── lib/                # Apollo Client, nhost client
│       └── styles/             # Global CSS (glassmorphism dark theme)
└── scripts/
    └── seed.ts                 # Demo data seeding script
```
