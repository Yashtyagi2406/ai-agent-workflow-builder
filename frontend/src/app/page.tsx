'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthenticationStatus, useUserData } from '@nhost/react';
import { useQuery } from '@apollo/client';
import { GET_USER_ORGS } from '@/graphql/queries';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  const user = useUserData();
  const router = useRouter();

  const { data } = useQuery(GET_USER_ORGS, { skip: !isAuthenticated });

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (data?.org_members?.length > 0) {
      router.replace(`/orgs/${data.org_members[0].organization.id}`);
    }
  }, [isAuthenticated, isLoading, data, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin-slow" />
        <p className="text-slate-400 text-sm">Loading FlowMind…</p>
      </div>
    </div>
  );
}
