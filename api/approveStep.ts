import type { Request, Response } from 'express';

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

const GET_STEP_RUN = `
  query GetStepRun($id: uuid!) {
    step_runs_by_pk(id: $id) {
      id status workflow_run_id
      step { id step_type config step_order workflow_id }
      workflow_run {
        id workflow_id status
        workflow { org_id workflow_steps(order_by: { step_order: asc }) {
          id step_order step_type name config
        }}
      }
    }
  }
`;

const GET_MEMBER_ROLE = `
  query GetRole($org_id: uuid!, $user_id: uuid!) {
    org_members(where: { org_id: { _eq: $org_id }, user_id: { _eq: $user_id } }) {
      role
    }
  }
`;

const UPDATE_STEP_RUN = `
  mutation UpdateStepRun($id: uuid!, $status: String!, $approved_by: uuid!, $approved_at: timestamptz!, $completed_at: timestamptz!) {
    update_step_runs_by_pk(pk_columns: { id: $id }, _set: {
      status: $status approved_by: $approved_by
      approved_at: $approved_at completed_at: $completed_at
    }) { id }
  }
`;

const UPDATE_RUN_STATUS = `
  mutation UpdateRunStatus($id: uuid!, $status: String!) {
    update_workflow_runs_by_pk(pk_columns: { id: $id }, _set: { status: $status }) { id }
  }
`;

const CREATE_STEP_RUNS = `
  mutation CreateStepRuns($objects: [step_runs_insert_input!]!) {
    insert_step_runs(objects: $objects) { returning { id step_id } }
  }
`;

const UPDATE_STEP_RUN_GENERIC = `
  mutation UpdateStepRunGeneric($id: uuid!, $status: String!, $output: jsonb, $error: String, $attempt_count: Int, $started_at: timestamptz, $completed_at: timestamptz) {
    update_step_runs_by_pk(pk_columns: { id: $id }, _set: {
      status: $status output: $output error: $error
      attempt_count: $attempt_count started_at: $started_at completed_at: $completed_at
    }) { id }
  }
`;

const UPDATE_RUN_COMPLETE = `
  mutation UpdateRunComplete($id: uuid!, $status: String!, $error: String, $completed_at: timestamptz) {
    update_workflow_runs_by_pk(pk_columns: { id: $id }, _set: {
      status: $status error: $error completed_at: $completed_at
    }) { id }
  }
`;

const INCREMENT_QUOTA = `
  mutation IncrementQuota($org_id: uuid!) {
    update_organizations_by_pk(
      pk_columns: { id: $org_id }
      _inc: { quota_calls_used: 1 }
    ) { id }
  }
`;

interface StepDef {
  id: string;
  step_order: number;
  step_type: string;
  name: string;
  config: Record<string, unknown>;
}

