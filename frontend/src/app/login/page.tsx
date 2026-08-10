'use client';

import { useState } from 'react';
import { useSignInEmailPassword, useSignUpEmailPassword } from '@nhost/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const { signInEmailPassword, isLoading: signingIn } = useSignInEmailPassword();
  const { signUpEmailPassword, isLoading: signingUp } = useSignUpEmailPassword();

  const loading = signingIn || signingUp;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      if (mode === 'signin') {
        const res = await signInEmailPassword(email, password);
        if (res.isError) throw new Error(res.error?.message || 'Sign in failed');
      } else {
        const res = await signUpEmailPassword(email, password, {
          displayName: displayName || undefined,
        });
        if (res.isError) throw new Error(res.error?.message || 'Sign up failed');
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  }

  return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center p-4 selection:bg-violet-500/30">
      {/* Background ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md animate-fade-in-up relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 mb-4 glow-violet shadow-xl">
            <svg className="w-7 h-7 text-white" width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight gradient-text">FlowMind</h1>
          <p className="text-slate-400 mt-1.5 text-sm font-medium">AI Agent Workflow Builder</p>
        </div>

        {/* Auth Card */}
        <div className="glass p-8 shadow-2xl">
          {/* Mode Switcher Tabs */}
          <div className="flex gap-1 p-1 bg-slate-950/80 rounded-xl mb-6 border border-slate-800/80">
            <button
              id="tab-signin"
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                mode === 'signin'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              id="tab-signup"
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                mode === 'signup'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label" htmlFor="displayName">Display Name</label>
                <input
                  id="displayName"
                  type="text"
                  className="input"
                  placeholder="John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="label" htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="owner-orga@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                minLength={8}
              />
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-900/60 text-red-400 text-xs font-medium">
                {error}
              </div>
            )}

            <button
              id="btn-auth-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                  Processing…
                </>
              ) : mode === 'signin' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Footer */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-500 font-medium">Demo Seed Accounts (Password: <code className="text-violet-400">Password123!</code>)</p>
            <div className="flex justify-center gap-2 mt-2 flex-wrap text-[11px]">
              <button
                type="button"
                onClick={() => { setEmail('owner-orga@example.com'); setPassword('Password123!'); }}
                className="px-2 py-1 rounded bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 border border-slate-700/50 cursor-pointer"
              >
                Org A Owner
              </button>
              <button
                type="button"
                onClick={() => { setEmail('editor-orga@example.com'); setPassword('Password123!'); }}
                className="px-2 py-1 rounded bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 border border-slate-700/50 cursor-pointer"
              >
                Org A Editor
              </button>
              <button
                type="button"
                onClick={() => { setEmail('owner-orgb@example.com'); setPassword('Password123!'); }}
                className="px-2 py-1 rounded bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 border border-slate-700/50 cursor-pointer"
              >
                Org B Owner
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
