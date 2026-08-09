import React from 'react';
import { DraftTrigger, TriggerType } from '../types';
import {
  MousePointerClick,
  Webhook,
  Calendar,
  Database,
  Plus,
  Trash2,
} from 'lucide-react';

const TRIGGER_ICONS: Record<TriggerType, React.ReactNode> = {
  manual: <MousePointerClick size={14} />,
  webhook: <Webhook size={14} />,
  scheduled: <Calendar size={14} />,
  db_event: <Database size={14} />,
};

const TRIGGER_LABELS: Record<TriggerType, string> = {
  manual: 'Manual',
  webhook: 'Webhook',
  scheduled: 'Scheduled (cron)',
  db_event: 'Database Event',
};

// Only owners can add webhook or db_event triggers
const OWNER_ONLY: TriggerType[] = ['webhook', 'db_event'];

interface Props {
  triggers: DraftTrigger[];
  isOwner: boolean;
  onChange: (triggers: DraftTrigger[]) => void;
  workflowId?: string;
}

export const TriggerEditor = ({ triggers, isOwner, onChange, workflowId }: Props) => {
  const addTrigger = (type: TriggerType) => {
    if (OWNER_ONLY.includes(type) && !isOwner) return;
    const id = `local-${Date.now()}`;
    onChange([
      ...triggers,
      {
        _localId: id,
        trigger_type: type,
        config: getDefaultConfig(type, workflowId),
        is_active: true,
      },
    ]);
  };

  const removeTrigger = (localId: string) => {
    onChange(triggers.filter((t) => t._localId !== localId));
  };

  const updateTrigger = (localId: string, config: Record<string, unknown>) => {
    onChange(
      triggers.map((t) => (t._localId === localId ? { ...t, config } : t))
    );
  };

  return (
    <div className="trigger-editor">
      <div className="trigger-list">
        {triggers.length === 0 && (
          <p className="empty-triggers">No triggers — add at least one to run this workflow.</p>
        )}
        {triggers.map((trigger) => (
          <div key={trigger._localId} className="trigger-card">
            <div className="trigger-header">
              <span className="trigger-icon">{TRIGGER_ICONS[trigger.trigger_type]}</span>
              <span className="trigger-label">{TRIGGER_LABELS[trigger.trigger_type]}</span>
              {OWNER_ONLY.includes(trigger.trigger_type) && (
                <span className="owner-badge">owner</span>
              )}
              <button
                className="btn btn-ghost btn-xs btn-danger ml-auto"
                onClick={() => removeTrigger(trigger._localId)}
                aria-label="Remove trigger"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <TriggerConfig
              trigger={trigger}
              onChange={(cfg) => updateTrigger(trigger._localId, cfg)}
              workflowId={workflowId}
            />
          </div>
        ))}
      </div>

      <div className="trigger-add-row">
        <span className="add-label">Add trigger:</span>
        {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((type) => {
          const disabled = OWNER_ONLY.includes(type) && !isOwner;
          return (
            <button
              key={type}
              className="btn btn-ghost btn-sm"
              onClick={() => addTrigger(type)}
              disabled={disabled}
              title={disabled ? 'Only owners can add this trigger' : undefined}
            >
              <Plus size={12} />
              {TRIGGER_LABELS[type]}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const getDefaultConfig = (
  type: TriggerType,
  workflowId?: string
): Record<string, unknown> => {
  switch (type) {
    case 'webhook':
      return {
        secret: '',
        description: `POST /api/webhookTrigger with workflow_id=${workflowId ?? 'YOUR_ID'}`,
      };
    case 'scheduled':
      return { cron: '0 9 * * 1', timezone: 'UTC' };
    case 'db_event':
      return { table: '', event: 'INSERT' };
    default:
      return {};
  }
};

interface TriggerConfigProps {
  trigger: DraftTrigger;
  onChange: (cfg: Record<string, unknown>) => void;
  workflowId?: string;
}

const TriggerConfig = ({ trigger, onChange, workflowId }: TriggerConfigProps) => {
  const set = (key: string, value: unknown) =>
    onChange({ ...trigger.config, [key]: value });

  if (trigger.trigger_type === 'manual') {
    return (
      <p className="trigger-info">Triggered by clicking the Run button in the UI.</p>
    );
  }

  if (trigger.trigger_type === 'webhook') {
    return (
      <div className="config-fields">
        <div className="form-group">
          <label className="form-label">Webhook secret</label>
          <input
            className="form-input"
            type="password"
            value={(trigger.config.secret as string) ?? ''}
            onChange={(e) => set('secret', e.target.value)}
            placeholder="my-secret-token"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Endpoint (read-only)</label>
          <input
            className="form-input font-mono"
            readOnly
            value={`POST /api/webhookTrigger — workflow_id: ${workflowId ?? 'SAVE_FIRST'}`}
          />
        </div>
      </div>
    );
  }

  if (trigger.trigger_type === 'scheduled') {
    return (
      <div className="config-fields">
        <div className="form-group">
          <label className="form-label">Cron expression (UTC)</label>
          <input
            className="form-input font-mono"
            value={(trigger.config.cron as string) ?? ''}
            onChange={(e) => set('cron', e.target.value)}
            placeholder="0 9 * * 1"
          />
          <span className="field-hint">Every minute: * * * * *  |  Daily 9am: 0 9 * * *</span>
        </div>
      </div>
    );
  }

  if (trigger.trigger_type === 'db_event') {
    return (
      <div className="config-fields">
        <div className="form-group">
          <label className="form-label">Watch table</label>
          <input
            className="form-input"
            value={(trigger.config.table as string) ?? ''}
            onChange={(e) => set('table', e.target.value)}
            placeholder="public.some_table"
          />
        </div>
        <div className="form-group">
          <label className="form-label">On event</label>
          <select
            className="form-select"
            value={(trigger.config.event as string) ?? 'INSERT'}
            onChange={(e) => set('event', e.target.value)}
          >
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>
    );
  }

  return null;
};