// Re-implemented step executors (shared logic — in production, extract to shared module)
async function executeLlmCall(config: Record<string, unknown>, input: unknown) {
  const groqKey = process.env.GROQ_API_KEY ?? '';
  const orKey = process.env.OPENROUTER_API_KEY ?? '';
  const model = (config.model as string) ?? 'llama3-8b-8192';
  const systemPrompt = (config.system_prompt as string) ?? 'You are a helpful assistant.';
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  let userPrompt = ((config.user_prompt as string) ?? '{{input}}').replace(/\{\{input\}\}/g, inputStr);
  const maxTokens = (config.max_tokens as number) ?? 1024;

  if (!groqKey && !orKey) {
    await new Promise((r) => setTimeout(r, 1200));
    return { text: `[STUBBED] prompt: "${userPrompt.slice(0, 60)}"`, model: 'stub' };
  }
  const key = groqKey || orKey;
  const baseUrl = groqKey ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1';
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`LLM error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[]; model: string };
  return { text: data.choices[0].message.content, model: data.model };
}

async function executeHttpRequest(config: Record<string, unknown>, input: unknown) {
  const method = (config.method as string) ?? 'GET';
  const url = config.url as string;
  if (!url) throw new Error('http_request missing url');
  let headers: Record<string, string> = {};
  try { const raw = config.headers as string; headers = JSON.parse(raw); } catch { /**/ }
  const options: RequestInit = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (method !== 'GET' && config.body) {
    options.body = typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
  }
  const res = await fetch(url, options);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { status: res.status, body: text }; }
}

async function executeNotify(config: Record<string, unknown>, input: unknown) {
  const channel = config.channel as string;
  const target = config.target as string;
  let message = ((config.message as string) ?? 'Notification').replace(/\{\{output\}\}/g, JSON.stringify(input));
  if ((channel === 'slack' || channel === 'webhook') && target) {
    const res = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: message }) });
    return { channel, status: res.status };
  }
  return { channel, message, note: 'stubbed' };
}

function evaluateCondition(condition: string, output: unknown): boolean {
  try {
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    const sanitized = condition.replace(/output/g, JSON.stringify(outputStr)).replace(/[^0-9a-zA-Z\s"'.,_()\-!<>=&|.]/g, '');
    // eslint-disable-next-line no-new-func
    return Boolean(new Function(`return (${sanitized})`)());
  } catch { return false; }
}

export default async function handler(req: Request, res: Response) {
  const body = req.body as {
    input?: { step_run_id: string };
    session_variables?: Record<string, string>;
  };

  const stepRunId = body.input?.step_run_id;
  const userId = body.session_variables?.['x-hasura-user-id'];

  if (!stepRunId || !userId) {
    return res.status(400).json({ message: 'step_run_id and authenticated user required' });
  }

  try {
    // 1. Load step run + context
    const srData = await adminQuery<{
      step_runs_by_pk: {
        id: string; status: string; workflow_run_id: string;
        step: StepDef & { workflow_id: string };
        workflow_run: {
          id: string; status: string; workflow_id: string;
          workflow: {
            org_id: string;
            workflow_steps: StepDef[];
          };
        };
      } | null;
    }>(GET_STEP_RUN, { id: stepRunId });

    const sr = srData.step_runs_by_pk;
    if (!sr) return res.status(404).json({ message: 'Step run not found' });
    if (sr.status !== 'awaiting_approval') {
      return res.status(409).json({ message: `Step run is not awaiting approval (status: ${sr.status})` });
    }

    const orgId = sr.workflow_run.workflow.org_id;

    // 2. Permission check (Layer 2) — must be owner or editor in this org
    const roleData = await adminQuery<{ org_members: { role: string }[] }>(
      GET_MEMBER_ROLE, { org_id: orgId, user_id: userId }
    );
    const role = roleData.org_members[0]?.role;
    if (!role || role === 'viewer') {
      return res.status(403).json({ message: 'Access denied: only owner/editor can approve steps' });
    }

    // 3. Mark step approved & completed
    const now = new Date().toISOString();
    await adminQuery(UPDATE_STEP_RUN, {
      id: stepRunId,
      status: 'completed',
      approved_by: userId,
      approved_at: now,
      completed_at: now,
    });

    // 4. Resume run: set back to running
    const runId = sr.workflow_run_id;
    await adminQuery(UPDATE_RUN_STATUS, { id: runId, status: 'running' });

    // 5. Continue executing remaining steps from after the approval gate
    const allSteps = sr.workflow_run.workflow.workflow_steps;
    const approvedOrder = sr.step.step_order;
    const remainingSteps = allSteps.filter((s) => s.step_order > approvedOrder);

    // Create step runs for remaining steps (if not already created)
    if (remainingSteps.length > 0) {
      const existingData = await adminQuery<{ step_runs: { step_id: string }[] }>(
        `query ExistingRuns($run_id: uuid!) { step_runs(where: { workflow_run_id: { _eq: $run_id } }) { step_id } }`,
        { run_id: runId }
      );
      const existingStepIds = new Set(existingData.step_runs.map((sr) => sr.step_id));
      const newSteps = remainingSteps.filter((s) => !existingStepIds.has(s.id));
      if (newSteps.length > 0) {
        await adminQuery(CREATE_STEP_RUNS, {
          objects: newSteps.map((s) => ({ workflow_run_id: runId, step_id: s.id, status: 'pending' })),
        });
      }
    }

    // 6. Execute remaining steps
    const stepRunsData = await adminQuery<{ step_runs: { id: string; step_id: string }[] }>(
      `query GetStepRuns($run_id: uuid!) { step_runs(where: { workflow_run_id: { _eq: $run_id } }, order_by: { created_at: asc }) { id step_id } }`,
      { run_id: runId }
    );
    const stepRunMap = new Map(stepRunsData.step_runs.map((sr) => [sr.step_id, sr.id]));

    let lastOutput: unknown = {};
    let skipTo: number | null = null;

    for (const step of remainingSteps) {
      const srId = stepRunMap.get(step.id);
      if (!srId) continue;

      if (skipTo !== null && step.step_order !== skipTo) {
        await adminQuery(UPDATE_STEP_RUN_GENERIC, { id: srId, status: 'skipped', output: null, error: null, attempt_count: 0, started_at: now, completed_at: now });
        continue;
      }
      skipTo = null;

      await adminQuery(UPDATE_STEP_RUN_GENERIC, { id: srId, status: 'running', output: null, error: null, attempt_count: 1, started_at: new Date().toISOString(), completed_at: null });

      try {
        let output: unknown;

        if (step.step_type === 'approval_gate') {
          await adminQuery(UPDATE_STEP_RUN_GENERIC, { id: srId, status: 'awaiting_approval', output: null, error: null, attempt_count: 1, started_at: new Date().toISOString(), completed_at: null });
          await adminQuery(UPDATE_RUN_COMPLETE, { id: runId, status: 'paused', error: null, completed_at: null });
          return res.json({ step_run_id: stepRunId, workflow_run_id: runId, status: 'paused', message: 'Run paused at next approval_gate' });
        }

        if (step.step_type === 'conditional_branch') {
          const cond = evaluateCondition(step.config.condition as string, lastOutput);
          output = { condition: step.config.condition, result: cond };
          skipTo = cond ? (step.config.true_branch as number) : (step.config.false_branch as number);
        } else {
          let attempts = 1;
          for (let i = 0; i < 2; i++) {
            try {
              output = await (step.step_type === 'llm_call' ? executeLlmCall(step.config, lastOutput) :
                step.step_type === 'http_request' ? executeHttpRequest(step.config, lastOutput) :
                step.step_type === 'notify' ? executeNotify(step.config, lastOutput) :
                Promise.resolve({ note: 'step type handled' }));
              attempts = i + 1;
              break;
            } catch (e) {
              if (i < 1) { await new Promise((r) => setTimeout(r, 1000)); attempts = i + 2; }
              else throw e;
            }
          }
          await adminQuery(UPDATE_STEP_RUN_GENERIC, { id: srId, status: 'completed', output, error: null, attempt_count: attempts, started_at: undefined, completed_at: new Date().toISOString() });
          lastOutput = output;
          continue;
        }

        await adminQuery(UPDATE_STEP_RUN_GENERIC, { id: srId, status: 'completed', output, error: null, attempt_count: 1, started_at: undefined, completed_at: new Date().toISOString() });
        lastOutput = output;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await adminQuery(UPDATE_STEP_RUN_GENERIC, { id: srId, status: 'failed', output: null, error: errMsg, attempt_count: 2, started_at: undefined, completed_at: new Date().toISOString() });
        await adminQuery(UPDATE_RUN_COMPLETE, { id: runId, status: 'failed', error: errMsg, completed_at: new Date().toISOString() });
        return res.json({ step_run_id: stepRunId, workflow_run_id: runId, status: 'failed', message: errMsg });
      }
    }

    // 7. All done
    await adminQuery(UPDATE_RUN_COMPLETE, { id: runId, status: 'completed', error: null, completed_at: new Date().toISOString() });
    await adminQuery(INCREMENT_QUOTA, { org_id: orgId });

    return res.json({
      step_run_id: stepRunId,
      workflow_run_id: runId,
      status: 'completed',
      message: 'Step approved and workflow completed',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ message: msg });
  }
}
