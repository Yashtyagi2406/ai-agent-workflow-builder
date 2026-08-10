'use client';

import { useQuery, gql } from '@apollo/client';
import { useAuthenticationStatus, useSignOut, useUserData } from '@nhost/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GET_USER_ORGS, GET_ORG_USAGE, GET_ORG_WORKFLOWS } from '@/graphql/queries';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { QuotaIndicator } from '@/components/QuotaIndicator';

interface PageProps {
  params: { orgId: string };
}

const GET_ORG_BY_PK = gql`
  query GetOrgByPk($id: uuid!) {
    organizations_by_pk(id: $id) {
      id
      name
      calls_allowed
      calls_used
    }
  }
`;

export default function OrgDashboard({ params }: PageProps) {
  const { orgId } = params;
  const user = useUserData();
  const router = useRouter();
  const { signOut } = useSignOut();

  const { data: userOrgsData, loading: userOrgsLoading } = useQuery(GET_USER_ORGS);
  const { data: directOrgData, loading: directOrgLoading } = useQuery(GET_ORG_BY_PK, {
    variables: { id: orgId },
  });

  const orgs = userOrgsData?.org_members ?? [];
  const currentMembership = orgs.find((m: { organization: { id: string }; role: string }) => m.organization.id === orgId);
  
  const currentOrg = currentMembership?.organization || directOrgData?.organizations_by_pk;
  const userRole = currentMembership?.role || 'owner';

  const loading = userOrgsLoading && directOrgLoading;

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!currentOrg) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
        <div className="glass p-8 text-center max-w-md">
          <p className="text-slate-400 font-medium">Organization not found or access denied.</p>
          <button onClick={() => router.push('/login')} className="btn-primary mt-4">
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 selection:bg-violet-500/30">
      {/* Background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 right-1/4 w-[700px] h-[700px] bg-violet-900/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-indigo-900/15 rounded-full blur-[100px]" />
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 backdrop-blur-2xl bg-[#080d1a]/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 flex items-center justify-center glow-violet-sm group-hover:scale-105 transition-transform duration-200">
              <svg className="w-5 h-5 text-white" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight gradient-text">FlowMind</span>
          </Link>

          <div className="flex items-center gap-3">
            <OrgSwitcher orgs={orgs.length > 0 ? orgs : [{ role: 'owner', organization: currentOrg }]} currentOrgId={orgId} />
            <QuotaIndicator orgId={orgId} />

            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                {user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-200 leading-tight">
                  {user?.displayName ?? user?.email?.split('@')[0] ?? 'Demo Admin'}
                </p>
                {userRole && (
                  <span className="text-[10px] font-bold tracking-wider uppercase text-violet-400">
                    {userRole}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => { signOut(); router.push('/login'); }}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        {/* Page Banner */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-100 tracking-tight">
                {currentOrg.name}
              </h1>
              <span className={`badge ${
                userRole === 'owner' ? 'bg-violet-950/70 text-violet-300 border-violet-700/50' :
                userRole === 'editor' ? 'bg-cyan-950/70 text-cyan-300 border-cyan-700/50' :
                'bg-slate-800/80 text-slate-400 border-slate-700/50'
              }`}>
                {userRole}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Build, trigger, and monitor AI agent workflows with multi-layer authorization.
            </p>
          </div>

          {(userRole === 'owner' || userRole === 'editor') && (
            <Link
              id="btn-new-workflow"
              href={`/orgs/${orgId}/workflows/new`}
              className="btn-primary self-start md:self-auto"
            >
              <svg className="w-4.5 h-4.5" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New Workflow
            </Link>
          )}
        </div>

        {/* Stats Summary Bar */}
        <DashboardStats orgId={orgId} />

        {/* Workflow Grid */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <span>Workflows</span>
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          </h2>
          <WorkflowList orgId={orgId} userRole={userRole} />
        </div>
      </main>
    </div>
  );
}

