'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

const GOOGLE_CLIENT_ID = '251626087919-sesiqoojhrsvts360hk42eh8gtr25sf6.apps.googleusercontent.com';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
    onGoogleCredentialLogin?: (response: { credential: string }) => void;
  }
}

function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const buttonRef = useRef<HTMLDivElement | null>(null);

  const handleGoogleResponse = useCallback(async (response: { credential?: string }) => {
    if (!response?.credential) { setError('Google did not return a credential.'); return; }
    const profile = decodeJwt(response.credential) as { email?: string; name?: string; picture?: string } | null;
    if (!profile?.email || !profile?.name) { setError('Unable to decode Google credential.'); return; }
    try {
      setGoogleLoading(true);
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: profile.email, name: profile.name, avatar: profile.picture }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? `Google sign-in failed (${res.status})`); return; }
      localStorage.setItem('userId', String(data.user.id));
      localStorage.setItem('userName', data.user.name);
      router.push('/direct-messages');
    } catch {
      setError('Google sign-in network error. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.onGoogleCredentialLogin = handleGoogleResponse;

    const init = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: window.onGoogleCredentialLogin,
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'filled_blue',
        size: 'large',
        type: 'standard',
        width: '100%',
      });
    };

    if (window.google?.accounts?.id) { init(); return; }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = init;
    script.onerror = () => setError('Unable to load Google Sign-In. Disable ad blockers and try again.');
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
      window.onGoogleCredentialLogin = undefined;
    };
  }, [handleGoogleResponse]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Custom login to get userId for localStorage
    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginData = await loginRes.json().catch(() => null);

    if (!loginRes.ok) {
      setError(loginData?.error ?? 'Invalid email or password.');
      setLoading(false);
      return;
    }

    localStorage.setItem('userId', String(loginData.user.id));
    localStorage.setItem('userName', loginData.user.name);

    // Also create NextAuth session for server-side auth
    await signIn('credentials', { email, password, redirect: false });

    setLoading(false);
    router.push('/direct-messages');
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
      <div className="text-center mb-5">
        <h1 className="font-black text-2xl mb-2" style={{ color: '#F2F3F5' }}>
          Welcome back!
        </h1>
        <p className="text-[16px]" style={{ color: '#B5BAC1' }}>
          We&apos;re so excited to see you again!
        </p>
      </div>

      {error && (
        <div
          className="mb-4 px-3 py-2.5 rounded text-sm"
          style={{ background: 'rgba(242,63,67,0.1)', color: '#F23F43', border: '1px solid rgba(242,63,67,0.3)' }}
        >
          {error}
        </div>
      )}

      {/* Google sign-in */}
      <div className="mb-4">
        <div ref={buttonRef} className="w-full" />
        {googleLoading && (
          <p className="text-center text-sm mt-2" style={{ color: '#B5BAC1' }}>
            Signing in with Google…
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px" style={{ background: 'rgba(79,84,92,0.48)' }} />
        <span className="text-xs uppercase font-semibold" style={{ color: '#949BA4' }}>or</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(79,84,92,0.48)' }} />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="block text-[12px] font-bold uppercase tracking-[0.04em] mb-2" style={{ color: '#B5BAC1' }}>
            Email or Phone Number <span style={{ color: '#F23F43' }}>*</span>
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

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[12px] font-bold uppercase tracking-[0.04em]" style={{ color: '#B5BAC1' }}>
              Password <span style={{ color: '#F23F43' }}>*</span>
            </label>
            <button type="button" className="text-xs hover:underline" style={{ color: '#00A8FC' }}>
              Forgot your password?
            </button>
          </div>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
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

        <button
          type="submit"
          disabled={loading}
          className="w-full font-semibold text-[16px] text-white disabled:opacity-60 transition-all hover:brightness-110 active:scale-[0.99]"
          style={{ background: '#5865F2', borderRadius: '3px', height: '44px' }}
        >
          {loading ? 'Logging in…' : 'Log In'}
        </button>
      </form>

      <p className="mt-4 text-[14px]" style={{ color: '#949BA4' }}>
        Need an account?{' '}
        <Link href="/register" className="hover:underline" style={{ color: '#00A8FC' }}>
          Register
        </Link>
      </p>
    </div>
  );
}
