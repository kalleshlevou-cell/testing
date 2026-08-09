import { gql } from '@apollo/client';

// ─── Queries ───────────────────────────────────────────────────────────────

export const GET_MY_ORGS = gql`
  query GetMyOrgs {
    org_members {
      role
      organization {
        id
        name
        quota_calls_used
        quota_calls_allowed
        quota_period_start
      }
    }
  }
`;

export const GET_WORKFLOWS = gql`
  query GetWorkflows($org_id: uuid!) {
    workflows(
      where: { org_id: { _eq: $org_id } }
      order_by: { created_at: desc }
    ) {
      id
      name
      description
      is_active
      created_at
      updated_at
      workflow_steps(order_by: { step_order: asc }) {
        id
        step_order
        step_type
        name
        config
      }
      workflow_triggers {
        id
        trigger_type
        config
        is_active
      }
      workflow_runs(order_by: { created_at: desc }, limit: 1) {
        id
        status
        created_at
        trigger_type
      }
    }
  }
`;

export const GET_WORKFLOW_DETAIL = gql`
  query GetWorkflowDetail($id: uuid!) {
    workflows_by_pk(id: $id) {
      id
      name
      description
      is_active
      org_id
      created_at
      updated_at
      workflow_steps(order_by: { step_order: asc }) {
        id
        step_order
        step_type
        name
        config
      }
      workflow_triggers {
        id
        trigger_type
        config
        is_active
      }
      workflow_runs(order_by: { created_at: desc }, limit: 5) {
        id
        status
        trigger_type
        started_at
        completed_at
        error
        created_at
      }
    }
  }
`;

export const GET_ORG_MEMBERS = gql`
  query GetOrgMembers($org_id: uuid!) {
    org_members(where: { org_id: { _eq: $org_id } }) {
      id
      user_id
      role
      created_at
    }
  }
`;

// ─── Mutations ──────────────────────────────────────────────────────────────

export const CREATE_WORKFLOW = gql`
  mutation CreateWorkflow(
    $org_id: uuid!
    $name: String!
    $description: String
  ) {
    insert_workflows_one(
      object: {
        org_id: $org_id
        name: $name
        description: $description
        is_active: true
      }
    ) {
      id
      name
    }
  }
`;

export const UPDATE_WORKFLOW = gql`
  mutation UpdateWorkflow($id: uuid!, $name: String!, $description: String) {
    update_workflows_by_pk(
      pk_columns: { id: $id }
      _set: { name: $name, description: $description }
    ) {
      id
      name
      description
    }
  }
`;

export const DELETE_WORKFLOW = gql`
  mutation DeleteWorkflow($id: uuid!) {
    delete_workflows_by_pk(id: $id) {
      id
    }
  }
`;

export const UPSERT_STEPS = gql`
  mutation UpsertSteps($steps: [workflow_steps_insert_input!]!, $workflow_id: uuid!) {
    delete_workflow_steps(where: { workflow_id: { _eq: $workflow_id } }) {
      affected_rows
    }
    insert_workflow_steps(objects: $steps) {
      returning {
        id
        step_order
        step_type
        name
        config
      }
    }
  }
`;

export const UPSERT_TRIGGERS = gql`
  mutation UpsertTriggers($triggers: [workflow_triggers_insert_input!]!, $workflow_id: uuid!) {
    delete_workflow_triggers(where: { workflow_id: { _eq: $workflow_id } }) {
      affected_rows
    }
    insert_workflow_triggers(objects: $triggers) {
      returning {
        id
        trigger_type
        config
        is_active
      }
    }
  }
`;

export const TRIGGER_WORKFLOW_RUN = gql`
  mutation TriggerWorkflowRun($workflow_id: uuid!) {
    triggerWorkflowRun(workflow_id: $workflow_id) {
      workflow_run_id
      status
      message
    }
  }
`;

export const APPROVE_STEP = gql`
  mutation ApproveStep($step_run_id: uuid!) {
    approveStep(step_run_id: $step_run_id) {
      step_run_id
      workflow_run_id
      status
      message
    }
  }
`;

export const ADD_ORG_MEMBER = gql`
  mutation AddOrgMember($org_id: uuid!, $user_id: uuid!, $role: String!) {
    insert_org_members_one(
      object: { org_id: $org_id, user_id: $user_id, role: $role }
    ) {
      id
      role
    }
  }
`;

// ─── Subscriptions ──────────────────────────────────────────────────────────

export const SUBSCRIBE_STEP_RUNS = gql`
  subscription StepRuns($workflow_run_id: uuid!) {
    step_runs(
      where: { workflow_run_id: { _eq: $workflow_run_id } }
      order_by: { created_at: asc }
    ) {
      id
      status
      input
      output
      error
      attempt_count
      approved_by
      approved_at
      started_at
      completed_at
      updated_at
      step {
        id
        step_type
        name
        step_order
      }
    }
  }
`;

export const SUBSCRIBE_WORKFLOW_RUN = gql`
  subscription WorkflowRun($id: uuid!) {
    workflow_runs_by_pk(id: $id) {
      id
      status
      started_at
      completed_at
      error
      trigger_type
      step_runs(order_by: { created_at: asc }) {
        id
        status
        step {
          id
          step_type
          name
          step_order
        }
        started_at
        completed_at
        error
        approved_by
        approved_at
        output
      }
    }
  }
`;
