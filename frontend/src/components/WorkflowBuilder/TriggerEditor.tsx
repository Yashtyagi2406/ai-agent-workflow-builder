'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_WORKFLOW_TRIGGERS } from '@/graphql/mutations';

type TriggerType = 'manual' | 'webhook' | 'scheduled' | 'database_event';

interface Trigger {
  id?: string;
  type: TriggerType;
  config: Record<string, unknown>;
}

interface TriggerEditorProps {
  workflowId: string;
  triggers: Trigger[];
  canEdit: boolean;
  userRole?: string;
  onSaved: () => void;
}

const OWNER_ONLY_TRIGGERS: TriggerType[] = ['webhook', 'database_event'];

const TRIGGER_LABELS: Record<TriggerType, { label: string; icon: string; desc: string }> = {
  manual: { label: 'Manual', icon: '▶️', desc: 'Start via the Run button' },
  webhook: { label: 'Webhook', icon: '🔗', desc: 'Triggered by external HTTP POST (owners only)' },
  scheduled: { label: 'Scheduled', icon: '🕐', desc: 'Run on a cron schedule' },
  database_event: { label: 'DB Event', icon: '⚡', desc: 'Auto-start on a table row change (owners only)' },
};

export function TriggerEditor({ workflowId, triggers: initialTriggers, canEdit, userRole, onSaved }: TriggerEditorProps) {
  const [triggers, setTriggers] = useState<Trigger[]>(initialTriggers.map((t) => ({ ...t })));
  const [saved, setSaved] = useState(false);

  const [updateTriggers, { loading }] = useMutation(UPDATE_WORKFLOW_TRIGGERS, {
    onCompleted: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    },
    onError: (err) => alert(`Failed to save triggers: ${err.message}`),
  });

  function addTrigger(type: TriggerType) {
    if (OWNER_ONLY_TRIGGERS.includes(type) && userRole !== 'owner') {
      alert(`Only org owners can add "${TRIGGER_LABELS[type].label}" triggers.`);
      return;
    }
    if (triggers.some((t) => t.type === type)) {
      alert(`A ${type} trigger already exists.`);
      return;
    }
    setTriggers([...triggers, { type, config: getDefaultTriggerConfig(type) }]);
  }

  function removeTrigger(index: number) {
    setTriggers(triggers.filter((_, i) => i !== index));
  }

  function updateTriggerConfig(index: number, config: Record<string, unknown>) {
    const next = [...triggers];
    next[index] = { ...next[index], config };
    setTriggers(next);
  }

  function saveTriggers() {
    updateTriggers({
      variables: {
        workflow_id: workflowId,
        triggers: triggers.map((t) => ({
          workflow_id: workflowId,
          type: t.type,
          config: t.config,
        })),
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Triggers</h2>
        {canEdit && (
          <button
            id="btn-save-triggers"
            onClick={saveTriggers}
            disabled={loading}
            className="btn-primary text-sm"
          >
            {loading ? 'Saving…' : saved ? '✓ Saved' : 'Save Triggers'}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {triggers.map((trigger, index) => (
          <div key={index} className="glass-sm p-4 space-y-3 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{TRIGGER_LABELS[trigger.type]?.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{TRIGGER_LABELS[trigger.type]?.label}</p>
                  <p className="text-xs text-slate-500">{TRIGGER_LABELS[trigger.type]?.desc}</p>
                </div>
              </div>
              {canEdit && (
                <button onClick={() => removeTrigger(index)} className="btn-danger text-xs px-2 py-1">
                  Remove
                </button>
              )}
            </div>

            {/* Trigger-specific config */}
            {trigger.type === 'webhook' && (
              <div>
                <label className="label">API Key</label>
                <div className="flex gap-2">
                  <input
                    className="input font-mono text-sm"
                    value={String(trigger.config.api_key ?? '')}
                    onChange={(e) => updateTriggerConfig(index, { ...trigger.config, api_key: e.target.value })}
                    placeholder="my-secret-api-key"
                    disabled={!canEdit}
                  />
                  <button
                    onClick={() => updateTriggerConfig(index, { ...trigger.config, api_key: generateApiKey() })}
                    className="btn-secondary text-xs flex-shrink-0"
                    disabled={!canEdit}
                  >
                    Generate
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Include this key as <code className="text-violet-400">api_key</code> in your webhook POST payload.
                </p>
              </div>
            )}

            {trigger.type === 'scheduled' && (
              <div>
                <label className="label">Cron Expression</label>
                <input
                  className="input font-mono text-sm"
                  value={String(trigger.config.cron ?? '*/5 * * * *')}
                  onChange={(e) => updateTriggerConfig(index, { ...trigger.config, cron: e.target.value })}
                  placeholder="*/5 * * * *"
                  disabled={!canEdit}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Standard cron: minute hour day month weekday. E.g. <code className="text-violet-400">0 9 * * 1-5</code> = 9am weekdays.
                </p>
              </div>
            )}

            {trigger.type === 'database_event' && (
              <div className="space-y-2">
                <div>
                  <label className="label">Watched Table (schema.table)</label>
                  <input
                    className="input text-sm"
                    value={String(trigger.config.watched_table ?? 'public.')}
                    onChange={(e) => updateTriggerConfig(index, { ...trigger.config, watched_table: e.target.value })}
                    placeholder="public.my_table"
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <label className="label">Operation</label>
                  <select
                    className="input text-sm"
                    value={String(trigger.config.watched_op ?? 'INSERT')}
                    onChange={(e) => updateTriggerConfig(index, { ...trigger.config, watched_op: e.target.value })}
                    disabled={!canEdit}
                  >
                    <option value="INSERT">INSERT</option>
                    <option value="UPDATE">UPDATE</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
              </div>
            )}

            {trigger.type === 'manual' && (
              <p className="text-xs text-slate-500">No configuration needed — use the Run button.</p>
            )}
          </div>
        ))}

        {triggers.length === 0 && (
          <div className="glass-sm p-6 text-center">
            <p className="text-slate-500 text-sm">No triggers configured</p>
          </div>
        )}
      </div>

      {/* Add trigger */}
      {canEdit && (
        <div className="glass-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Add Trigger</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((type) => {
              const isOwnerOnly = OWNER_ONLY_TRIGGERS.includes(type);
              const notAllowed = isOwnerOnly && userRole !== 'owner';
              const alreadyAdded = triggers.some((t) => t.type === type);
              return (
                <button
                  key={type}
                  id={`btn-add-trigger-${type}`}
                  onClick={() => addTrigger(type)}
                  disabled={alreadyAdded}
                  title={notAllowed ? 'Owners only' : alreadyAdded ? 'Already added' : ''}
                  className={`text-xs px-3 py-2 rounded-lg border font-medium flex items-center gap-1.5 transition-all duration-200 ${
                    alreadyAdded
                      ? 'opacity-40 cursor-not-allowed bg-slate-800/40 border-slate-700/30 text-slate-500'
                      : notAllowed
                      ? 'cursor-not-allowed bg-slate-800/30 border-slate-700/20 text-slate-600'
                      : 'hover:scale-105 bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-700/60'
                  }`}
                >
                  <span>{TRIGGER_LABELS[type].icon}</span>
                  {TRIGGER_LABELS[type].label}
                  {notAllowed && <span className="text-slate-600">🔒</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function getDefaultTriggerConfig(type: TriggerType): Record<string, unknown> {
  switch (type) {
    case 'webhook':
      return { api_key: generateApiKey() };
    case 'scheduled':
      return { cron: '*/30 * * * *' };
    case 'database_event':
      return { watched_table: 'public.', watched_op: 'INSERT' };
    default:
      return {};
  }
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
