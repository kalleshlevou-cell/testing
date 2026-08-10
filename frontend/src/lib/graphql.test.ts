import { GET_MY_ORGS, SUBSCRIBE_STEP_RUNS, TRIGGER_WORKFLOW_RUN, APPROVE_STEP } from './graphql';

describe('GET_MY_ORGS', () => {
  it('is a GraphQL query that fetches org membership and quota info', () => {
    const source = GET_MY_ORGS.loc?.source.body ?? '';
    // Relies on Hasura JWT session variables — no $user_id arg needed
    expect(source).toContain('org_members');
    expect(source).toContain('organization');
    expect(source).toContain('quota_calls_used');
    expect(source).toContain('quota_calls_allowed');
  });
});

describe('SUBSCRIBE_STEP_RUNS', () => {
  it('is a subscription filtered by workflow_run_id', () => {
    const source = SUBSCRIBE_STEP_RUNS.loc?.source.body ?? '';
    expect(source).toContain('subscription');
    expect(source).toContain('$workflow_run_id');
    expect(source).toContain('status');
    expect(source).toContain('approved_by');
  });
});

describe('TRIGGER_WORKFLOW_RUN', () => {
  it('is a mutation with workflow_id variable', () => {
    const source = TRIGGER_WORKFLOW_RUN.loc?.source.body ?? '';
    expect(source).toContain('mutation');
    expect(source).toContain('$workflow_id');
    expect(source).toContain('workflow_run_id');
  });
});

describe('APPROVE_STEP', () => {
  it('is a mutation with step_run_id variable', () => {
    const source = APPROVE_STEP.loc?.source.body ?? '';
    expect(source).toContain('mutation');
    expect(source).toContain('$step_run_id');
    expect(source).toContain('status');
  });
});
