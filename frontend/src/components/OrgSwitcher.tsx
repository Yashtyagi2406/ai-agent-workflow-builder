'use client';

import { useRouter } from 'next/navigation';

interface Org {
  organization: { id: string; name: string };
  role: string;
}

interface OrgSwitcherProps {
  orgs: Org[];
  currentOrgId: string;
}

export function OrgSwitcher({ orgs, currentOrgId }: OrgSwitcherProps) {
  const router = useRouter();
  const currentOrg = orgs.find((m) => m.organization.id === currentOrgId);

  if (orgs.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/40">
        <span className="w-2 h-2 rounded-full bg-violet-400" />
        <span className="text-sm text-slate-300 font-medium">{currentOrg?.organization.name ?? 'My Org'}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        id="org-switcher"
        value={currentOrgId}
        onChange={(e) => router.push(`/orgs/${e.target.value}`)}
        className="appearance-none pl-8 pr-8 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40
                   text-sm text-slate-300 font-medium
                   focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer"
      >
        {orgs.map((m) => (
          <option key={m.organization.id} value={m.organization.id}>
            {m.organization.name} ({m.role})
          </option>
        ))}
      </select>
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-violet-400 pointer-events-none" />
      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
