'use client';

import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_WORKFLOW_STEPS } from '@/graphql/mutations';
import { StepEditor } from './StepEditor';

type StepType = 'llm_call' | 'http_request' | 'db_write' | 'notify' | 'conditional_branch' | 'approval_gate';

interface Step {
  id?: string;
  step_order: number;
  type: StepType;
  config: Record<string, unknown>;
}

interface StepListProps {
  workflowId: string;
  steps: Step[];
  canEdit: boolean;
  userRole?: string;
  onSaved: () => void;
}

const STEP_TYPE_LABELS: Record<StepType, string> = {
  llm_call: '🤖 LLM Call',
  http_request: '🌐 HTTP Request',
  db_write: '💾 DB Write',
  notify: '🔔 Notify',
  conditional_branch: '⑂ Conditional Branch',
  approval_gate: '🔒 Approval Gate',
};

const OWNER_ONLY_STEPS: StepType[] = ['db_write', 'notify', 'approval_gate'];

export function StepList({ workflowId, steps: initialSteps, canEdit, userRole, onSaved }: StepListProps) {
  const [steps, setSteps] = useState<Step[]>(
    initialSteps.map((s) => ({ ...s }))
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const [updateSteps, { loading }] = useMutation(UPDATE_WORKFLOW_STEPS, {
    onCompleted: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    },
    onError: (err) => alert(`Failed to save steps: ${err.message}`),
  });

  function addStep(type: StepType) {
    if (OWNER_ONLY_STEPS.includes(type) && userRole !== 'owner') {
      alert(`Only org owners can add "${STEP_TYPE_LABELS[type]}" steps.`);
      return;
    }
    const newStep: Step = {
      step_order: steps.length,
      type,
      config: getDefaultConfig(type),
    };
    setSteps([...steps, newStep]);
    setEditingIndex(steps.length);
  }

  function updateStep(index: number, updated: Step) {
    const next = [...steps];
    next[index] = { ...updated, step_order: index };
    setSteps(next);
  }

  function removeStep(index: number) {
    const next = steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i }));
    setSteps(next);
    if (editingIndex === index) setEditingIndex(null);
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    const next = [...steps];
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setSteps(next.map((s, i) => ({ ...s, step_order: i })));
  }

  function saveSteps() {
    updateSteps({
      variables: {
        workflow_id: workflowId,
        steps: steps.map((s) => ({
          workflow_id: workflowId,
          step_order: s.step_order,
          type: s.type,
          config: s.config,
        })),
      },
    });
  }

  const availableTypes = Object.keys(STEP_TYPE_LABELS) as StepType[];
  const userAvailableTypes = userRole === 'owner'
    ? availableTypes
    : availableTypes.filter((t) => !OWNER_ONLY_STEPS.includes(t));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">
          Steps
          <span className="ml-2 text-sm font-normal text-slate-500">({steps.length})</span>
        </h2>
        {canEdit && (
          <button
            id="btn-save-steps"
            onClick={saveSteps}
            disabled={loading}
            className="btn-primary text-sm"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                Saving…
              </>
            ) : saved ? (
              <>✓ Saved</>
            ) : (
              'Save Steps'
            )}
          </button>
        )}
      </div>

      {/* Step flow */}
      <div className="space-y-2 step-runner">
        {steps.length === 0 && (
          <div className="glass-sm p-8 text-center space-y-3">
            <p className="text-slate-400 text-sm">No steps yet. Click a step button below or load starter steps.</p>
            {canEdit && (
              <button
                id="btn-add-starter-steps"
                onClick={() => {
                  setSteps([
                    { step_order: 0, type: 'llm_call', config: { prompt: 'Analyze this task concisely.', model: 'llama-3.3-70b-versatile' } },
                    { step_order: 1, type: 'approval_gate', config: { message: 'Require human approval before continuing.' } },
                    { step_order: 2, type: 'notify', config: { channel: 'email', recipient: 'admin@org.com' } },
                  ]);
                }}
                className="btn-secondary text-xs inline-flex items-center gap-1.5 border-violet-700/50 text-violet-300 hover:bg-violet-900/30 px-4 py-2"
              >
                ✨ Add Starter Steps (LLM + Approval + Notify)
              </button>
            )}
          </div>
        )}

        {steps.map((step, index) => (
          <div key={index} className="relative animate-fade-in-up">
            {/* Connector line */}
            {index > 0 && (
              <div className="absolute -top-2 left-5 w-0.5 h-2 bg-violet-600/30" />
            )}

            <div
              className={`glass-sm border ${
                editingIndex === index
                  ? 'border-violet-600/60 glow-violet-sm'
                  : 'border-slate-700/40 hover:border-slate-600/60'
              } transition-all duration-200`}
            >
              {/* Step header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setEditingIndex(editingIndex === index ? null : index)}
              >
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="w-7 h-7 rounded-full bg-violet-900/60 border border-violet-700/50 flex items-center justify-center text-xs font-bold text-violet-300">
                    {index + 1}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <span className={`badge border ${stepTypeClass(step.type)} text-xs`}>
                    {STEP_TYPE_LABELS[step.type]}
                  </span>
                  {Boolean(step.config.prompt) && (
                    <p className="text-slate-400 text-xs mt-1 truncate">
                      {String(step.config.prompt).slice(0, 60)}…
                    </p>
                  )}
                  {Boolean(step.config.url) && (
                    <p className="text-slate-400 text-xs mt-1 truncate">{String(step.config.url)}</p>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => moveStep(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 disabled:opacity-30 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveStep(index, 'down')}
                      disabled={index === steps.length - 1}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 disabled:opacity-30 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removeStep(index)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Step editor — expanded */}
              {editingIndex === index && (
                <div className="px-4 pb-4 border-t border-slate-700/30 pt-4">
                  <StepEditor
                    step={step}
                    onChange={(updated) => updateStep(index, updated)}
                    canEdit={canEdit}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add step buttons */}
      {canEdit && (
        <div className="glass-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Add Step</p>
          <div className="flex flex-wrap gap-2">
            {userAvailableTypes.map((type) => (
              <button
                key={type}
                id={`btn-add-step-${type}`}
                onClick={() => addStep(type)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all duration-200 hover:scale-105 ${stepTypeClass(type)}`}
              >
                {STEP_TYPE_LABELS[type]}
              </button>
            ))}
            {userRole !== 'owner' && OWNER_ONLY_STEPS.map((type) => (
              <button
                key={type}
                onClick={() => addStep(type)}
                className="text-xs px-3 py-1.5 rounded-lg border font-medium text-slate-600 border-slate-700/30 bg-slate-800/30 cursor-not-allowed"
                title="Owners only"
              >
                🔒 {STEP_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function stepTypeClass(type: string) {
  const map: Record<string, string> = {
    llm_call: 'step-type-llm_call',
    http_request: 'step-type-http_request',
    db_write: 'step-type-db_write',
    notify: 'step-type-notify',
    conditional_branch: 'step-type-conditional_branch',
    approval_gate: 'step-type-approval_gate',
  };
  return map[type] ?? 'bg-slate-800/60 text-slate-400 border-slate-700/40';
}

function getDefaultConfig(type: StepType): Record<string, unknown> {
  switch (type) {
    case 'llm_call':
      return { prompt: 'Analyze the following and respond concisely:', model: 'llama3-8b-8192', temperature: 0.7 };
    case 'http_request':
      return { url: 'https://httpbin.org/get', method: 'GET' };
    case 'db_write':
      return { label: 'workflow_result' };
    case 'notify':
      return { message_template: 'Workflow run {{runId}} completed.' };
    case 'conditional_branch':
      return { condition: "previousOutput.sentiment === 'positive'", truthy_skip_next: false };
    case 'approval_gate':
      return { message: 'Awaiting approval to continue.' };
    default:
      return {};
  }
}
