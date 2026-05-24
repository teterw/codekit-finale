'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';

const GOOGLE_CLIENT_ID = '251626087919-sesiqoojhrsvts360hk42eh8gtr25sf6.apps.googleusercontent.com';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const base64    = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded   = decodeURIComponent(
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

export default function AuthForm({ onAuth }: Props) {
  const [mode, setMode]         = useState<'login' | 'register'>('login');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const buttonRef = useRef<HTMLDivElement | null>(null);

  const handleGoogleResponse = useCallback(async (response: { credential?: string }) => {
    if (!response?.credential) { setError('Google did not return a credential.'); return; }
    const profile = decodeJwt(response.credential) as { email?: string; name?: string; picture?: string } | null;
    if (!profile?.email || !profile?.name) { setError('Unable to decode Google credential.'); return; }
    try {
      setGoogleLoading(true);
      const res  = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: profile.email, name: profile.name, avatar: profile.picture }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? `Google sign-in failed (${res.status})`); return; }
      localStorage.setItem('userId', String(data.user.id));
      localStorage.setItem('userName', data.user.name);
      onAuth(data.user.id, data.user.name);
    } catch {
      setError('Google sign-in network error. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }, [onAuth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.onGoogleCredential = handleGoogleResponse;

    const init = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;
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
        width: '100%',
      });
    };

    if (window.google?.accounts?.id) { init(); return; }

    const script    = document.createElement('script');
    script.src      = 'https://accounts.google.com/gsi/client';
    script.async    = true;
    script.defer    = true;
    script.onload   = init;
    script.onerror  = () => setError('Unable to load Google Sign-In. Disable ad blockers and try again.');
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
      window.onGoogleCredential = undefined;
    };
  }, [handleGoogleResponse]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body     = mode === 'login' ? { email, password } : { name, email, password };
      const res      = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error ?? 'Something went wrong'); return; }
      localStorage.setItem('userId', String(data.user.id));
      localStorage.setItem('userName', data.user.name);
      onAuth(data.user.id, data.user.name);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === 'login';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: '#313338',
        backgroundImage: 'radial-gradient(ellipse at 60% 0%, rgba(88,101,242,0.15) 0%, transparent 60%), radial-gradient(ellipse at 10% 80%, rgba(235,69,158,0.08) 0%, transparent 50%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md"
        style={{
          background: '#313338',
          borderRadius: '5px',
          boxShadow: '0 2px 10px 0 rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.1)',
          padding: '32px 40px 40px',
        }}
      >
        {/* ── Heading ───────────────────────── */}
        <div className="text-center mb-5">
          <h1 className="font-black text-2xl mb-2" style={{ color: '#F2F3F5' }}>
            {isLogin ? 'Welcome back!' : 'Create an account'}
          </h1>
          <p className="text-[16px]" style={{ color: '#B5BAC1' }}>
            {isLogin
              ? "We're so excited to see you again!"
              : "We're so excited to have you!"}
          </p>
        </div>

        {/* ── Google sign-in ────────────────── */}
        <div className="mb-4">
          <div ref={buttonRef} className="w-full" />
          {googleLoading && (
            <p className="text-center text-sm mt-2" style={{ color: '#B5BAC1' }}>
              Signing in with Google…
            </p>
          )}
        </div>

        {/* ── Divider ───────────────────────── */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px" style={{ background: 'rgba(79,84,92,0.48)' }} />
          <span className="text-xs uppercase font-semibold" style={{ color: '#949BA4' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(79,84,92,0.48)' }} />
        </div>

        {/* ── Form ──────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Username (register only) */}
          <AnimatePresence initial={false}>
            {!isLogin && (
              <motion.div
                key="name"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <DiscordField
                  label="Username"
                  required
                >
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Your name"
                    className="discord-input"
                  />
                </DiscordField>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <DiscordField label={isLogin ? 'Email or Phone Number' : 'Email'} required>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              className="discord-input"
            />
          </DiscordField>

          {/* Password */}
          <DiscordField
            label="Password"
            required
            aside={isLogin ? (
              <button type="button" className="text-xs hover:underline" style={{ color: '#00A8FC' }}>
                Forgot your password?
              </button>
            ) : undefined}
          >
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
          </DiscordField>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[14px]"
                style={{ color: '#F23F43' }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded font-semibold text-[16px] text-white transition-opacity disabled:opacity-60 hover:brightness-110 mt-2"
            style={{ background: '#5865F2', borderRadius: '3px', height: '44px' }}
          >
            {loading ? 'Please wait…' : isLogin ? 'Log In' : 'Continue'}
          </button>
        </form>

        {/* ── Mode switch ───────────────────── */}
        <p className="mt-4 text-[14px]" style={{ color: '#949BA4' }}>
          {isLogin ? (
            <>
              Need an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                className="hover:underline"
                style={{ color: '#00A8FC' }}
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className="hover:underline"
                style={{ color: '#00A8FC' }}
              >
                Log In
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}

/* ── Label + field wrapper ─────────────────────── */
function DiscordField({
  label, required, aside, children,
}: {
  label: string;
  required?: boolean;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label
          className="text-[12px] font-bold uppercase tracking-[0.04em]"
          style={{ color: '#B5BAC1' }}
        >
          {label}
          {required && <span style={{ color: '#F23F43' }}> *</span>}
        </label>
        {aside}
      </div>
      {children}
    </div>
  );
}
