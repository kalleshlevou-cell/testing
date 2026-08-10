import type { Request, Response } from 'express';

// ─── Hasura admin client ──────────────────────────────────────────────────────

const GRAPHQL_URL =
  process.env.NHOST_GRAPHQL_URL ??
  'https://tnpbzdizermlvqxpyqrh.hasura.ap-south-1.nhost.run/v1/graphql';

const ADMIN_SECRET =
  process.env.HASURA_GRAPHQL_ADMIN_SECRET ??
  process.env.NHOST_ADMIN_SECRET ?? '';

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

// ─── GQL helpers ─────────────────────────────────────────────────────────────

const GET_WORKFLOW = `
  query GetWorkflow($id: uuid!) {
    workflows_by_pk(id: $id) {
      id org_id
      organization { quota_calls_used quota_calls_allowed }
      workflow_steps(order_by: { step_order: asc }) {
        id step_order step_type name config
      }
      workflow_triggers {
        id trigger_type config is_active
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

const CREATE_RUN = `
  mutation CreateRun($workflow_id: uuid!, $triggered_by: uuid, $trigger_type: String!) {
    insert_workflow_runs_one(object: {
      workflow_id: $workflow_id
      triggered_by: $triggered_by
      trigger_type: $trigger_type
      status: "running"
      started_at: "now()"
    }) { id }
  }
`;

const CREATE_STEP_RUNS = `
  mutation CreateStepRuns($objects: [step_runs_insert_input!]!) {
    insert_step_runs(objects: $objects) { returning { id step_id } }
  }
`;

const UPDATE_STEP_RUN = `
  mutation UpdateStepRun($id: uuid!, $status: String!, $output: jsonb, $error: String, $attempt_count: Int, $started_at: timestamptz, $completed_at: timestamptz) {
    update_step_runs_by_pk(pk_columns: { id: $id }, _set: {
      status: $status output: $output error: $error
      attempt_count: $attempt_count started_at: $started_at completed_at: $completed_at
    }) { id }
  }
`;

const UPDATE_RUN = `
  mutation UpdateRun($id: uuid!, $status: String!, $error: String, $completed_at: timestamptz) {
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
    ) { id quota_calls_used }
  }
`;

const INSERT_WORKFLOW_RESULT = `
  mutation InsertWorkflowResult($workflow_run_id: uuid!, $step_run_id: uuid!, $data: jsonb!) {
    insert_workflow_results_one(object: {
      workflow_run_id: $workflow_run_id
      step_run_id: $step_run_id
      data: $data
    }) {
      id
    }
  }
`;

// ─── Step executors ───────────────────────────────────────────────────────────

interface StepConfig { [key: string]: unknown }

async function executeLlmCall(
  config: StepConfig,
  input: unknown
): Promise<{ text: string; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
  const model = (config.model as string) ?? 'llama3-8b-8192';
  const systemPrompt = (config.system_prompt as string) ?? 'You are a helpful assistant.';
  let userPrompt = (config.user_prompt as string) ?? '{{input}}';
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
  userPrompt = userPrompt.replace(/\{\{input\}\}/g, inputStr ?? '');
  const maxTokens = (config.max_tokens as number) ?? 1024;

  // Use Groq if available, else stub with artificial delay
  const groqKey = process.env.GROQ_API_KEY ?? '';
  const baseUrl = groqKey
    ? 'https://api.groq.com/openai/v1'
    : process.env.OPENROUTER_API_KEY
    ? 'https://openrouter.ai/api/v1'
    : null;

  if (!baseUrl && !apiKey) {
    // Stub: disclose artificial delay
    await new Promise((r) => setTimeout(r, 1200));
    return {
      text: `[STUBBED LLM RESPONSE] Prompt: "${userPrompt.slice(0, 60)}..."`,
      model: 'stub',
    };
  }

  const key = groqKey || process.env.OPENROUTER_API_KEY || apiKey;
  const url = baseUrl ?? 'https://api.groq.com/openai/v1';

  const res = await fetch(`${url}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API error ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
    model: string;
  };
  return {
    text: data.choices[0].message.content,
    model: data.model ?? model,
  };
}

async function executeHttpRequest(
  config: StepConfig,
  input: unknown
): Promise<unknown> {
  const method = (config.method as string) ?? 'GET';
  const url = config.url as string;
  if (!url) throw new Error('http_request step missing url');

  let headers: Record<string, string> = {};
  try {
    const raw = config.headers as string | Record<string, string>;
    headers = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {};
  } catch { /* ignore parse errors */ }

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };

  if (method !== 'GET' && config.body) {
    try {
      const raw = config.body as string | object;
      options.body = typeof raw === 'string' ? raw : JSON.stringify(raw);
    } catch { /* ignore */ }
  }

  const res = await fetch(url, options);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: res.status, body: text };
  }
}