function DashboardStats({ orgId }: { orgId: string }) {
  const { data: usageData } = useQuery(GET_ORG_USAGE, { variables: { org_id: orgId }, pollInterval: 30000 });
  const { data: wfData } = useQuery(GET_ORG_WORKFLOWS, { variables: { org_id: orgId } });

  const usage = usageData?.org_usage_this_month?.[0];
  const totalWorkflows = wfData?.workflows?.length ?? 0;
  const runsThisMonth = usage?.runs_this_month ?? 0;
  const avgDuration = usage?.avg_run_duration_seconds ? `${Number(usage.avg_run_duration_seconds).toFixed(1)}s` : '—';
  const callsUsed = usage?.calls_used ?? 0;
  const callsAllowed = usage?.calls_allowed ?? 1000;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in-up">
      <div className="glass-sm p-5 border-l-4 border-l-violet-500">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Workflows</p>
        <p className="text-2xl font-bold text-slate-100 mt-1 tabular-nums">{totalWorkflows}</p>
      </div>

      <div className="glass-sm p-5 border-l-4 border-l-indigo-500">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Runs This Month</p>
        <p className="text-2xl font-bold text-indigo-300 mt-1 tabular-nums">{runsThisMonth}</p>
      </div>

      <div className="glass-sm p-5 border-l-4 border-l-cyan-500">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Run Duration</p>
        <p className="text-2xl font-bold text-cyan-300 mt-1 tabular-nums">{avgDuration}</p>
      </div>

      <div className="glass-sm p-5 border-l-4 border-l-emerald-500">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quota Used</p>
        <p className="text-2xl font-bold text-emerald-300 mt-1 tabular-nums">
          {callsUsed} <span className="text-xs text-slate-500 font-normal">/ {callsAllowed}</span>
        </p>
      </div>
    </div>
  );
}

function WorkflowList({ orgId, userRole }: { orgId: string; userRole?: string }) {
  const { data, loading } = useQuery(GET_ORG_WORKFLOWS, {
    variables: { org_id: orgId },
    pollInterval: 10000,
  });

  const workflows = data?.workflows ?? [];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass p-6 h-52 skeleton rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="glass p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-950/40 border border-violet-800/40 flex items-center justify-center mx-auto mb-4 glow-violet-sm">
          <svg className="w-8 h-8 text-violet-400" width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-slate-200 font-semibold text-lg">No workflows created yet</p>
        <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
          Chain LLM calls, HTTP requests, DB writes, and approval gates into powerful automation loops.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {workflows.map((wf: {
        id: string;
        name: string;
        description?: string;
        workflow_steps: { type: string }[];
        workflow_triggers: { type: string }[];
        workflow_runs: { id: string; status: string; started_at: string }[];
      }) => {
        const latestRun = wf.workflow_runs[0];
        return (
          <Link
            key={wf.id}
            href={`/orgs/${orgId}/workflows/${wf.id}`}
            id={`workflow-card-${wf.id}`}
            className="glass glass-hover p-6 group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between mb-3 gap-2">
                <h3 className="font-semibold text-base text-slate-100 group-hover:text-violet-300 transition-colors line-clamp-1">
                  {wf.name}
                </h3>
                {latestRun && (
                  <StatusBadge status={latestRun.status} />
                )}
              </div>

              {wf.description && (
                <p className="text-slate-400 text-xs mb-4 line-clamp-2 leading-relaxed">
                  {wf.description}
                </p>
              )}

              {/* Step Type Badges */}
              <div className="flex flex-wrap gap-1.5 mb-5">
                {wf.workflow_steps.slice(0, 4).map((step, i) => (
                  <span key={i} className={`badge border ${stepTypeClass(step.type)} lowercase`}>
                    {stepTypeIcon(step.type)} {step.type.replace(/_/g, ' ')}
                  </span>
                ))}
                {wf.workflow_steps.length > 4 && (
                  <span className="badge badge-pending">+{wf.workflow_steps.length - 4}</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-800/60">
              <span className="flex items-center gap-1.5 font-medium text-slate-400">
                <span className="text-amber-400">⚡</span>
                {wf.workflow_triggers.map((t) => t.type).join(', ') || 'Manual'}
              </span>
              <span className="font-mono text-slate-400">
                {wf.workflow_steps.length} step{wf.workflow_steps.length !== 1 ? 's' : ''}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    running: 'badge-running',
    completed: 'badge-completed',
    failed: 'badge-failed',
    paused: 'badge-paused',
    pending: 'badge-pending',
  };
  const dots: Record<string, string> = {
    running: 'bg-blue-400 animate-pulse',
    completed: 'bg-emerald-400',
    failed: 'bg-red-400',
    paused: 'bg-amber-300 animate-pulse',
    pending: 'bg-slate-500',
  };
  return (
    <span className={`badge ${classes[status] ?? 'badge-pending'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] ?? 'bg-slate-500'}`} />
      {status}
    </span>
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

function stepTypeIcon(type: string) {
  const icons: Record<string, string> = {
    llm_call: '🤖',
    http_request: '🌐',
    db_write: '💾',
    notify: '🔔',
    conditional_branch: '⑂',
    approval_gate: '🔒',
  };
  return icons[type] ?? '⚙️';
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin-slow" />
        <p className="text-slate-400 text-sm font-medium">Loading Dashboard…</p>
      </div>
    </div>
  );
}
