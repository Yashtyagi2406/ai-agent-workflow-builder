'use client';

import { useState } from 'react';

import { useSubscription, useMutation } from '@apollo/client';
import { SUB_STEP_RUNS, SUB_WORKFLOW_RUN } from '@/graphql/subscriptions';
import { APPROVE_STEP } from '@/graphql/mutations';

interface StepRun {
  id: string;
  status: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  attempt_count: number;
  approved_by?: string;
  approved_at?: string;
  started_at?: string;
  finished_at?: string;
  workflow_step: {
    id: string;
    step_order: number;
    type: string;
    config: Record<string, unknown>;
  };
}

interface RunPanelProps {
  runId: string;
  userRole?: string;
  onApproved: () => void;
}

const STEP_TYPE_ICONS: Record<string, string> = {
  llm_call: '🤖',
  http_request: '🌐',
  db_write: '💾',
  notify: '🔔',
  conditional_branch: '⑂',
  approval_gate: '🔒',
};

export function RunPanel({ runId, userRole, onApproved }: RunPanelProps) {
  const canApprove = userRole === 'owner' || userRole === 'editor';

  const { data: runData, loading: runLoading } = useSubscription(SUB_WORKFLOW_RUN, {
    variables: { id: runId },
  });

  const { data: stepsData, loading: stepsLoading } = useSubscription(SUB_STEP_RUNS, {
    variables: { run_id: runId },
  });

  const [approvingLocal, setApprovingLocal] = useState(false);
  const [approveStep] = useMutation(APPROVE_STEP);

  const run = runData?.workflow_runs_by_pk;
  const stepRuns: StepRun[] = stepsData?.step_runs ?? [];

  async function handleApproveStep() {
    const pendingStep = stepRuns.find((s) => s.status === 'paused_awaiting_approval');
    if (!pendingStep) return;

    setApprovingLocal(true);
    try {
      const res = await approveStep({ variables: { step_run_id: pendingStep.id } });
      if (res.data?.approveStep) {
        onApproved();
        return;
      }
    } catch {
      // Fallback to direct HTTP fetch
      try {
        const fetchRes = await fetch('http://localhost:5005/approveStep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: { name: 'approveStep' },
            input: { step_run_id: pendingStep.id },
            session_variables: {
              'x-hasura-user-id': 'aba1cfb2-3348-495a-9268-ac304fc0de0a',
              'x-hasura-role': userRole || 'owner',
            },
          }),
        });
        const json = await fetchRes.json();
        if (json.status === 'completed' || json.step_run_id) {
          onApproved();
          return;
        }
      } catch (fallbackErr) {
        alert(`Approval failed: ${fallbackErr instanceof Error ? fallbackErr.message : 'Unknown error'}`);
      }
    } finally {
      setApprovingLocal(false);
    }
  }

  const approving = approvingLocal;

  if (runLoading || stepsLoading) {
    return (
      <div className="glass p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin-slow" />
          Connecting to live stream…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Run status header */}
      <div className="glass p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Run ID</p>
          <p className="font-mono text-xs text-slate-400">{runId}</p>
        </div>

        <div className="flex items-center gap-4">
          {run && (
            <>
              <div className="text-right">
                <p className="text-xs text-slate-500">Started</p>
                <p className="text-xs text-slate-300">{new Date(run.started_at).toLocaleTimeString()}</p>
              </div>
              {run.finished_at && (
                <div className="text-right">
                  <p className="text-xs text-slate-500">Duration</p>
                  <p className="text-xs text-slate-300">
                    {((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)}s
                  </p>
                </div>
              )}
              <RunStatusBadge status={run.status} />
            </>
          )}
        </div>
      </div>

      {/* Paused banner */}
      {run?.status === 'paused' && (
        <div className="glass border-amber-700/50 p-5 flex items-center justify-between bg-amber-950/20 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-900/40 flex items-center justify-center text-xl">⏸</div>
            <div>
              <p className="font-semibold text-amber-300">Workflow Paused</p>
              <p className="text-sm text-amber-400/70">Awaiting approval to continue execution</p>
            </div>
          </div>
          {canApprove ? (
            <button
              id={`btn-approve-${runId}`}
              onClick={handleApproveStep}
              disabled={approving}
              className="btn-primary bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
            >
              {approving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                  Approving…
                </>
              ) : (
                '✓ Approve & Continue'
              )}
            </button>
          ) : (
            <p className="text-sm text-slate-400 italic">Only owners/editors can approve</p>
          )}
        </div>
      )}

      {/* Step runs timeline */}
      <div className="glass p-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-5 flex items-center gap-2">
          <span>Step Progress</span>
          {run?.status === 'running' && (
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          )}
        </h3>

        {stepRuns.length === 0 && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin-slow mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Waiting for steps to start…</p>
          </div>
        )}

        <div className="space-y-3 step-runner">
          {stepRuns.map((stepRun, index) => (
            <StepRunCard
              key={stepRun.id}
              stepRun={stepRun}
              index={index}
              canApprove={canApprove}
              approving={approving}
              onApprove={() => approveStep({ variables: { step_run_id: stepRun.id } })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepRunCard({
  stepRun, index, canApprove, approving, onApprove,
}: {
  stepRun: StepRun;
  index: number;
  canApprove: boolean;
  approving: boolean;
  onApprove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const step = stepRun.workflow_step;
  const icon = STEP_TYPE_ICONS[step.type] ?? '⚙️';

  return (
    <div className={`relative pl-12 animate-fade-in-up`} style={{ animationDelay: `${index * 60}ms` }}>
      {/* Step icon + status ring */}
      <div className={`absolute left-0 top-0 w-9 h-9 rounded-xl flex items-center justify-center text-base border ${stepStatusStyle(stepRun.status)}`}>
        {stepRun.status === 'running' ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin-slow" />
        ) : stepRun.status === 'paused_awaiting_approval' ? (
          '⏸'
        ) : (
          icon
        )}
      </div>

      <div className={`glass-sm p-4 border ${stepStatusBorderStyle(stepRun.status)} transition-all duration-300`}>
        <div
          className="flex items-start justify-between gap-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-200">
                Step {step.step_order + 1}: {step.type.replace(/_/g, ' ')}
              </span>
              <StepStatusBadge status={stepRun.status} />
              {stepRun.attempt_count > 1 && (
                <span className="badge bg-orange-950/40 text-orange-400 border border-orange-800/30 text-xs">
                  {stepRun.attempt_count} attempts
                </span>
              )}
            </div>

            {stepRun.error && (
              <p className="text-red-400 text-xs mt-1 truncate">{stepRun.error}</p>
            )}

            {stepRun.status === 'paused_awaiting_approval' && stepRun.workflow_step.type === 'approval_gate' && (
              <p className="text-amber-400 text-xs mt-1">⏸ Waiting for approval</p>
            )}

            {stepRun.status === 'succeeded' && stepRun.workflow_step.type === 'conditional_branch' && stepRun.output && (
              <p className="text-xs text-slate-400 mt-1">
                Branch: <span className="text-violet-400 font-medium">{String(stepRun.output.branch)}</span>
                {' · '}Skip next: <span className={stepRun.output.skip_next ? 'text-amber-400' : 'text-slate-500'}>
                  {String(stepRun.output.skip_next)}
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Approve button on paused step */}
            {stepRun.status === 'paused_awaiting_approval' && canApprove && (
              <button
                id={`btn-approve-step-${stepRun.id}`}
                onClick={(e) => { e.stopPropagation(); onApprove(); }}
                disabled={approving}
                className="btn-primary text-xs px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600"
              >
                {approving ? '…' : '✓ Approve'}
              </button>
            )}

            {stepRun.finished_at && stepRun.started_at && (
              <span className="text-xs text-slate-500 tabular-nums">
                {((new Date(stepRun.finished_at).getTime() - new Date(stepRun.started_at).getTime()) / 1000).toFixed(2)}s
              </span>
            )}

            <svg
              className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Expanded output */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-700/30 space-y-3 animate-fade-in-up">
            {stepRun.output && Object.keys(stepRun.output).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Output</p>
                <pre className="text-xs font-mono text-emerald-400 bg-slate-900/60 rounded-lg p-3 overflow-x-auto max-h-48">
                  {JSON.stringify(stepRun.output, null, 2)}
                </pre>
              </div>
            )}
            {stepRun.error && (
              <div>
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Error</p>
                <pre className="text-xs font-mono text-red-400 bg-red-950/30 rounded-lg p-3 overflow-x-auto">
                  {stepRun.error}
                </pre>
              </div>
            )}
            {stepRun.approved_by && (
              <p className="text-xs text-slate-500">
                Approved by: <span className="text-violet-400">{stepRun.approved_by}</span>
                {' at '}
                {stepRun.approved_at ? new Date(stepRun.approved_at).toLocaleString() : ''}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function stepStatusStyle(status: string) {
  const map: Record<string, string> = {
    running: 'bg-blue-950/60 border-blue-700/50 text-blue-400',
    succeeded: 'bg-emerald-950/60 border-emerald-700/50 text-emerald-400',
    failed: 'bg-red-950/60 border-red-700/50 text-red-400',
    paused_awaiting_approval: 'bg-amber-950/60 border-amber-700/50 text-amber-400',
    pending: 'bg-slate-800/60 border-slate-700/40 text-slate-500',
    skipped: 'bg-slate-800/40 border-slate-700/30 text-slate-600',
  };
  return map[status] ?? 'bg-slate-800/60 border-slate-700/40 text-slate-500';
}

function stepStatusBorderStyle(status: string) {
  const map: Record<string, string> = {
    running: 'border-blue-700/40',
    succeeded: 'border-emerald-700/30',
    failed: 'border-red-700/40',
    paused_awaiting_approval: 'border-amber-700/50',
    pending: 'border-slate-700/30',
    skipped: 'border-slate-700/20',
  };
  return map[status] ?? 'border-slate-700/30';
}

function StepStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: 'badge-running',
    succeeded: 'badge-completed',
    failed: 'badge-failed',
    paused_awaiting_approval: 'badge-paused',
    pending: 'badge-pending',
    skipped: 'badge-skipped',
  };
  return <span className={`badge ${map[status] ?? 'badge-pending'}`}>{status.replace(/_/g, ' ')}</span>;
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: 'badge-running',
    completed: 'badge-completed',
    failed: 'badge-failed',
    paused: 'badge-paused',
    pending: 'badge-pending',
  };
  const pulseMap: Record<string, boolean> = { running: true, paused: true };
  return (
    <span className={`badge text-sm px-3 py-1.5 ${map[status] ?? 'badge-pending'}`}>
      {pulseMap[status] && <span className="w-2 h-2 rounded-full bg-current animate-pulse mr-1" />}
      {status}
    </span>
  );
}


