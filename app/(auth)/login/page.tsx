'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/channels');
    }
  }

  return (
    <div
      className="w-full max-w-sm rounded-lg p-8 shadow-xl"
      style={{ background: '#2B2D31' }}
    >
      <h1
        className="text-2xl font-bold text-center mb-1"
        style={{ color: 'var(--dc-text)' }}
      >
        Welcome back!
      </h1>
      <p className="text-center text-sm mb-6" style={{ color: 'var(--dc-text-muted)' }}>
        We&apos;re so excited to see you again!
      </p>

      {error && (
        <div
          className="mb-4 p-3 rounded text-sm"
          style={{ background: '#3d0a0d', color: '#f38ba8', border: '1px solid #da373c44' }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--dc-text-muted)' }}
          >
            Email <span style={{ color: 'var(--dc-danger)' }}>*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="rounded px-3 py-2 text-sm outline-none focus:ring-2"
            style={{
              background: 'var(--dc-input-bg)',
              color: 'var(--dc-text)',
              border: '1px solid var(--dc-border)',
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--dc-text-muted)' }}
          >
            Password <span style={{ color: 'var(--dc-danger)' }}>*</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="rounded px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--dc-input-bg)',
              color: 'var(--dc-text)',
              border: '1px solid var(--dc-border)',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded py-2 text-sm font-medium text-white transition-colors disabled:opacity-60 mt-2"
          style={{ background: loading ? 'var(--dc-accent-hover)' : 'var(--dc-accent)' }}
        >
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      <p className="mt-4 text-sm" style={{ color: 'var(--dc-text-muted)' }}>
        Need an account?{' '}
        <Link
          href="/register"
          className="hover:underline"
          style={{ color: 'var(--dc-text-link)' }}
        >
          Register
        </Link>
      </p>
    </div>
  );
}
