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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 mb-4 glow-violet">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold gradient-text">FlowMind</h1>
          <p className="text-slate-400 mt-1 text-sm">AI Agent Workflow Builder</p>
        </div>

        <div className="glass p-8">
          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl mb-6">
            <button
              id="tab-signin"
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                mode === 'signin'
                  ? 'bg-violet-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Sign In
            </button>
            <button
              id="tab-signup"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                mode === 'signup'
                  ? 'bg-violet-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-300'
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
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
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
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-900/50 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              id="btn-auth-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center"
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
        </div>
      </div>
    </div>
  );
}
