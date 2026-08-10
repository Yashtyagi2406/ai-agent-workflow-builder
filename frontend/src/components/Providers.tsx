'use client';

import { useMemo } from 'react';
import { NhostProvider } from '@nhost/nextjs';
import { ApolloProvider } from '@apollo/client';
import { useAccessToken } from '@nhost/react';
import { nhost } from '@/lib/nhost';
import { createApolloClient } from '@/lib/apollo';

function ApolloWrapper({ children }: { children: React.ReactNode }) {
  const accessToken = useAccessToken();
  const client = useMemo(() => createApolloClient(accessToken), [accessToken]);
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NhostProvider nhost={nhost}>
      <ApolloWrapper>{children}</ApolloWrapper>
    </NhostProvider>
  );
}
