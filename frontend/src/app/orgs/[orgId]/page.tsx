'use client';

import { useQuery } from '@apollo/client';
import { useAuthenticationStatus, useSignOut, useUserData } from '@nhost/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GET_USER_ORGS } from '@/graphql/queries';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { QuotaIndicator } from '@/components/QuotaIndicator';

interface PageProps {
  params: { orgId: string };
}

export default function OrgDashboard({ params }: PageProps) {
  const { orgId } = params;
  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  const user = useUserData();
  const router = useRouter();
  const { signOut } = useSignOut();

  const { data, loading } = useQuery(GET_USER_ORGS, { skip: !isAuthenticated });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const orgs = data?.org_members ?? [];
  const currentMembership = orgs.find((m: { organization: { id: string }; role: string }) => m.organization.id === orgId);
  const currentOrg = currentMembership?.organization;
  const userRole = currentMembership?.role;

  // Org workflows are fetched on the workflow builder page
  // Here we just show org overview + navigation

  if (isLoading || loading) {
    return <LoadingSkeleton />;
  }

  if (!currentOrg) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="glass p-8 text-center max-w-md">
          <p className="text-slate-400">Organization not found or you don&apos;t have access.</p>
          <button onClick={() => router.push('/')} className="btn-primary mt-4">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Fixed background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet-900/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-900/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center glow-violet-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-bold text-base gradient-text">FlowMind</span>
          </Link>

          <div className="flex items-center gap-3">
            <OrgSwitcher orgs={orgs} currentOrgId={orgId} />
            <QuotaIndicator orgId={orgId} />

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                {user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="text-sm text-slate-300 hidden sm:block">
                {user?.displayName ?? user?.email?.split('@')[0]}
              </span>
              {userRole && (
                <span className={`badge ${
                  userRole === 'owner' ? 'bg-violet-950/60 text-violet-400 border border-violet-800/40' :
                  userRole === 'editor' ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/40' :
                  'bg-slate-800/60 text-slate-400 border border-slate-700/40'
                }`}>
                  {userRole}
                </span>
              )}
            </div>

            <button onClick={() => { signOut(); router.push('/login'); }} className="btn-secondary text-xs px-3 py-1.5">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">
              {currentOrg.name}
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              {orgs.length} organization{orgs.length !== 1 ? 's' : ''} · Your role: <span className="text-violet-400 font-medium">{userRole}</span>
            </p>
          </div>
          {(userRole === 'owner' || userRole === 'editor') && (
            <Link
              id="btn-new-workflow"
              href={`/orgs/${orgId}/workflows/new`}
              className="btn-primary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Workflow
            </Link>
          )}
        </div>

        {/* Workflow list — lazy loaded via link */}
        <WorkflowList orgId={orgId} userRole={userRole} />
      </main>
    </div>
  );
}

function WorkflowList({ orgId, userRole }: { orgId: string; userRole?: string }) {
  const { useQuery: useGqlQuery } = require('@apollo/client');
  const { GET_ORG_WORKFLOWS } = require('@/graphql/queries');
  const router = useRouter();

  const { data, loading } = useGqlQuery(GET_ORG_WORKFLOWS, {
    variables: { org_id: orgId },
    pollInterval: 10000,
  });

  const workflows = data?.workflows ?? [];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass p-6 h-48 skeleton rounded-2xl" />
        ))}
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="glass p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-slate-400 font-medium">No workflows yet</p>
        <p className="text-slate-500 text-sm mt-1">Create your first AI agent workflow to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            className="glass p-6 hover:border-violet-700/50 transition-all duration-300 group block"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-slate-100 group-hover:text-violet-300 transition-colors">
                {wf.name}
              </h3>
              {latestRun && (
                <StatusBadge status={latestRun.status} />
              )}
            </div>

            {wf.description && (
              <p className="text-slate-400 text-sm mb-3 line-clamp-2">{wf.description}</p>
            )}

            <div className="flex flex-wrap gap-1.5 mb-4">
              {wf.workflow_steps.slice(0, 4).map((step, i) => (
                <span key={i} className={`badge border ${stepTypeClass(step.type)}`}>
                  {stepTypeIcon(step.type)} {step.type.replace(/_/g, ' ')}
                </span>
              ))}
              {wf.workflow_steps.length > 4 && (
                <span className="badge badge-pending">+{wf.workflow_steps.length - 4}</span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {wf.workflow_triggers.map((t) => t.type).join(', ') || 'No trigger'}
              </span>
              <span>{wf.workflow_steps.length} step{wf.workflow_steps.length !== 1 ? 's' : ''}</span>
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
    paused: 'bg-amber-400 animate-pulse',
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin-slow" />
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    </div>
  );
}
