import type { Request, Response } from 'express';

/**
 * Cron-based scheduled trigger — fires every minute via Hasura cron trigger.
 * Checks for any workflow with an active `scheduled` trigger whose cron
 * expression matches the current time, then starts a run.
 *
 * Cron matching: we use a lightweight in-process check (minute-level precision).
 */

const GRAPHQL_URL =
  process.env.NHOST_GRAPHQL_URL ??
  'https://tnpbzdizermlvqxpyqrh.hasura.ap-south-1.nhost.run/v1/graphql';

let ADMIN_SECRET =
  process.env.HASURA_GRAPHQL_ADMIN_SECRET ??
  process.env.NHOST_ADMIN_SECRET ??
  'oD:Vs!yDpYbb07(KVf_-j:yzbCoW!G$d';

if (GRAPHQL_URL.includes('nhost.run') && ADMIN_SECRET === 'nhost-admin-secret') {
  ADMIN_SECRET = 'oD:Vs!yDpYbb07(KVf_-j:yzbCoW!G$d';
}

async function adminQuery<T = unknown>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

// Ultra-lightweight cron matcher supporting basic patterns:
// minute hour dom month dow — each field: *, number, or */n
function matchesCron(expr: string, now: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [min, hr, dom, mon, dow] = parts;
  const match = (field: string, value: number) => {
    if (field === '*') return true;
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2), 10);
      return value % step === 0;
    }
    return parseInt(field, 10) === value;
  };
  return (
    match(min, now.getUTCMinutes()) &&
    match(hr, now.getUTCHours()) &&
    match(dom, now.getUTCDate()) &&
    match(mon, now.getUTCMonth() + 1) &&
    match(dow, now.getUTCDay())
  );
}

export default async function handler(req: Request, res: Response) {
  // Validate nhost webhook secret
  const secret = req.headers['x-nhost-webhook-secret'];
  if (secret !== (process.env.NHOST_WEBHOOK_SECRET ?? 'local-webhook-secret')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const now = new Date();

  try {
    // 1. Find all active scheduled triggers
    const data = await adminQuery<{
      workflow_triggers: {
        id: string;
        workflow_id: string;
        config: { cron?: string };
      }[];
    }>(
      `query GetScheduledTriggers {
        workflow_triggers(where: {
          trigger_type: { _eq: "scheduled" }
          is_active: { _eq: true }
        }) { id workflow_id config }
      }`
    );

    const triggered: string[] = [];

    for (const trigger of data.workflow_triggers) {
      const cron = trigger.config?.cron;
      if (!cron) continue;
      if (!matchesCron(cron, now)) continue;

      // 2. Create a workflow run for matching triggers
      const runData = await adminQuery<{ insert_workflow_runs_one: { id: string } }>(
        `mutation CreateRun($workflow_id: uuid!) {
          insert_workflow_runs_one(object: {
            workflow_id: $workflow_id
            trigger_type: "scheduled"
            status: "pending"
          }) { id }
        }`,
        { workflow_id: trigger.workflow_id }
      );
      triggered.push(runData.insert_workflow_runs_one.id);

      // 3. Fire-and-forget run execution
      const functionsUrl = process.env.NHOST_FUNCTIONS_URL ?? '';
      if (functionsUrl) {
        fetch(`${functionsUrl}/triggerWorkflowRun`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-nhost-webhook-secret': process.env.NHOST_WEBHOOK_SECRET ?? '',
          },
          body: JSON.stringify({
            event: {
              data: {
                new: { workflow_id: trigger.workflow_id, id: runData.insert_workflow_runs_one.id },
              },
            },
          }),
        }).catch(console.error);
      }
    }

    return res.json({
      message: `Checked ${data.workflow_triggers.length} triggers, started ${triggered.length} runs`,
      run_ids: triggered,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ message: msg });
  }
}
