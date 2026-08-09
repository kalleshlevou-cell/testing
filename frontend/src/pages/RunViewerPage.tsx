import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSubscription, useMutation } from '@apollo/client';
import { SUBSCRIBE_WORKFLOW_RUN, APPROVE_STEP } from '../lib/graphql';
import { useOrg } from '../context/OrgContext';
import { StepRun, WorkflowRun } from '../types';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Pause,
  Loader,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle size={16} className="text-green" />,
  failed: <XCircle size={16} className="text-red" />,
  awaiting_approval: <Pause size={16} className="text-yellow" />,
  running: <Loader size={16} className="text-blue spin" />,
  pending: <Clock size={16} className="text-gray" />,
  skipped: <ChevronRight size={16} className="text-gray" />,
};

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString() : '—';

const duration = (start?: string | null, end?: string | null) => {
  if (!start) return null;
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const ms = e - s;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
};

interface StepRunCardProps {
  sr: StepRun;
  canApprove: boolean;
  onApprove: (id: string) => void;
  approving: boolean;
}

const StepRunCard = ({ sr, canApprove, onApprove, approving }: StepRunCardProps) => {
  const [expanded, setExpanded] = React.useState(false);
  const isApproval = sr.step?.step_type === 'approval_gate';
  const needsApproval = sr.status === 'awaiting_approval';

  return (
    <div className={`step-run-card step-run-${sr.status}`}>
      <div className="step-run-header" onClick={() => setExpanded(!expanded)}>
        <span className="step-run-status-icon">
          {STATUS_ICONS[sr.status] ?? <Clock size={16} />}
        </span>
        <div className="step-run-info">
          <span className="step-run-name">
            {sr.step?.step_order}. {sr.step?.name ?? 'Step'}
          </span>
          <span className="step-run-type">{sr.step?.step_type}</span>
        </div>
        <div className="step-run-meta">
          {sr.started_at && (
            <span className="step-time">{fmt(sr.started_at)}</span>
          )}
          {duration(sr.started_at, sr.completed_at) && (
            <span className="step-duration">
              {duration(sr.started_at, sr.completed_at)}
            </span>
          )}
          {sr.attempt_count > 1 && (
            <span className="attempt-badge">retry #{sr.attempt_count}</span>
          )}
        </div>
        <span className="expand-icon">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </div>

      {needsApproval && isApproval && (
        <div className="approval-banner">
          <ShieldCheck size={16} />
          <span>Waiting for approval to continue</span>
          {canApprove && (
            <button
              className="btn btn-primary btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                onApprove(sr.id);
              }}
              disabled={approving}
            >
              {approving ? 'Approving...' : 'Approve & Continue'}
            </button>
          )}
          {!canApprove && (
            <span className="no-approve-msg">
              Only owner/editor can approve
            </span>
          )}
        </div>
      )}

      {sr.error && (
        <div className="step-error">
          <XCircle size={12} />
          {sr.error}
        </div>
      )}

      {expanded && (
        <div className="step-run-detail">
          {sr.input && (
            <div className="io-block">
              <label className="io-label">Input</label>
              <pre className="io-pre">{JSON.stringify(sr.input, null, 2)}</pre>
            </div>
          )}
          {sr.output && (
            <div className="io-block">
              <label className="io-label">Output</label>
              <pre className="io-pre">{JSON.stringify(sr.output, null, 2)}</pre>
            </div>
          )}
          {sr.approved_by && (
            <p className="approved-by">
              ✓ Approved at {fmt(sr.approved_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const RunViewerPage = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { myRole } = useOrg();
  const canApprove = myRole === 'owner' || myRole === 'editor';

  const { data, loading } = useSubscription(SUBSCRIBE_WORKFLOW_RUN, {
    variables: { id: runId },
    skip: !runId,
  });

  const [approveStep, { loading: approving }] = useMutation(APPROVE_STEP);

  const run: WorkflowRun | undefined = data?.workflow_runs_by_pk;

  const handleApprove = (stepRunId: string) => {
    approveStep({ variables: { step_run_id: stepRunId } });
  };

  if (loading && !run) {
    return (
      <div className="page-container loading-state">
        <Loader size={32} className="spin" />
        <p>Connecting to live run...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="page-container">
        <div className="empty-state">Run not found or access denied.</div>
      </div>
    );
  }

  const stepRuns: StepRun[] = run.step_runs ?? [];

  const completedCount = stepRuns.filter((s) => s.status === 'completed').length;
  const totalCount = stepRuns.length;

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Back
        </button>
        <div>
          <h1 className="page-title">Run Details</h1>
          <p className="page-subtitle run-id">ID: {run.id}</p>
        </div>
        <div className={`run-overall-status status-${run.status}`}>
          <span>{run.status.toUpperCase()}</span>
          {run.status === 'running' && <Loader size={14} className="spin" />}
          {run.status === 'paused' && <Pause size={14} />}
          {run.status === 'completed' && <CheckCircle size={14} />}
          {run.status === 'failed' && <XCircle size={14} />}
        </div>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="run-progress-wrap">
          <div className="run-progress-bar">
            <div
              className={`run-progress-fill ${run.status === 'failed' ? 'fill-red' : ''}`}
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
          <span className="run-progress-text">
            {completedCount}/{totalCount} steps
          </span>
        </div>
      )}

      <div className="run-meta-row">
        <span>Trigger: {run.trigger_type}</span>
        {run.started_at && <span>Started: {fmt(run.started_at)}</span>}
        {run.completed_at && <span>Completed: {fmt(run.completed_at)}</span>}
        {duration(run.started_at, run.completed_at) && (
          <span>Duration: {duration(run.started_at, run.completed_at)}</span>
        )}
      </div>

      {run.error && (
        <div className="alert alert-error">
          <XCircle size={16} />
          {run.error}
        </div>
      )}

      <div className="step-runs-list">
        {stepRuns.length === 0 ? (
          <div className="empty-state">
            <Loader size={24} className="spin" />
            <p>Initializing steps...</p>
          </div>
        ) : (
          stepRuns.map((sr) => (
            <StepRunCard
              key={sr.id}
              sr={sr}
              canApprove={canApprove}
              onApprove={handleApprove}
              approving={approving}
            />
          ))
        )}
      </div>
    </div>
  );
};
