'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthenticationStatus } from '@nhost/react';
import { useQuery } from '@apollo/client';
import { GET_USER_ORGS } from '@/graphql/queries';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  const router = useRouter();

  const { data } = useQuery(GET_USER_ORGS, { skip: !isAuthenticated });

  useEffect(() => {
    // If authenticated and has orgs, go to first org dashboard
    if (isAuthenticated && data?.org_members?.length > 0) {
      router.replace(`/orgs/${data.org_members[0].organization.id}`);
      return;
    }

    // Default: redirect straight to /login
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, data, router]);

  // Immediate fallback redirect after 500ms if Nhost auth state is idle
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin-slow" />
        <p className="text-slate-400 text-sm font-medium">Launching FlowMind…</p>
      </div>
    </div>
  );
}
