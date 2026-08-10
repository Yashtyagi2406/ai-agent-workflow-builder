import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata = {
  title: 'FlowMind — AI Agent Workflow Builder',
  description: 'AI Agent Workflow Builder — chain LLM calls, HTTP requests, and more into powerful automated workflows',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#080d1a] text-slate-100 antialiased selection:bg-violet-500/30">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
