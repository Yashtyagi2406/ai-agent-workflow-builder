'use client';

import { NhostProvider } from '@nhost/nextjs';
import { ApolloProvider } from '@apollo/client';
import { useAccessToken } from '@nhost/react';
import { nhost } from '@/lib/nhost';
import { createApolloClient } from '@/lib/apollo';
import { useMemo } from 'react';
import '@/styles/globals.css';

function ApolloWrapper({ children }: { children: React.ReactNode }) {
  const accessToken = useAccessToken();
  const client = useMemo(() => createApolloClient(accessToken), [accessToken]);
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="AI Agent Workflow Builder — chain LLM calls, HTTP requests, and more into powerful automated workflows"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <title>FlowMind — AI Agent Workflow Builder</title>
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <NhostProvider nhost={nhost}>
          <ApolloWrapper>{children}</ApolloWrapper>
        </NhostProvider>
      </body>
    </html>
  );
}
