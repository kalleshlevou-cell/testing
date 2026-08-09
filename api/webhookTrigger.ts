import type { Request, Response } from 'express';

/**
 * Inbound webhook endpoint — external systems POST here to start a workflow run.
 * 
 * Expected body: { workflow_id: string, payload?: object, secret: string }
 * 
 * The secret is validated against the webhook trigger config stored for this workflow.
 * No user auth required — this is a public endpoint authenticated by the secret.
 */

const GRAPHQL_URL =
  process.env.NHOST_GRAPHQL_URL ?? 'http://localhost:1337/v1/graphql';
const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET ?? 'nhost-admin-secret';

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

export default async function handler(req: Request, res: Response) {
  const body = req.body as {
    input?: { workflow_id: string; payload?: Record<string, unknown>; secret: string };
  };

  const input = body.input;
  if (!input?.workflow_id || !input?.secret) {
    return res.status(400).json({ message: 'workflow_id and secret are required' });
  }

  const { workflow_id, secret } = input;

  try {
    // 1. Verify workflow exists and has a webhook trigger with matching secret
    const data = await adminQuery<{
      workflow_triggers: { id: string; config: { secret?: string } }[];
    }>(
      `query GetWebhookTrigger($workflow_id: uuid!) {
        workflow_triggers(where: {
          workflow_id: { _eq: $workflow_id }
          trigger_type: { _eq: "webhook" }
          is_active: { _eq: true }
        }) {
          id config
        }
      }`,
      { workflow_id }
    );

    const triggers = data.workflow_triggers;
    if (triggers.length === 0) {
      return res.status(404).json({ message: 'No active webhook trigger found for this workflow' });
    }

    // Validate secret against any matching trigger
    const matching = triggers.find((t) => t.config?.secret && t.config.secret === secret);
    if (!matching) {
      return res.status(401).json({ message: 'Invalid webhook secret' });
    }

    // 2. Create a workflow run directly (no user, trigger_type = webhook)
    const runData = await adminQuery<{ insert_workflow_runs_one: { id: string } }>(
      `mutation CreateRun($workflow_id: uuid!) {
        insert_workflow_runs_one(object: {
          workflow_id: $workflow_id
          trigger_type: "webhook"
          status: "pending"
        }) { id }
      }`,
      { workflow_id }
    );
    const runId = runData.insert_workflow_runs_one.id;

    // 3. Dispatch to triggerWorkflowRun logic (call ourselves or inline)
    // We re-use the trigger function URL if available, otherwise fall back to inline execution
    const functionsUrl = process.env.NHOST_FUNCTIONS_URL ?? '';
    if (functionsUrl) {
      fetch(`${functionsUrl}/triggerWorkflowRun`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-nhost-webhook-secret': process.env.NHOST_WEBHOOK_SECRET ?? '',
        },
        body: JSON.stringify({
          event: { data: { new: { workflow_id, id: runId } } },
        }),
      }).catch(console.error); // Fire and forget
    }

    return res.json({
      workflow_run_id: runId,
      status: 'triggered',
      message: 'Webhook received and workflow triggered',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ message: msg });
  }
}
