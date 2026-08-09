import React from 'react';
import { DraftStep, StepType } from '../types';
import {
  Brain,
  Globe,
  Database,
  Bell,
  GitBranch,
  ShieldCheck,
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const STEP_ICONS: Record<StepType, React.ReactNode> = {
  llm_call: <Brain size={14} />,
  http_request: <Globe size={14} />,
  db_write: <Database size={14} />,
  notify: <Bell size={14} />,
  conditional_branch: <GitBranch size={14} />,
  approval_gate: <ShieldCheck size={14} />,
};

const STEP_COLORS: Record<StepType, string> = {
  llm_call: 'step-llm',
  http_request: 'step-http',
  db_write: 'step-db',
  notify: 'step-notify',
  conditional_branch: 'step-branch',
  approval_gate: 'step-approval',
};

interface Props {
  step: DraftStep;
  isOwner: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChange: (updated: DraftStep) => void;
  onDelete: () => void;
  dragHandleProps?: Record<string, unknown>;
}

export const StepEditor = ({
  step,
  isOwner,
  expanded,
  onToggle,
  onChange,
  onDelete,
  dragHandleProps,
}: Props) => {
  const ownerOnlyTypes: StepType[] = ['db_write', 'notify'];
  const isOwnerOnly = ownerOnlyTypes.includes(step.step_type);

  const setConfig = (key: string, value: unknown) => {
    onChange({ ...step, config: { ...step.config, [key]: value } });
  };

  return (
    <div className={`step-card ${STEP_COLORS[step.step_type]}`}>
      <div className="step-header">
        <span className="drag-handle" {...(dragHandleProps as React.HTMLAttributes<HTMLSpanElement>)}>
          <GripVertical size={16} />
        </span>
        <span className="step-icon">{STEP_ICONS[step.step_type]}</span>
        <input
          className="step-name-input"
          value={step.name}
          onChange={(e) => onChange({ ...step, name: e.target.value })}
          placeholder="Step name"
          aria-label="Step name"
        />
        {isOwnerOnly && !isOwner && (
          <span className="owner-badge" title="Owner only">owner</span>
        )}
        <button
          className="btn btn-ghost btn-xs"
          onClick={onToggle}
          aria-label="Toggle step config"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          className="btn btn-ghost btn-xs btn-danger"
          onClick={onDelete}
          aria-label="Delete step"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="step-config">
          {step.step_type === 'llm_call' && (
            <LlmConfig config={step.config} setConfig={setConfig} />
          )}
          {step.step_type === 'http_request' && (
            <HttpConfig config={step.config} setConfig={setConfig} />
          )}
          {step.step_type === 'db_write' && (
            <DbWriteConfig config={step.config} setConfig={setConfig} />
          )}
          {step.step_type === 'notify' && (
            <NotifyConfig config={step.config} setConfig={setConfig} />
          )}
          {step.step_type === 'conditional_branch' && (
            <BranchConfig config={step.config} setConfig={setConfig} />
          )}
          {step.step_type === 'approval_gate' && (
            <ApprovalConfig config={step.config} setConfig={setConfig} />
          )}
        </div>
      )}
    </div>
  );
};

// ─── Per-type config editors ─────────────────────────────────────────────────

interface ConfigProps {
  config: Record<string, unknown>;
  setConfig: (key: string, value: unknown) => void;
}

const LlmConfig = ({ config, setConfig }: ConfigProps) => (
  <div className="config-fields">
    <div className="form-group">
      <label className="form-label">Model</label>
      <select
        className="form-select"
        value={(config.model as string) ?? 'llama3-8b-8192'}
        onChange={(e) => setConfig('model', e.target.value)}
      >
        <option value="llama3-8b-8192">Groq – Llama 3 8B</option>
        <option value="llama3-70b-8192">Groq – Llama 3 70B</option>
        <option value="mixtral-8x7b-32768">Groq – Mixtral 8x7B</option>
        <option value="gemini-pro">Google – Gemini Pro</option>
      </select>
    </div>
    <div className="form-group">
      <label className="form-label">System Prompt</label>
      <textarea
        className="form-input form-textarea"
        value={(config.system_prompt as string) ?? ''}
        onChange={(e) => setConfig('system_prompt', e.target.value)}
        placeholder="You are a helpful assistant..."
        rows={2}
      />
    </div>
    <div className="form-group">
      <label className="form-label">User Prompt (use {'{{input}}'} for previous output)</label>
      <textarea
        className="form-input form-textarea"
        value={(config.user_prompt as string) ?? ''}
        onChange={(e) => setConfig('user_prompt', e.target.value)}
        placeholder="Summarize the following: {{input}}"
        rows={3}
      />
    </div>
    <div className="form-group">
      <label className="form-label">Max Tokens</label>
      <input
        type="number"
        className="form-input"
        value={(config.max_tokens as number) ?? 1024}
        onChange={(e) => setConfig('max_tokens', parseInt(e.target.value, 10))}
        min={64}
        max={8192}
      />
    </div>
  </div>
);

