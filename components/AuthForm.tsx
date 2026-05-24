'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const GOOGLE_CLIENT_ID = '251626087919-sesiqoojhrsvts360hk42eh8gtr25sf6.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: any;
    onGoogleCredential?: (response: { credential: string }) => void;
  }
}

interface Props {
  onAuth: (userId: number, userName: string) => void;
}

function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export default function AuthForm({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const debug = true;

  const handleGoogleResponse = useCallback(async (response: { credential?: string }) => {
    if (debug) console.debug('[AuthForm] Google response callback', response);
    if (!response?.credential) {
      console.error('[AuthForm] Google response missing credential', response);
      setError('Google did not return a credential.');
      return;
    }

    const profile = decodeJwt(response.credential) as { email?: string; name?: string; picture?: string } | null;
    if (!profile?.email || !profile?.name) {
      setError('Unable to decode Google credential.');
      return;
    }

    try {
      setGoogleLoading(true);
      if (debug) console.debug('[AuthForm] Sending /api/auth/google request', {
        email: profile.email,
        name: profile.name,
        avatar: profile.picture,
      });

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email,
          name: profile.name,
          avatar: profile.picture,
        }),
      });
      const data = await res.json().catch((parseError) => {
        console.error('[AuthForm] Failed to parse /api/auth/google response', parseError);
        return null;
      });

      if (!res.ok) {
        console.error('[AuthForm] /api/auth/google returned error', res.status, data);
        setError(data?.error ?? `Google sign-in failed (${res.status})`);
        return;
      }

      if (debug) console.debug('[AuthForm] /api/auth/google successful', data);
      localStorage.setItem('userId', String(data.user.id));
      localStorage.setItem('userName', data.user.name);
      onAuth(data.user.id, data.user.name);
    } catch (error) {
      console.error('[AuthForm] Google sign-in network error', error);
      setError('Google sign-in network error. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }, [onAuth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.onGoogleCredential = handleGoogleResponse;

    const initializeGoogle = () => {
      if (!window.google?.accounts?.id) {
        console.error('[AuthForm] Google Identity Services loaded but google.accounts.id is missing');
        setError('Google sign-in is unavailable. Please try again or disable ad blockers.');
        return;
      }

      if (!buttonRef.current) {
        console.error('[AuthForm] Google button ref is not mounted');
        return;
      }

      console.debug('[AuthForm] Initializing Google Identity Services');
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: window.onGoogleCredential,
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'filled_blue',
        size: 'large',
        type: 'standard',
      });
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
      return;
    }

    console.debug('[AuthForm] Loading Google Sign-In script');
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.debug('[AuthForm] Google Sign-In script loaded');
      initializeGoogle();
    };
    script.onerror = () => {
      console.error('[AuthForm] Failed to load Google Sign-In script');
      setError('Unable to load Google Sign-In script. Disable ad blockers and try again.');
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      window.onGoogleCredential = undefined;
    };
  }, [handleGoogleResponse]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = mode === 'login'
        ? { email, password }
        : { name, email, password };
      const route = mode === 'login' ? '/api/auth/login' : '/api/auth/register';

      console.debug('[AuthForm] Submitting auth form', { mode, route, payload });
      const res = await fetch(route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch((parseError) => {
        console.error(`[AuthForm] Failed to parse ${route} response`, parseError);
        return null;
      });

      if (!res.ok) {
        console.error(`[AuthForm] ${route} returned error`, res.status, data);
        setError(data?.error ?? `Request failed (${res.status})`);
        return;
      }

      if (debug) console.debug('[AuthForm] Auth success', data);
      localStorage.setItem('userId', String(data.user.id));
      localStorage.setItem('userName', data.user.name);
      onAuth(data.user.id, data.user.name);
    } catch (error) {
      console.error('[AuthForm] Auth network error', error);
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

        <div className="space-y-3 mb-6">
          <div ref={buttonRef} />
          {googleLoading && <p className="text-[#b9bbbe] text-center text-sm">Signing in with Google…</p>}
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-3 text-center text-sm text-zinc-400">
            Use Google to sign in quickly, or use the form below.
          </div>
        </div>

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
