'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useUserData } from '@nhost/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CREATE_WORKFLOW_WITH_STEPS } from '@/graphql/mutations';
import { GET_USER_ORGS } from '@/graphql/queries';

interface PageProps {
  params: { orgId: string };
}

export default function NewWorkflowPage({ params }: PageProps) {
  const { orgId } = params;
  const user = useUserData();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: orgsData } = useQuery(GET_USER_ORGS);
  const orgs = orgsData?.org_members ?? [];
  const membership = orgs.find((m: { organization: { id: string }; role: string }) => m.organization.id === orgId);
  const userRole = membership?.role;

  const [createWorkflow, { loading, error }] = useMutation(CREATE_WORKFLOW_WITH_STEPS, {
    onCompleted: (data) => {
      router.push(`/orgs/${orgId}/workflows/${data.insert_workflows_one.id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id || !name.trim()) return;
    createWorkflow({
      variables: {
        org_id: orgId,
        name: name.trim(),
        description: description.trim() || null,
        created_by: user.id,
        steps: [],
        triggers: [{ type: 'manual', config: {} }],
      },
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-900/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-fade-in-up">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/orgs/${orgId}`} className="text-slate-400 hover:text-slate-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">New Workflow</h1>
        </div>

        <div className="glass p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label" htmlFor="workflow-name">Workflow Name *</label>
              <input
                id="workflow-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My AI Agent Workflow"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="workflow-desc">Description (optional)</label>
              <textarea
                id="workflow-desc"
                className="input h-24 resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this workflow do?"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error.message}</p>
            )}

            <button
              id="btn-create-workflow"
              type="submit"
              disabled={loading || !name.trim()}
              className="btn-primary w-full justify-center"
            >
              {loading ? 'Creating…' : 'Create Workflow'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
