'use client';

import { useState } from 'react';

interface Props {
  onAuth: (userId: number, userName: string) => void;
}

export default function AuthForm({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Login failed'); return; }
        localStorage.setItem('userId', String(data.user.id));
        localStorage.setItem('userName', data.user.name);
        onAuth(data.user.id, data.user.name);
      } else {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Registration failed'); return; }
        localStorage.setItem('userId', String(data.user.id));
        localStorage.setItem('userName', data.user.name);
        onAuth(data.user.id, data.user.name);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#36393f]">
      <div className="bg-[#2f3136] rounded-lg p-8 w-full max-w-sm shadow-xl">
        <h1 className="text-white text-2xl font-bold text-center mb-1">
          {mode === 'login' ? 'Welcome back!' : 'Create an account'}
        </h1>
        <p className="text-[#b9bbbe] text-sm text-center mb-6">
          {mode === 'login' ? "We're so excited to see you again!" : 'Start your Discord journey.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-[#b9bbbe] text-xs font-semibold uppercase mb-1">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full bg-[#202225] text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#7289da]"
                placeholder="Awesome Person"
              />
            </div>
          )}
          <div>
            <label className="block text-[#b9bbbe] text-xs font-semibold uppercase mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[#202225] text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#7289da]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-[#b9bbbe] text-xs font-semibold uppercase mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-[#202225] text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#7289da]"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-[#ed4245] text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#7289da] hover:bg-[#677bc4] text-white font-medium py-2 rounded transition-colors disabled:opacity-60"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Register'}
          </button>
        </form>

        <p className="text-[#b9bbbe] text-sm mt-4">
          {mode === 'login' ? "Need an account? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="text-[#7289da] hover:underline"
          >
            {mode === 'login' ? 'Register' : 'Log In'}
          </button>
        </p>
      </div>
    </div>
  );
}