const HttpConfig = ({ config, setConfig }: ConfigProps) => (
  <div className="config-fields">
    <div className="form-group">
      <label className="form-label">Method</label>
      <select
        className="form-select"
        value={(config.method as string) ?? 'GET'}
        onChange={(e) => setConfig('method', e.target.value)}
      >
        {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
    <div className="form-group">
      <label className="form-label">URL</label>
      <input
        type="url"
        className="form-input"
        value={(config.url as string) ?? ''}
        onChange={(e) => setConfig('url', e.target.value)}
        placeholder="https://api.example.com/data"
      />
    </div>
    <div className="form-group">
      <label className="form-label">Headers (JSON)</label>
      <textarea
        className="form-input form-textarea"
        value={(config.headers as string) ?? '{}'}
        onChange={(e) => setConfig('headers', e.target.value)}
        placeholder='{"Authorization": "Bearer token"}'
        rows={2}
      />
    </div>
    <div className="form-group">
      <label className="form-label">Body (JSON, optional)</label>
      <textarea
        className="form-input form-textarea"
        value={(config.body as string) ?? ''}
        onChange={(e) => setConfig('body', e.target.value)}
        placeholder='{"key": "value"}'
        rows={2}
      />
    </div>
  </div>
);

const DbWriteConfig = ({ config, setConfig }: ConfigProps) => (
  <div className="config-fields">
    <div className="form-group">
      <label className="form-label">Table Name</label>
      <input
        className="form-input"
        value={(config.table as string) ?? ''}
        onChange={(e) => setConfig('table', e.target.value)}
        placeholder="workflow_results"
      />
    </div>
    <div className="form-group">
      <label className="form-label">Data mapping (JSON)</label>
      <textarea
        className="form-input form-textarea"
        value={(config.data as string) ?? '{}'}
        onChange={(e) => setConfig('data', e.target.value)}
        placeholder='{"result": "{{output}}", "run_id": "{{run_id}}"}'
        rows={3}
      />
    </div>
  </div>
);

const NotifyConfig = ({ config, setConfig }: ConfigProps) => (
  <div className="config-fields">
    <div className="form-group">
      <label className="form-label">Channel</label>
      <select
        className="form-select"
        value={(config.channel as string) ?? 'slack'}
        onChange={(e) => setConfig('channel', e.target.value)}
      >
        <option value="slack">Slack</option>
        <option value="email">Email</option>
        <option value="webhook">Webhook</option>
      </select>
    </div>
    <div className="form-group">
      <label className="form-label">Target (URL / email)</label>
      <input
        className="form-input"
        value={(config.target as string) ?? ''}
        onChange={(e) => setConfig('target', e.target.value)}
        placeholder="https://hooks.slack.com/..."
      />
    </div>
    <div className="form-group">
      <label className="form-label">Message</label>
      <textarea
        className="form-input form-textarea"
        value={(config.message as string) ?? ''}
        onChange={(e) => setConfig('message', e.target.value)}
        placeholder="Workflow completed: {{output}}"
        rows={2}
      />
    </div>
  </div>
);

const BranchConfig = ({ config, setConfig }: ConfigProps) => (
  <div className="config-fields">
    <div className="form-group">
      <label className="form-label">Condition (evaluates previous output)</label>
      <input
        className="form-input"
        value={(config.condition as string) ?? ''}
        onChange={(e) => setConfig('condition', e.target.value)}
        placeholder='output.includes("positive")'
      />
    </div>
    <div className="form-group">
      <label className="form-label">On TRUE — go to step order</label>
      <input
        type="number"
        className="form-input"
        value={(config.true_branch as number) ?? ''}
        onChange={(e) => setConfig('true_branch', parseInt(e.target.value, 10))}
        placeholder="3"
        min={1}
      />
    </div>
    <div className="form-group">
      <label className="form-label">On FALSE — go to step order</label>
      <input
        type="number"
        className="form-input"
        value={(config.false_branch as number) ?? ''}
        onChange={(e) => setConfig('false_branch', parseInt(e.target.value, 10))}
        placeholder="4"
        min={1}
      />
    </div>
  </div>
);

const ApprovalConfig = ({ config, setConfig }: ConfigProps) => (
  <div className="config-fields">
    <div className="form-group">
      <label className="form-label">Approval message</label>
      <textarea
        className="form-input form-textarea"
        value={(config.message as string) ?? ''}
        onChange={(e) => setConfig('message', e.target.value)}
        placeholder="Please review and approve to continue..."
        rows={2}
      />
    </div>
    <div className="form-group">
      <label className="form-label">Required role</label>
      <select
        className="form-select"
        value={(config.required_role as string) ?? 'owner'}
        onChange={(e) => setConfig('required_role', e.target.value)}
      >
        <option value="owner">owner</option>
        <option value="editor">editor or above</option>
      </select>
    </div>
  </div>
);
