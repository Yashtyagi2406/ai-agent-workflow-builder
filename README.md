# AI Agent Workflow Builder

## Setup
1. `nhost up` (or connect to nhost cloud project) — applies migrations + metadata
2. `cd nhost/functions && npm install`
3. `cd frontend && npm install && npm run dev`
4. Copy `.env.example` to `.env` and fill in: NHOST_SUBDOMAIN, NHOST_REGION, HASURA_ADMIN_SECRET, LLM_API_KEY (or leave blank to use stubbed LLM calls)

## Run the seed script
`npx ts-node scripts/seed.ts` — creates two orgs, two users each, with owner/editor/viewer roles, for the Final Task demo.

## Local dev
- Hasura console: http://localhost:8080 (via nhost CLI)
- Frontend: http://localhost:3000

## Deployment
- nhost project deployed to nhost cloud
- Frontend deployed to Vercel, pointed at the nhost cloud project

TODO: fill in specifics once implemented.
