import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  GET_WORKFLOW_DETAIL,
  UPSERT_STEPS,
  UPSERT_TRIGGERS,
  UPDATE_WORKFLOW,
  TRIGGER_WORKFLOW_RUN,
} from '../lib/graphql';
import { useOrg } from '../context/OrgContext';
import { StepEditor } from '../components/StepEditor';
import { TriggerEditor } from '../components/TriggerEditor';
import {
  DraftStep,
  DraftTrigger,
  StepType,
  Workflow,
} from '../types';
import {
  Save,
  Play,
  ArrowLeft,
  Plus,
  Brain,
  Globe,
  Database,
  Bell,
  GitBranch,
  ShieldCheck,
  Loader,
} from 'lucide-react';

const STEP_TYPES: { type: StepType; label: string; icon: React.ReactNode }[] = [
  { type: 'llm_call', label: 'LLM Call', icon: <Brain size={14} /> },
  { type: 'http_request', label: 'HTTP Request', icon: <Globe size={14} /> },
  { type: 'db_write', label: 'DB Write', icon: <Database size={14} /> },
  { type: 'notify', label: 'Notify', icon: <Bell size={14} /> },
  { type: 'conditional_branch', label: 'Branch', icon: <GitBranch size={14} /> },
  { type: 'approval_gate', label: 'Approval Gate', icon: <ShieldCheck size={14} /> },
];

const OWNER_ONLY_STEPS: StepType[] = ['db_write', 'notify'];

// ─── Sortable Step Wrapper ────────────────────────────────────────────────────

interface SortableStepProps {
  step: DraftStep;
  isOwner: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChange: (s: DraftStep) => void;
  onDelete: () => void;
}

const SortableStep = ({
  step,
  isOwner,
  expanded,
  onToggle,
  onChange,
  onDelete,
}: SortableStepProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step._localId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <StepEditor
        step={step}
        isOwner={isOwner}
        expanded={expanded}
        onToggle={onToggle}
        onChange={onChange}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
};

// ─── Main Builder Page ────────────────────────────────────────────────────────

