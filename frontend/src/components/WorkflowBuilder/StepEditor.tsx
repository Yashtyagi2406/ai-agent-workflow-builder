'use client';

import { useState } from 'react';

type StepType = 'llm_call' | 'http_request' | 'db_write' | 'notify' | 'conditional_branch' | 'approval_gate';

interface Step {
  step_order: number;
  type: StepType;
  config: Record<string, unknown>;
}

interface StepEditorProps {
  step: Step;
  onChange: (updated: Step) => void;
  canEdit: boolean;
}

export function StepEditor({ step, onChange, canEdit }: StepEditorProps) {
  const [configJson, setConfigJson] = useState(JSON.stringify(step.config, null, 2));
  const [jsonError, setJsonError] = useState('');

  function handleConfigChange(val: string) {
    setConfigJson(val);
    try {
      const parsed = JSON.parse(val);
      setJsonError('');
      onChange({ ...step, config: parsed });
    } catch {
      setJsonError('Invalid JSON');
    }
  }

  return (
    <div className="space-y-4">
      {/* Step-specific helper fields */}
      {step.type === 'llm_call' && (
        <div className="space-y-3">
          <div>
            <label className="label">Prompt</label>
            <textarea
              className="input h-24 resize-none"
              value={String(step.config.prompt ?? '')}
              onChange={(e) => onChange({ ...step, config: { ...step.config, prompt: e.target.value } })}
              placeholder="Enter your LLM prompt. Use {{previousOutput.field}} to reference previous step output."
              disabled={!canEdit}
            />
            <p className="text-xs text-slate-500 mt-1">Use <code className="text-violet-400">{'{{previousOutput.text}}'}</code> to reference the previous step&apos;s output.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Model</label>
              <select
                className="input"
                value={String(step.config.model ?? 'llama3-8b-8192')}
                onChange={(e) => onChange({ ...step, config: { ...step.config, model: e.target.value } })}
                disabled={!canEdit}
              >
                <option value="llama3-8b-8192">Llama 3 8B (Groq)</option>
                <option value="llama3-70b-8192">Llama 3 70B (Groq)</option>
                <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo (OpenRouter)</option>
                <option value="openai/gpt-4o">GPT-4o (OpenRouter)</option>
              </select>
            </div>
            <div>
              <label className="label">Temperature</label>
              <input
                type="number"
                className="input"
                min={0} max={2} step={0.1}
                value={Number(step.config.temperature ?? 0.7)}
                onChange={(e) => onChange({ ...step, config: { ...step.config, temperature: parseFloat(e.target.value) } })}
                disabled={!canEdit}
              />
            </div>
          </div>
          {step.config.system !== undefined && (
            <div>
              <label className="label">System Prompt</label>
              <textarea
                className="input h-16 resize-none"
                value={String(step.config.system ?? '')}
                onChange={(e) => onChange({ ...step, config: { ...step.config, system: e.target.value } })}
                disabled={!canEdit}
              />
            </div>
          )}
        </div>
      )}

      {step.type === 'http_request' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Method</label>
              <select
                className="input"
                value={String(step.config.method ?? 'GET')}
                onChange={(e) => onChange({ ...step, config: { ...step.config, method: e.target.value } })}
                disabled={!canEdit}
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">URL</label>
              <input
                className="input"
                value={String(step.config.url ?? '')}
                onChange={(e) => onChange({ ...step, config: { ...step.config, url: e.target.value } })}
                placeholder="https://api.example.com/endpoint"
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>
      )}

      {step.type === 'conditional_branch' && (
        <div className="space-y-3">
          <div>
            <label className="label">Condition (JavaScript expression)</label>
            <input
              className="input font-mono text-sm"
              value={String(step.config.condition ?? '')}
              onChange={(e) => onChange({ ...step, config: { ...step.config, condition: e.target.value } })}
              placeholder="previousOutput.sentiment === 'positive'"
              disabled={!canEdit}
            />
            <p className="text-xs text-slate-500 mt-1">
              Access previous step output via <code className="text-violet-400">previousOutput</code>.
              Result changes the branch path for subsequent steps.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(step.config.truthy_skip_next)}
                onChange={(e) => onChange({ ...step, config: { ...step.config, truthy_skip_next: e.target.checked } })}
                disabled={!canEdit}
                className="rounded border-slate-600"
              />
              <span className="text-sm text-slate-300">Skip next step when condition is true</span>
            </label>
          </div>
        </div>
      )}

      {step.type === 'notify' && (
        <div className="space-y-3">
          <div>
            <label className="label">Slack Webhook URL (optional)</label>
            <input
              className="input"
              value={String(step.config.slack_webhook_url ?? '')}
              onChange={(e) => onChange({ ...step, config: { ...step.config, slack_webhook_url: e.target.value } })}
              placeholder="https://hooks.slack.com/services/..."
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="label">Message Template</label>
            <input
              className="input"
              value={String(step.config.message_template ?? '')}
              onChange={(e) => onChange({ ...step, config: { ...step.config, message_template: e.target.value } })}
              placeholder="Workflow {{runId}} completed."
              disabled={!canEdit}
            />
          </div>
        </div>
      )}

      {step.type === 'approval_gate' && (
        <div className="p-4 rounded-xl bg-pink-950/20 border border-pink-900/30">
          <p className="text-sm text-pink-300 font-medium">⏸ Approval Gate</p>
          <p className="text-xs text-pink-400/70 mt-1">
            Workflow will pause here until an owner or editor approves. Only owners can add this step type.
          </p>
        </div>
      )}

      {step.type === 'db_write' && (
        <div>
          <label className="label">Result Label</label>
          <input
            className="input"
            value={String(step.config.label ?? 'workflow_result')}
            onChange={(e) => onChange({ ...step, config: { ...step.config, label: e.target.value } })}
            placeholder="result_label"
            disabled={!canEdit}
          />
        </div>
      )}

      {/* Raw JSON config editor */}
      <details className="group">
        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">
          Advanced: Raw JSON config
        </summary>
        <div className="mt-2">
          <textarea
            className={`input h-32 resize-none font-mono text-xs ${jsonError ? 'border-red-700/50' : ''}`}
            value={configJson}
            onChange={(e) => handleConfigChange(e.target.value)}
            disabled={!canEdit}
          />
          {jsonError && <p className="text-xs text-red-400 mt-1">{jsonError}</p>}
        </div>
      </details>
    </div>
  );
}
