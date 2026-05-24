'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Registration failed');
      return;
    }
    router.push('/login');
  }

  return (
    <div
      className="w-full max-w-md"
      style={{
        background: '#313338',
        borderRadius: '5px',
        boxShadow: '0 2px 10px 0 rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.12)',
        padding: '32px 40px 40px',
      }}
    >
      {/* Heading */}
      <div className="text-center mb-5">
        <h1 className="font-black text-2xl mb-2" style={{ color: '#F2F3F5' }}>
          Create an account
        </h1>
        <p className="text-[16px]" style={{ color: '#B5BAC1' }}>
          We&apos;re so excited to have you!
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-4 px-3 py-2.5 rounded text-sm"
          style={{ background: 'rgba(242,63,67,0.1)', color: '#F23F43', border: '1px solid rgba(242,63,67,0.3)' }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Username */}
        <div>
          <label className="block text-[12px] font-bold uppercase tracking-[0.04em] mb-2" style={{ color: '#B5BAC1' }}>
            Username <span style={{ color: '#F23F43' }}>*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="Your display name"
            className="discord-input"
          />
          <p className="mt-1.5 text-[12px]" style={{ color: '#949BA4' }}>
            Please only use a name you&apos;re comfortable with.
          </p>
        </div>

        {/* Email */}
        <div>
          <label className="block text-[12px] font-bold uppercase tracking-[0.04em] mb-2" style={{ color: '#B5BAC1' }}>
            Email <span style={{ color: '#F23F43' }}>*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="Enter your email"
            className="discord-input"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-[12px] font-bold uppercase tracking-[0.04em] mb-2" style={{ color: '#B5BAC1' }}>
            Password <span style={{ color: '#F23F43' }}>*</span>
          </label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Create a password"
              className="discord-input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: '#949BA4' }}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Terms */}
        <p className="text-[12px]" style={{ color: '#949BA4' }}>
          By registering, you agree to our{' '}
          <span className="hover:underline cursor-pointer" style={{ color: '#00A8FC' }}>Terms of Service</span>{' '}
          and{' '}
          <span className="hover:underline cursor-pointer" style={{ color: '#00A8FC' }}>Privacy Policy</span>.
        </p>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full font-semibold text-[16px] text-white disabled:opacity-60 transition-all hover:brightness-110 active:scale-[0.99]"
          style={{ background: '#5865F2', borderRadius: '3px', height: '44px' }}
        >
          {loading ? 'Creating account…' : 'Continue'}
        </button>
      </form>

      {/* Switch to login */}
      <p className="mt-4 text-[14px]" style={{ color: '#949BA4' }}>
        Already have an account?{' '}
        <Link href="/login" className="hover:underline" style={{ color: '#00A8FC' }}>
          Log In
        </Link>
      </p>
    </div>
  );
}
