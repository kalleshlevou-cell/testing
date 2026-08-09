import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useOrg } from '../context/OrgContext';
import { GET_WORKFLOWS, CREATE_WORKFLOW, DELETE_WORKFLOW } from '../lib/graphql';
import { Workflow, RunStatus } from '../types';
import {
  Plus,
  Play,
  Trash2,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  Loader,
  Zap,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { QuotaIndicator } from '../components/QuotaIndicator';

const statusIcon = (status: RunStatus) => {
  switch (status) {
    case 'completed': return <CheckCircle size={14} className="text-green" />;
    case 'failed': return <XCircle size={14} className="text-red" />;
    case 'paused': return <Pause size={14} className="text-yellow" />;
    case 'running': return <Loader size={14} className="text-blue spin" />;
    default: return <Clock size={14} className="text-gray" />;
  }
};

export const DashboardPage = () => {
  const { currentOrg, myRole, loading: orgLoading } = useOrg();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { data, loading, refetch } = useQuery(GET_WORKFLOWS, {
    variables: { org_id: currentOrg?.organization.id },
    skip: !currentOrg,
    fetchPolicy: 'cache-and-network',
  });

  const [createWorkflow, { loading: creating }] = useMutation(CREATE_WORKFLOW, {
    onCompleted: () => {
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      refetch();
    },
  });

  const [deleteWorkflow] = useMutation(DELETE_WORKFLOW, {
    onCompleted: () => refetch(),
  });

  const workflows: Workflow[] = data?.workflows ?? [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !newName.trim()) return;
    createWorkflow({
      variables: {
        org_id: currentOrg.organization.id,
        name: newName.trim(),
        description: newDesc.trim() || null,
      },
    });
  };

  if (orgLoading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <Loader size={32} className="spin" />
        </div>
      </div>
    );
  }

  if (!currentOrg) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <Zap size={48} className="empty-icon" />
          <h2>No organization found</h2>
          <p>You're not a member of any organization yet. Ask an owner to invite you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Workflows</h1>
          <p className="page-subtitle">{currentOrg.organization.name}</p>
        </div>
        <div className="header-actions">
          <QuotaIndicator
            used={currentOrg.organization.quota_calls_used}
            allowed={currentOrg.organization.quota_calls_allowed}
          />
          {(myRole === 'owner' || myRole === 'editor') && (
            <button
              className="btn btn-primary"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={16} />
              New Workflow
            </button>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Create Workflow</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My AI Workflow"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <input
                  className="form-input"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What does this workflow do?"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && workflows.length === 0 ? (
        <div className="loading-state">
          <Loader size={32} className="spin" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="empty-state">
          <WorkflowIcon size={48} className="empty-icon" />
          <h2>No workflows yet</h2>
          {(myRole === 'owner' || myRole === 'editor') && (
            <p>Create your first workflow to get started.</p>
          )}
        </div>
      ) : (
        <div className="workflow-grid">
          {workflows.map((wf) => {
            const lastRun = wf.workflow_runs?.[0];
            return (
              <div key={wf.id} className="workflow-card">
                <div className="workflow-card-header">
                  <div className="workflow-card-info">
                    <h3 className="workflow-name">{wf.name}</h3>
                    {wf.description && (
                      <p className="workflow-desc">{wf.description}</p>
                    )}
                  </div>
                  <div className="workflow-card-actions">
                    <Link
                      to={`/workflows/${wf.id}`}
                      className="btn btn-ghost btn-sm"
                      aria-label="Edit workflow"
                    >
                      <Edit size={14} />
                    </Link>
                    {myRole === 'owner' && (
                      <button
                        className="btn btn-ghost btn-sm btn-danger"
                        onClick={() => {
                          if (window.confirm('Delete this workflow?')) {
                            deleteWorkflow({ variables: { id: wf.id } });
                          }
                        }}
                        aria-label="Delete workflow"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="workflow-meta">
                  <span className="step-count">
                    {wf.workflow_steps.length} step
                    {wf.workflow_steps.length !== 1 ? 's' : ''}
                  </span>
                  <span className="trigger-count">
                    {wf.workflow_triggers.length} trigger
                    {wf.workflow_triggers.length !== 1 ? 's' : ''}
                  </span>
                  {lastRun && (
                    <span className="last-run">
                      {statusIcon(lastRun.status)}
                      {lastRun.status}
                    </span>
                  )}
                </div>

                <div className="workflow-card-footer">
                  <Link to={`/workflows/${wf.id}/run`} className="btn btn-sm">
                    <Play size={12} />
                    View Runs
                  </Link>
                  {(myRole === 'owner' || myRole === 'editor') && (
                    <Link
                      to={`/workflows/${wf.id}`}
                      className="btn btn-primary btn-sm"
                    >
                      <Edit size={12} />
                      Edit
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
