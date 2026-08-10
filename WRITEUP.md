# Technical Write-Up: AI Agent Workflow Builder

## Schema Design Reasoning

The data model is organized around a clear hierarchy: **Organizations → Members → Workflows → Steps/Triggers → Runs → Step Runs**.

**`organizations`** is the root entity. The `calls_used` / `calls_allowed` quota columns sit here because quotas are org-level resources, not per-user. A `quota_period_start` date allows future reset logic.

**`org_members`** is the join table between users and orgs with a `role` column (`owner`, `editor`, `viewer`). The `unique(org_id, user_id)` constraint ensures one role per user per org. This is the pivot for all row-level permission filtering.

**`workflows`** belong to exactly one org. This is a hard foreign key — the system can never have a workflow that escapes its org's permission scope.

**`workflow_steps`** uses an integer `step_order` with a `unique(workflow_id, step_order)` constraint. The JSONB `config` column stores step-specific configuration (prompts, URLs, conditions, etc.) without requiring schema changes for new step types.

**`workflow_runs`** captures each execution. The `paused` status is the key to the approval gate design — the run record stays alive while waiting for a human decision.

**`step_runs`** captures per-step execution within a run: input/output JSONB, error text, `attempt_count` (for retry tracking), and `approved_by` / `approved_at` for the approval gate audit trail.

**`org_usage_this_month`** is a Postgres view (tracked as a Hasura logical model) that computes `calls_used / calls_allowed` ratio and `avg_run_duration_seconds` for the current month. This satisfies the "aggregation" requirement without denormalization.

---

## Permission Layer 1: Org + Role Scoping (Hasura Row Filters)

Layer 1 is enforced entirely by Hasura's row-level permission system. Every table's `SELECT`, `INSERT`, `UPDATE`, and `DELETE` permissions use a **relationship-based row filter** that traverses through `org_members`:

```json
{
  "organization": {
    "org_members": {
      "user_id": { "_eq": "X-Hasura-User-Id" }
    }
  }
}
```

This means a request from an Org B user querying a workflow by its UUID returns **empty, not a 403**. Hasura evaluates the filter at the DB level — the query returns `[]` or `null`. This is the correct GraphQL behavior for row-level security and makes cross-org isolation "proof by construction": if the row filter doesn't match, the data simply doesn't exist from the client's perspective.

**Why this is sufficient for Layer 1:** The `X-Hasura-User-Id` session variable is set by Hasura from the verified JWT — it cannot be spoofed by the client. Even if an attacker knows another org's UUIDs and sends direct GraphQL queries, the row filter ensures they see nothing.

**Role differences:**
- `owner`: Full CRUD, all columns visible
- `editor`: Can create/edit workflows and steps, cannot delete org members, cannot manage org settings
- `viewer`: Select-only everywhere, zero mutation access

---

## Permission Layer 2: Step-Level Gating (DB Trigger + Action Handler)

Layer 2 addresses two separate scenarios that require enforcement *beyond* row-level permissions:

### 2a. Restricted Step/Trigger Types (DB Trigger)

The assignment requires that only owners can add `db_write`, `notify`, `approval_gate` steps and `webhook`, `database_event` triggers. This cannot be enforced by Hasura's row filter (which filters *which rows* you can touch, not *what values* you can insert). 

The solution is a **Postgres BEFORE INSERT/UPDATE trigger** on `workflow_steps` and `workflow_triggers`:

```sql
-- Reads the calling user's ID from Hasura's forwarded session variable
v_user_id := current_setting('hasura.user.id', true);
-- Joins org_members to get their role
-- Raises exception if non-owner tries to add a restricted type
```

This runs at the DB level — even if someone bypasses the API layer entirely, the constraint holds. Hasura forwards `x-hasura-user-id` as `hasura.user.id` when `HASURA_GRAPHQL_ENABLE_REMOTE_SCHEMA_PERMISSIONS` is active.

### 2b. Approval Gate Resume (Action Handler Code Check)

The `approveStep` Action handler performs a **programmatic role check** that is the sole enforcement point for resuming a paused workflow:

```typescript
// lib/auth.ts
await verifyOrgMemberByOrgId(userId, orgId, ['owner', 'editor']);
```

This check is independent of the GraphQL permission layer. Why? Because this is a **mid-execution decision**: the run is already in the database, the step_run row already exists, and "approving" it means updating an existing row that the approver may have `SELECT` access to but not necessarily `UPDATE`. More importantly, the approval check combines:

1. **Org membership check**: the approver must be a member of the org that *owns* the workflow — not just any org
2. **Role check**: must be `owner` or `editor`, not `viewer`

A Hasura `UPDATE` permission could check the role, but it cannot verify the *org context* of a live mid-run operation where the permission needs to be evaluated against the run's parent workflow's org. The Action handler fetches all this context fresh from the DB using the admin secret and rejects before writing anything.

---

## Approval Gate Pause/Resume Implementation

**Pause flow:**
1. `runEngine` iterates steps in order
2. When it encounters an `approval_gate` step, `executeApprovalGate()` returns `{ status: 'paused_awaiting_approval' }`
3. `runEngine` writes `step_runs.status = 'paused_awaiting_approval'` and `workflow_runs.status = 'paused'`
4. `runEngine` returns early — the Action handler's synchronous HTTP response returns to the client with `status: 'paused'`
5. The live subscription (`SUB_STEP_RUNS` + `SUB_WORKFLOW_RUN`) immediately reflects the paused state — no polling, no refresh

**Resume flow:**
1. Frontend shows amber "Awaiting Approval" banner + **Approve & Continue** button
2. Button is hidden for `viewer` role
3. On click, `approveStep` mutation calls the Action handler
4. Handler: re-checks org membership + role (Layer 2), updates `step_runs.approved_by / approved_at / status = succeeded`
5. Handler: sets `workflow_runs.status = 'running'`
6. Handler: calls `runEngine(workflowRunId, nextStepOrder)` — continues the loop from the step *after* the gate
7. Subscription reflects new status updates as each subsequent step completes
8. If another `approval_gate` appears, the process repeats

**Key design choice:** The Action handler is synchronous — it runs the remaining steps and returns. This works for typical step chains. For very long chains (>60 seconds), a production implementation would use an async job queue. For this assignment, the nhost Functions timeout is set to 120 seconds in `actions.yaml`.

---

## Quota Enforcement

Quota is incremented **once per completed run** (in `runEngine` after the last step succeeds) via `incrementQuotaUsed(orgId)`. The `triggerWorkflowRun` handler checks quota *before* creating the run row. If the run fails mid-way, no quota is consumed (partial runs are free). If the run is resumed after an approval gate, quota is only counted when the full run completes.