async function executeDbWrite(
  config: StepConfig,
  input: unknown,
  runId: string,
  stepRunId: string
): Promise<unknown> {
  const data = config.data as Record<string, string>;
  const resolved: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    resolved[k] = v
      .replace(/\{\{output\}\}/g, JSON.stringify(input))
      .replace(/\{\{run_id\}\}/g, runId);
  }

  await adminQuery(INSERT_WORKFLOW_RESULT, {
    workflow_run_id: runId,
    step_run_id: stepRunId,
    data: resolved,
  });

  return { written: resolved };
}

async function executeNotify(config: StepConfig, input: unknown): Promise<unknown> {
  const channel = config.channel as string;
  const target = config.target as string;
  let message = (config.message as string) ?? 'Workflow notification';
  message = message.replace(/\{\{output\}\}/g, JSON.stringify(input));

  if (channel === 'slack' && target) {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
    return { channel, status: res.status };
  }

  if (channel === 'webhook' && target) {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, input }),
    });
    return { channel, status: res.status };
  }

  return { channel, message, note: 'email/other channel stubbed' };
}

function evaluateCondition(condition: string, output: unknown): boolean {
  try {
    // Safe evaluation: only allow simple string/number comparisons
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    // Replace 'output' references and evaluate
    const sanitized = condition
      .replace(/output/g, JSON.stringify(outputStr))
      .replace(/[^0-9a-zA-Z\s"'.,_\-()!<>=&|.]/g, '');
    // eslint-disable-next-line no-new-func
    return Boolean(new Function(`return (${sanitized})`)());
  } catch {
    return false;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

interface Step {
  id: string;
  step_order: number;
  step_type: string;
  name: string;
  config: StepConfig;
}

interface WorkflowData {
  workflows_by_pk: {
    id: string;
    org_id: string;
    organization: {
      quota_calls_used: number;
      quota_calls_allowed: number;
    };
    workflow_steps: Step[];
    workflow_triggers: Array<{ id: string; trigger_type: string; is_active: boolean }>;
  } | null;
}

const MAX_RETRIES = 2;

async function executeWithRetry(
  fn: () => Promise<unknown>,
  stepRunId: string,
  attempt = 1
): Promise<{ output: unknown; attempts: number }> {
  try {
    const output = await fn();
    return { output, attempts: attempt };
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return executeWithRetry(fn, stepRunId, attempt + 1);
    }
    throw err;
  }
}

export default async function handler(req: Request, res: Response) {
  // Support both Action calls (body.input.workflow_id) and Event Trigger calls
  const body = req.body as {
    input?: { workflow_id: string };
    event?: { data: { new: { workflow_id: string; id: string } } };
    session_variables?: Record<string, string>;
  };

  const isAction = !!body.input;
  const isEventTrigger = !!body.event;

  let workflowId: string;
  let userId: string | null = null;
  let triggerType = 'manual';

  if (isAction) {
    workflowId = body.input!.workflow_id;
    userId = body.session_variables?.['x-hasura-user-id'] ?? null;
    triggerType = 'manual';
  } else if (isEventTrigger) {
    workflowId = body.event!.data.new.workflow_id;
    triggerType = 'db_event';
  } else {
    return res.status(400).json({ message: 'Invalid request' });
  }

  try {
    // 1. Load workflow + quota
    const wfData = await adminQuery<WorkflowData>(GET_WORKFLOW, { id: workflowId });
    const workflow = wfData.workflows_by_pk;
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    // 2. Permission check (Layer 1) — user must be owner/editor in the workflow's org
    let role: string | null = null;
    if (userId) {
      const roleData = await adminQuery<{ org_members: { role: string }[] }>(
        GET_MEMBER_ROLE,
        { org_id: workflow.org_id, user_id: userId }
      );
      role = roleData.org_members[0]?.role ?? null;
      if (!role || role === 'viewer') {
        return res.status(403).json({
          message: 'Access denied: viewers cannot trigger workflow runs',
        });
      }
    }

    const ownerOnlySteps = workflow.workflow_steps.some((step) => step.step_type === 'db_write' || step.step_type === 'notify');
    const ownerOnlyTriggers = workflow.workflow_triggers.some((trigger) => trigger.trigger_type === 'webhook' || trigger.trigger_type === 'db_event');
    if ((ownerOnlySteps || ownerOnlyTriggers) && (!userId || role !== 'owner')) {
      return res.status(403).json({
        message: 'Access denied: only owners can run workflows with db_write/notify steps or webhook/db_event triggers',
      });
    }

    // 3. Quota check
    const { quota_calls_used, quota_calls_allowed } = workflow.organization;
    if (quota_calls_used >= quota_calls_allowed) {
      return res.status(429).json({
        message: `Quota exhausted: ${quota_calls_used}/${quota_calls_allowed} calls used`,
      });
    }

    // 4. Create workflow_run
    const runData = await adminQuery<{ insert_workflow_runs_one: { id: string } }>(
      CREATE_RUN,
      {
        workflow_id: workflowId,
        triggered_by: userId,
        trigger_type: triggerType,
      }
    );
    const runId = runData.insert_workflow_runs_one.id;

    // 5. Create step_run rows (all pending)
    const steps = workflow.workflow_steps;
    if (steps.length > 0) {
      await adminQuery(CREATE_STEP_RUNS, {
        objects: steps.map((s) => ({
          workflow_run_id: runId,
          step_id: s.id,
          status: 'pending',
        })),
      });
    }

    // 6. Get the created step_run IDs
    const stepRunsData = await adminQuery<{
      step_runs: { id: string; step_id: string }[];
    }>(
      `query GetStepRuns($run_id: uuid!) {
        step_runs(where: { workflow_run_id: { _eq: $run_id } }, order_by: { created_at: asc }) {
          id step_id
        }
      }`,
      { run_id: runId }
    );
    const stepRunMap = new Map(
      stepRunsData.step_runs.map((sr) => [sr.step_id, sr.id])
    );

    // 7. Execute steps in order
    let lastOutput: unknown = {};
    let skipTo: number | null = null;

    for (const step of steps) {
      const stepRunId = stepRunMap.get(step.id);
      if (!stepRunId) continue;

      // Handle conditional_branch skip logic
      if (skipTo !== null && step.step_order !== skipTo) {
        await adminQuery(UPDATE_STEP_RUN, {
          id: stepRunId,
          status: 'skipped',
          output: null,
          error: null,
          attempt_count: 0,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });
        continue;
      }
      skipTo = null;

      // Mark running
      await adminQuery(UPDATE_STEP_RUN, {
        id: stepRunId,
        status: 'running',
        output: null,
        error: null,
        attempt_count: 1,
        started_at: new Date().toISOString(),
        completed_at: null,
      });

      try {
        let output: unknown;
        let attempts = 1;

        if (step.step_type === 'approval_gate') {
          // Pause the run — resume happens via approveStep
          await adminQuery(UPDATE_STEP_RUN, {
            id: stepRunId,
            status: 'awaiting_approval',
            output: null,
            error: null,
            attempt_count: 1,
            started_at: new Date().toISOString(),
            completed_at: null,
          });
          await adminQuery(UPDATE_RUN, {
            id: runId,
            status: 'paused',
            error: null,
            completed_at: null,
          });

          // Return early — approveStep will resume
          return res.json({
            workflow_run_id: runId,
            status: 'paused',
            message: 'Run paused at approval_gate',
          });
        }

        if (step.step_type === 'conditional_branch') {
          const cond = evaluateCondition(
            step.config.condition as string,
            lastOutput
          );
          output = { condition: step.config.condition, result: cond };
          skipTo = cond
            ? (step.config.true_branch as number)
            : (step.config.false_branch as number);
        } else {
          const result = await executeWithRetry(
            () => {
              switch (step.step_type) {
                case 'llm_call':
                  return executeLlmCall(step.config, lastOutput);
                case 'http_request':
                  return executeHttpRequest(step.config, lastOutput);
                case 'db_write':
                  return executeDbWrite(step.config, lastOutput, runId, stepRunId);
                case 'notify':
                  return executeNotify(step.config, lastOutput);
                default:
                  return Promise.resolve({ note: 'unknown step type' });
              }
            },
            stepRunId
          );
          output = result.output;
          attempts = result.attempts;
        }

        lastOutput = output;

        await adminQuery(UPDATE_STEP_RUN, {
          id: stepRunId,
          status: 'completed',
          output,
          error: null,
          attempt_count: attempts,
          started_at: undefined,
          completed_at: new Date().toISOString(),
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await adminQuery(UPDATE_STEP_RUN, {
          id: stepRunId,
          status: 'failed',
          output: null,
          error: errMsg,
          attempt_count: MAX_RETRIES,
          started_at: undefined,
          completed_at: new Date().toISOString(),
        });
        await adminQuery(UPDATE_RUN, {
          id: runId,
          status: 'failed',
          error: errMsg,
          completed_at: new Date().toISOString(),
        });
        return res.json({
          workflow_run_id: runId,
          status: 'failed',
          message: errMsg,
        });
      }
    }

    // 8. Complete run + increment quota
    await adminQuery(UPDATE_RUN, {
      id: runId,
      status: 'completed',
      error: null,
      completed_at: new Date().toISOString(),
    });
    await adminQuery(INCREMENT_QUOTA, { org_id: workflow.org_id });

    return res.json({
      workflow_run_id: runId,
      status: 'completed',
      message: 'Workflow completed successfully',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ message: msg });
  }
}
