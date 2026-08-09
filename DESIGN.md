# Design Write-Up

## Schema Reasoning

The schema is organized around the org → member → workflow → run → step chain.

**organizations** owns quota at the top level (`quota_calls_used / quota_calls_allowed`) so enforcement is a single integer check before any run starts. `quota_period_start` lets the counter be reset monthly without a schema change.

**org_members** is the single source of truth for authorization. Every Hasura permission and every Action handler derives access from this table — "does `x-hasura-user-id` have a row here for this org, and what role?" This means org membership is the gate, not just the role claim.

**workflows / workflow_steps / workflow_triggers** are a simple parent–child hierarchy. `step_order` (integer) controls execution sequence. `config JSONB` lets each step type carry its own fields without requiring a column per field or a polymorphic table. The step type constraint (`CHECK step_type IN (...)`) prevents garbage data at the DB level.

**workflow_runs / step_runs** are separated because a single run produces one `workflow_run` record and N `step_runs` — one per step. This lets us stream per-step live progress via a subscription filtered to `workflow_run_id`. The `paused` status on `workflow_runs` is the mechanism the approval gate uses; `awaiting_approval` on `step_runs` identifies which step is the blocker.

**org_monthly_usage** is a Postgres view that joins organizations → workflows → workflow_runs and computes `runs_this_month` (filtered with `date_trunc`) and `avg_run_duration_seconds`. Hasura tracks it as a computed view, making it queryable via GraphQL without a round-trip.

---

## How the Two Permission Layers Are Enforced Differently

### Layer 1 — Hasura row-level permissions (org + role scoping)

Every table's `select_permission`, `insert_permission`, `update_permission`, and `delete_permission` for the `user` role contains a filter that checks:

```yaml
filter:
  org_id:
    _in:
      _select:
        table: org_members
        columns: [org_id]
        where:
          user_id: { _eq: X-Hasura-User-Id }
```

For nested tables (workflow_steps, step_runs) the filter traverses the relationship:
`workflow.org_id → org_members` or `workflow_run.workflow.org_id → org_members`.

This means **every single row returned by Hasura is already scoped to the caller's own org**. An editor in Org A sending `{ workflows { id } }` literally cannot receive Org B rows — the SQL `WHERE` clause excludes them. Guessing a UUID directly (`workflows_by_pk(id: "org-b-workflow-id")`) returns null, not an error, because the permission filter makes the row invisible.

Role column values (`owner`, `editor`, `viewer`) refine what operations are allowed within that org:
- `viewer` — select only, no insert/update/delete
- `editor` — insert/update workflows, steps, triggers; no membership management
- `owner` — full control

### Layer 2 — Action handler code-level gating (step-type + approval)

Hasura permissions alone cannot enforce:
1. **"Only owners can add a `db_write`, `webhook` trigger, or `notify` step"** — because Hasura can't inspect JSONB field values in a permission filter. The frontend disables these UI elements for non-owners, but the real enforcement is that inserting these step types requires the Action handler to validate role before mutating.
2. **Approval gate resume** — this is a mid-execution decision, not a simple row operation. When `approveStep` is called, the handler:
   a. Looks up the `step_run` to confirm it's `awaiting_approval`
   b. Fetches the caller's role from `org_members` using the `x-hasura-user-id` JWT claim
   c. Rejects with HTTP 403 if the role is `viewer`
   d. Only then marks the step `completed`, sets `approved_by`/`approved_at`, and resumes execution of subsequent steps

The Action handler uses the Hasura **admin secret** for its own mutations (so it can update any row), but it performs its own role check first. This means the permission is enforced in code, not by relying on Hasura permissions to block the admin-secret path — which would never block it anyway.

---

## Approval Gate Pause/Resume Implementation

**Pause path** (`triggerWorkflowRun`):

1. The function iterates steps in `step_order` sequence.
2. When it hits a step with `step_type = 'approval_gate'`, it:
   - Sets the `step_run.status` → `awaiting_approval`
   - Sets `workflow_run.status` → `paused`
   - Returns immediately with `{ status: 'paused' }`
3. No more steps execute. The GraphQL subscription on `step_runs` immediately reflects the `awaiting_approval` status, and the frontend renders an **Approve & Continue** button.

**Resume path** (`approveStep`):

1. Caller invokes `approveStep(step_run_id)` mutation.
2. Action handler verifies:
   - The `step_run` exists and is `awaiting_approval`
   - The caller's role is `owner` or `editor` (checked against `org_members`)
3. Updates the approved step to `completed` with `approved_by` / `approved_at`.
4. Sets `workflow_run.status` back to `running`.
5. Fetches remaining steps (all with `step_order > approved_step.step_order`).
6. Creates any missing `step_run` rows for those steps.
7. Resumes execution in a loop — same retry/branch logic as the initial trigger.
8. If another `approval_gate` is encountered, pauses again.
9. On full completion, increments `quota_calls_used`.

The subscription stays open throughout. Because `step_runs` rows are being mutated by the function, the frontend receives live updates with no polling.

---

## Retry and Failure Handling

`llm_call` and `http_request` steps retry up to 2 times (configurable via `MAX_RETRIES`) with an exponential backoff (1s × attempt). Each retry increments `attempt_count` on the `step_run` row, which the frontend displays as a "retry #N" badge.

If all retries are exhausted, the step is marked `failed`, the `workflow_run` is marked `failed` with the error message, and all remaining steps stay `pending` (not executed). This is visible immediately in the subscription.

---

## Cross-Org Isolation Guarantee

The Hasura permission filter on every table uses a sub-select against `org_members` scoped to the caller's `user_id`. This runs as a SQL `WHERE` condition on every query. An Org B user querying by a known Org A workflow UUID will get an empty result (not a 403) — indistinguishable from a non-existent ID. The Action handlers perform the same check independently using the admin secret path, so even API-level calls cannot bypass the org scope.