export const WorkflowBuilderPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { myRole } = useOrg();
  const isOwner = myRole === 'owner';
  const canEdit = myRole === 'owner' || myRole === 'editor';

  const { data, loading } = useQuery(GET_WORKFLOW_DETAIL, {
    variables: { id },
    skip: !id,
    fetchPolicy: 'cache-and-network',
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [triggers, setTriggers] = useState<DraftTrigger[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  const workflow: Workflow | undefined = data?.workflows_by_pk;

  // Sync from server data
  useEffect(() => {
    if (!workflow) return;
    setName(workflow.name);
    setDescription(workflow.description ?? '');
    setSteps(
      workflow.workflow_steps.map((s) => ({
        _localId: s.id,
        step_order: s.step_order,
        step_type: s.step_type,
        name: s.name,
        config: s.config,
      }))
    );
    setTriggers(
      workflow.workflow_triggers.map((t) => ({
        _localId: t.id,
        trigger_type: t.trigger_type,
        config: t.config,
        is_active: t.is_active,
      }))
    );
  }, [workflow]);

  const [updateWorkflow] = useMutation(UPDATE_WORKFLOW);
  const [upsertSteps] = useMutation(UPSERT_STEPS);
  const [upsertTriggers] = useMutation(UPSERT_TRIGGERS);
  const [triggerRun, { loading: triggering }] = useMutation(TRIGGER_WORKFLOW_RUN);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = steps.findIndex((s) => s._localId === active.id);
    const newIdx = steps.findIndex((s) => s._localId === over.id);
    const reordered = [...steps];
    const [moved] = reordered.splice(oldIdx, 1);
    reordered.splice(newIdx, 0, moved);
    setSteps(reordered.map((s, i) => ({ ...s, step_order: i + 1 })));
  };

  const addStep = (type: StepType) => {
    if (OWNER_ONLY_STEPS.includes(type) && !isOwner) return;
    const localId = `new-${Date.now()}`;
    const newStep: DraftStep = {
      _localId: localId,
      step_order: steps.length + 1,
      step_type: type,
      name: type.replace('_', ' '),
      config: {},
    };
    setSteps((prev) => [...prev, newStep]);
    setExpandedSteps((prev) => new Set([...prev, localId]));
  };

  const deleteStep = useCallback((localId: string) => {
    setSteps((prev) => {
      const filtered = prev.filter((s) => s._localId !== localId);
      return filtered.map((s, i) => ({ ...s, step_order: i + 1 }));
    });
  }, []);

  const toggleExpand = (localId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(localId)) next.delete(localId);
      else next.add(localId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!id || !canEdit) return;
    try {
      await updateWorkflow({
        variables: { id, name, description: description || null },
      });
      await upsertSteps({
        variables: {
          workflow_id: id,
          steps: steps.map((s) => ({
            workflow_id: id,
            step_order: s.step_order,
            step_type: s.step_type,
            name: s.name,
            config: s.config,
          })),
        },
      });
      await upsertTriggers({
        variables: {
          workflow_id: id,
          triggers: triggers.map((t) => ({
            workflow_id: id,
            trigger_type: t.trigger_type,
            config: t.config,
            is_active: t.is_active,
          })),
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Save failed', err);
    }
  };

  const handleRun = async () => {
    if (!id || myRole === 'viewer') return;
    try {
      const res = await triggerRun({ variables: { workflow_id: id } });
      const runId = res.data?.triggerWorkflowRun?.workflow_run_id;
      if (runId) {
        navigate(`/runs/${runId}`);
      }
    } catch (err: unknown) {
      setRunResult(err instanceof Error ? err.message : 'Run failed');
    }
  };

  if (loading && !workflow) {
    return (
      <div className="page-container loading-state">
        <Loader size={32} className="spin" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="page-container">
        <div className="empty-state">Workflow not found or access denied.</div>
      </div>
    );
  }

  return (
    <div className="builder-page">
      {/* ─── Top Bar ─── */}
      <div className="builder-topbar">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate('/')}
          aria-label="Back"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="builder-name-wrap">
          {canEdit ? (
            <input
              className="builder-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Workflow name"
            />
          ) : (
            <span className="builder-name-input">{name}</span>
          )}
        </div>

        <div className="builder-actions">
          {saved && <span className="saved-badge">✓ Saved</span>}
          {canEdit && (
            <button className="btn btn-ghost" onClick={handleSave}>
              <Save size={16} />
              Save
            </button>
          )}
          {myRole !== 'viewer' && (
            <button
              className="btn btn-primary"
              onClick={handleRun}
              disabled={triggering}
            >
              {triggering ? <Loader size={14} className="spin" /> : <Play size={14} />}
              Run
            </button>
          )}
        </div>
      </div>

      {runResult && (
        <div className="alert alert-error mx-4 mt-2">{runResult}</div>
      )}

      <div className="builder-body">
        {/* ─── Steps Panel ─── */}
        <div className="builder-steps-panel">
          <div className="panel-header">
            <h2 className="panel-title">Steps</h2>
            {canEdit && (
              <div className="add-step-row">
                {STEP_TYPES.map(({ type, label, icon }) => {
                  const ownerOnly = OWNER_ONLY_STEPS.includes(type);
                  const disabled = ownerOnly && !isOwner;
                  return (
                    <button
                      key={type}
                      className="btn btn-ghost btn-xs"
                      onClick={() => addStep(type)}
                      disabled={disabled}
                      title={disabled ? 'Owner only' : `Add ${label}`}
                    >
                      {icon}
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {steps.length === 0 ? (
            <div className="empty-steps">
              <Plus size={24} />
              <p>Add steps using the buttons above.</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={steps.map((s) => s._localId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="step-list">
                  {steps.map((step, idx) => (
                    <div key={step._localId} className="step-row">
                      <span className="step-index">{idx + 1}</span>
                      {canEdit ? (
                        <SortableStep
                          step={step}
                          isOwner={isOwner}
                          expanded={expandedSteps.has(step._localId)}
                          onToggle={() => toggleExpand(step._localId)}
                          onChange={(updated) =>
                            setSteps((prev) =>
                              prev.map((s) =>
                                s._localId === step._localId ? updated : s
                              )
                            )
                          }
                          onDelete={() => deleteStep(step._localId)}
                        />
                      ) : (
                        <div className="step-card step-readonly">
                          <span className="step-type-badge">{step.step_type}</span>
                          <span className="step-name-text">{step.name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* ─── Triggers + Info Panel ─── */}
        <div className="builder-sidebar">
          <div className="panel-header">
            <h2 className="panel-title">Triggers</h2>
          </div>
          <TriggerEditor
            triggers={triggers}
            isOwner={isOwner}
            onChange={setTriggers}
            workflowId={id}
          />

          <div className="panel-divider" />

          <div className="panel-header">
            <h2 className="panel-title">Description</h2>
          </div>
          {canEdit ? (
            <textarea
              className="form-input form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              rows={3}
            />
          ) : (
            <p className="workflow-desc-text">{description || '—'}</p>
          )}

          <div className="panel-divider" />

          <div className="recent-runs">
            <h2 className="panel-title">Recent Runs</h2>
            {workflow.workflow_runs?.length === 0 ? (
              <p className="empty-runs">No runs yet.</p>
            ) : (
              <ul className="run-list">
                {workflow.workflow_runs?.map((run) => (
                  <li key={run.id} className="run-item">
                    <span className={`run-status run-status-${run.status}`}>
                      {run.status}
                    </span>
                    <button
                      className="link-btn"
                      onClick={() => navigate(`/runs/${run.id}`)}
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
