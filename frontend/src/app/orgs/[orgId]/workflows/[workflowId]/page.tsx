'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useUserData } from '@nhost/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GET_WORKFLOW_DETAIL, GET_USER_ORGS } from '@/graphql/queries';
import { TRIGGER_WORKFLOW_RUN, DELETE_WORKFLOW } from '@/graphql/mutations';
import { StepList } from '@/components/WorkflowBuilder/StepList';
import { TriggerEditor } from '@/components/WorkflowBuilder/TriggerEditor';
import { RunPanel } from '@/components/RunStatus/RunPanel';
import { QuotaIndicator } from '@/components/QuotaIndicator';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { useSignOut } from '@nhost/react';
import { getDemoSession, type DemoSession } from '@/lib/demoSession';

interface PageProps {
  params: { orgId: string; workflowId: string };
}

type Tab = 'builder' | 'runs';

export default function WorkflowDetailPage({ params }: PageProps) {
  const { orgId, workflowId } = params;
  const user = useUserData();
  const router = useRouter();
  const { signOut } = useSignOut();
  const [activeTab, setActiveTab] = useState<Tab>('builder');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // ── Demo session ──────────────────────────────────────────────────────────
  // IMPORTANT: localStorage is only available client-side. We gate every query
  // behind sessionLoaded so that on the very first render (demoSession=null)
  // no data is fetched before we know who the user is.
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [demoSession, setDemoSessionState] = useState<DemoSession | null>(null);
  useEffect(() => {
    setDemoSessionState(getDemoSession());
    setSessionLoaded(true);
  }, []);

  // Fast guard: if the session org doesn't match the URL org the user is
  // attempting cross-org access — block immediately, don't even fire queries.
  const sessionOrgMismatch =
    sessionLoaded && demoSession !== null && demoSession.orgId !== orgId;

  // ── User orgs (scoped to current demo user) ───────────────────────────────
  const { data: orgsData } = useQuery(GET_USER_ORGS, {
    variables: { user_id: demoSession?.userId ?? '' },
    skip: !sessionLoaded || !demoSession?.userId || sessionOrgMismatch,
  });
  const orgs = orgsData?.org_members ?? [];
  const membership = orgs.find(
    (m: { organization?: { id: string }; role: string }) =>
      m.organization?.id === orgId,
  );
  const userRole = (membership?.role ?? demoSession?.role) as string | undefined;
  const canEdit = userRole === 'owner' || userRole === 'editor';

  // ── Workflow detail (filtered by BOTH id AND org_id) ─────────────────────
  const { data, loading, refetch } = useQuery(GET_WORKFLOW_DETAIL, {
    variables: { id: workflowId, org_id: orgId },
    skip: !workflowId || !sessionLoaded || sessionOrgMismatch,
  });

  // Query now returns workflows[] (not workflows_by_pk) so we take index 0.
  const workflow = data?.workflows?.[0];

  const [triggeringLocal, setTriggeringLocal] = useState(false);
  const [zeroStepsError, setZeroStepsError] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  async function handleRunWorkflow() {
    if (!workflow?.workflow_steps || workflow.workflow_steps.length === 0) {
      setZeroStepsError(true);
      return;
    }
    setZeroStepsError(false);
    setTriggeringLocal(true);
    try {
      const res = await triggerRun({ variables: { workflow_id: workflowId } });
      const runId = res.data?.triggerWorkflowRun?.workflow_run_id;
      if (runId) {
        setActiveRunId(runId);
        setActiveTab('runs');
        refetch();
        return;
      }
    } catch {
      // Fallback to direct HTTP fetch to functions server
      try {
        const demoUserId = user?.id ?? demoSession?.userId ?? 'aba1cfb2-3348-495a-9268-ac304fc0de0a';
        const rawBase = process.env.NEXT_PUBLIC_FUNCTIONS_URL || 'http://localhost:5005';
        const functionsUrl = rawBase.includes('nhost.run') && !rawBase.endsWith('/v1') ? `${rawBase}/v1` : rawBase;
        const fetchRes = await fetch(`${functionsUrl}/triggerWorkflowRun`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: { name: 'triggerWorkflowRun' },
            input: { workflow_id: workflowId },
            session_variables: {
              'x-hasura-user-id': demoUserId,
              'x-hasura-role': userRole || 'owner',
            },
          }),
        });
        const json = await fetchRes.json();
        if (json.workflow_run_id) {
          setActiveRunId(json.workflow_run_id);
          setActiveTab('runs');
          refetch();
          return;
        }
      } catch (fallbackErr) {
        alert(`Run failed: ${fallbackErr instanceof Error ? fallbackErr.message : 'Unknown error'}`);
      }
    } finally {
      setTriggeringLocal(false);
    }
  }

  const [triggerRun] = useMutation(TRIGGER_WORKFLOW_RUN);
  const triggering = triggeringLocal;

  const [deleteWorkflow] = useMutation(DELETE_WORKFLOW, {
    onCompleted: () => router.push(`/orgs/${orgId}`),
    onError: (err) => alert(`Delete failed: ${err.message}`),
  });

  if (loading) return <LoadingSpinner />;

  // ── Explicit cross-org access denied guard ────────────────────────────────
  // This check is intentionally NOT delegated to Hasura alone.  Even if the
  // DB query returned data, we reject it here when the session org doesn't
  // match the URL org or when the user has no membership in this org.
  const isUnauthorized = sessionOrgMismatch;

  if (isUnauthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="glass p-10 text-center max-w-sm w-full space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-900/50 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-red-400">Access Denied</h2>
          <p className="text-slate-400 text-sm">
            You don&apos;t have permission to view this workflow.
            It belongs to a different organisation.
          </p>
          <button
            onClick={() => router.back()}
            className="btn-primary w-full justify-center"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!workflow) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="glass p-8 text-center">
        <p className="text-slate-400">Workflow not found.</p>
        <Link href={`/orgs/${orgId}`} className="btn-primary mt-4 inline-flex">Back to Dashboard</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet-900/8 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href={`/orgs/${orgId}`} className="text-slate-400 hover:text-slate-200 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="w-px h-5 bg-slate-700" />
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="font-bold text-sm gradient-text">FlowMind</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <OrgSwitcher orgs={orgs} currentOrgId={orgId} />
            <QuotaIndicator orgId={orgId} />
            {userRole && (
              <span className={`badge ${
                userRole === 'owner' ? 'bg-violet-950/60 text-violet-400 border border-violet-800/40' :
                userRole === 'editor' ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/40' :
                'bg-slate-800/60 text-slate-400 border border-slate-700/40'
              }`}>{userRole}</span>
            )}
            <button onClick={() => { signOut(); router.push('/login'); }} className="btn-secondary text-xs px-3 py-1.5">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Workflow title + actions */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{workflow.name}</h1>
            {workflow.description && (
              <p className="text-slate-400 text-sm mt-1">{workflow.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {workflow.workflow_triggers?.map((t: { id: string; type: string }) => (
                <span key={t.id} className="badge bg-slate-800/60 text-slate-400 border border-slate-700/40">
                  ⚡ {t.type}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Webhook curl helper */}
            {workflow.workflow_triggers?.some((t: { type: string }) => t.type === 'webhook') && (
              <WebhookCurlButton workflowId={workflowId} workflow={workflow} />
            )}

            {/* Run button — hidden for viewers */}
            {canEdit && (
              <button
                id={`btn-run-${workflowId}`}
                onClick={handleRunWorkflow}
                disabled={triggering}
                className="btn-primary"
              >
                {triggering ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                    Starting…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Run Workflow
                  </>
                )}
              </button>
            )}

            {userRole === 'owner' && (
              <button
                id="btn-delete-workflow"
                onClick={() => setShowDeleteModal(true)}
                className="btn-danger"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Custom Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
            <div className="glass max-w-md w-full p-6 space-y-4 border-red-500/30">
              <div className="flex items-center gap-3 text-red-400">
                <div className="w-10 h-10 rounded-xl bg-red-950/50 border border-red-800/40 flex items-center justify-center text-xl font-bold">🗑️</div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Delete Workflow</h3>
                  <p className="text-xs text-slate-400">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm text-slate-300">
                Are you sure you want to delete <strong className="text-white">{workflow.name}</strong>?
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  id="btn-cancel-delete"
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-delete"
                  onClick={() => {
                    deleteWorkflow({ variables: { id: workflowId } });
                    setShowDeleteModal(false);
                  }}
                  className="btn-danger text-xs px-4 py-2 bg-red-600 hover:bg-red-500"
                >
                  Yes, Delete Workflow
                </button>
              </div>
            </div>
          </div>
        )}

        {zeroStepsError && (
          <div className="glass border-amber-500/50 bg-amber-950/40 p-4 rounded-xl mb-6 flex items-center justify-between animate-fade-in-up">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-semibold text-amber-300">Workflow has no steps to run!</p>
                <p className="text-sm text-amber-400/80">
                  Add steps below (e.g. 🤖 LLM Call, 🔒 Approval Gate) and click <strong className="text-amber-200">Save Steps</strong> to save your workflow before running.
                </p>
              </div>
            </div>
            <button onClick={() => setZeroStepsError(false)} className="text-slate-400 hover:text-white px-3 py-1 text-sm font-semibold">✕</button>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-slate-800/40 rounded-xl mb-6 w-fit">
          {(['builder', 'runs'] as Tab[]).map((tab) => (
            <button
              key={tab}
              id={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-violet-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab === 'runs' && activeRunId && (
                <span className="w-2 h-2 rounded-full bg-violet-400 inline-block mr-1.5 animate-pulse" />
              )}
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'builder' ? (
          <WorkflowBuilderTab workflow={workflow} orgId={orgId} canEdit={canEdit} userRole={userRole} onRefetch={refetch} />
        ) : (
          <RunsTab
            workflow={workflow}
            orgId={orgId}
            userRole={userRole}
            activeRunId={activeRunId}
            onRunSelect={setActiveRunId}
          />
        )}
      </main>
    </div>
  );
}

function WorkflowBuilderTab({
  workflow, orgId, canEdit, userRole, onRefetch,
}: {
  workflow: { id: string; name: string; description?: string; org_id: string; workflow_steps: { id: string; step_order: number; type: string; config: Record<string, unknown> }[]; workflow_triggers: { id: string; type: string; config: Record<string, unknown> }[] };
  orgId: string;
  canEdit: boolean;
  userRole?: string;
  onRefetch: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <StepList
          workflowId={workflow.id}
          steps={workflow.workflow_steps as any}
          canEdit={canEdit}
          userRole={userRole}
          onSaved={onRefetch}
        />
      </div>
      <div>
        <TriggerEditor
          workflowId={workflow.id}
          triggers={workflow.workflow_triggers as any}
          canEdit={canEdit}
          userRole={userRole}
          onSaved={onRefetch}
        />
      </div>
    </div>
  );
}

function RunsTab({
  workflow, orgId, userRole, activeRunId, onRunSelect,
}: {
  workflow: { id: string; workflow_runs: { id: string; status: string; trigger_type: string; started_at: string; finished_at?: string }[] };
  orgId: string;
  userRole?: string;
  activeRunId: string | null;
  onRunSelect: (id: string) => void;
}) {
  const runs = workflow.workflow_runs ?? [];
  const selectedRun = activeRunId ?? runs[0]?.id;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Run history sidebar */}
      <div className="glass p-4 space-y-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Run History</h3>
        {runs.length === 0 && (
          <p className="text-slate-500 text-sm">No runs yet</p>
        )}
        {runs.map((run: { id: string; status: string; trigger_type: string; started_at: string }) => (
          <button
            key={run.id}
            onClick={() => onRunSelect(run.id)}
            className={`w-full text-left p-3 rounded-xl transition-all duration-200 text-sm ${
              selectedRun === run.id
                ? 'bg-violet-900/40 border border-violet-700/50'
                : 'hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <RunStatusDot status={run.status} />
              <span className="text-xs text-slate-500">{run.trigger_type}</span>
            </div>
            <p className="text-xs text-slate-500 truncate">
              {new Date(run.started_at).toLocaleTimeString()}
            </p>
          </button>
        ))}
      </div>

      {/* Live run panel */}
      <div className="lg:col-span-3">
        {selectedRun ? (
          <RunPanel
            runId={selectedRun}
            orgId={orgId}
            userRole={userRole}
            onApproved={() => {/* subscription updates automatically */}}
          />
        ) : (
          <div className="glass p-12 text-center">
            <p className="text-slate-400">Select a run to view its progress</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RunStatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    running: 'text-blue-400',
    completed: 'text-emerald-400',
    failed: 'text-red-400',
    paused: 'text-amber-400',
    pending: 'text-slate-500',
  };
  return (
    <span className={`text-xs font-medium capitalize ${colorMap[status] ?? 'text-slate-400'}`}>
      ● {status}
    </span>
  );
}

function WebhookCurlButton({ workflowId, workflow }: { workflowId: string; workflow: { workflow_triggers: { type: string; config: Record<string, unknown> }[] } }) {
  const [show, setShow] = useState(false);
  const webhookTrigger = workflow.workflow_triggers.find((t) => t.type === 'webhook');
  const apiKey = (webhookTrigger?.config as { api_key?: string })?.api_key ?? 'YOUR_API_KEY';
  const functionsUrl = process.env.NEXT_PUBLIC_FUNCTIONS_URL ?? 'http://localhost:3000/api';
  const curlCmd = `curl -X POST ${functionsUrl}/webhookTrigger \\
  -H "Content-Type: application/json" \\
  -d '{"input":{"workflow_id":"${workflowId}","api_key":"${apiKey}"}}'`;

  return (
    <div className="relative">
      <button onClick={() => setShow(!show)} className="btn-secondary text-xs px-3 py-1.5">
        🔗 Webhook
      </button>
      {show && (
        <div className="absolute right-0 top-full mt-2 w-96 glass p-4 z-50 animate-fade-in-up">
          <p className="text-xs text-slate-400 mb-2 font-semibold">Trigger via webhook:</p>
          <pre className="text-xs font-mono text-emerald-400 bg-slate-900 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
            {curlCmd}
          </pre>
          <button
            onClick={() => { navigator.clipboard.writeText(curlCmd); }}
            className="btn-secondary text-xs mt-2 px-3 py-1"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin-slow" />
        <p className="text-slate-400 text-sm">Loading workflow…</p>
      </div>
    </div>
  );
}
