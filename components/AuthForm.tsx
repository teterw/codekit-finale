'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Zap, Eye, EyeOff } from 'lucide-react';
import { pop } from '@/lib/animations';

interface Props {
  onAuth: (userId: number, userName: string) => void;
}

export default function AuthForm({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { name, email, password };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return; }
      localStorage.setItem('userId', String(data.user.id));
      localStorage.setItem('userName', data.user.name);
      onAuth(data.user.id, data.user.name);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(124,107,255,0.18) 0%, var(--bg) 60%)' }}
    >
      <motion.div variants={pop} initial="hidden" animate="show" className="w-full max-w-sm">
        <div className="gradient-border shadow-2xl shadow-black/60">
          <div className="rounded-xl p-8" style={{ background: 'var(--bg-card)' }}>
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)' }}
              >
                <Zap size={22} fill="currentColor" style={{ color: 'var(--accent)' }} />
              </div>
            </div>

            <h1 className="text-center font-bold text-lg mb-1" style={{ color: 'var(--text-1)' }}>
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-center text-sm mb-6" style={{ color: 'var(--text-2)' }}>
              {mode === 'login' ? "Sign in to continue" : "Start your journey today"}
            </p>

            {/* Tab switcher */}
            <div
              className="flex rounded-lg p-1 mb-6"
              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border)' }}
            >
              {(['login', 'register'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(''); }}
                  className="relative flex-1 py-1.5 text-sm font-medium rounded-md transition-colors z-10"
                  style={{ color: mode === m ? 'var(--text-1)' : 'var(--text-3)' }}
                >
                  {mode === m && (
                    <motion.div
                      layoutId="auth-tab-bg"
                      className="absolute inset-0 rounded-md"
                      style={{ background: 'var(--bg-elevated)', zIndex: -1 }}
                      transition={{ duration: 0.18 }}
                    />
                  )}
                  {m === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <AnimatePresence initial={false}>
                {mode === 'register' && (
                  <motion.div
                    key="name-field"
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <InputField icon={<User size={15} />} placeholder="Display name" type="text" value={name} onChange={e => setName(e.target.value)} required />
                  </motion.div>
                )}
              </AnimatePresence>

              <InputField icon={<Mail size={15} />} placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} required />

              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-3)' }}>
                  <Lock size={15} />
                </div>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Password"
                  className="w-full rounded-lg py-2.5 pl-9 pr-9 text-sm outline-none transition-shadow"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-1)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-dim)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-3)' }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-sm px-1 pt-0.5"
                    style={{ color: 'var(--danger)' }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white mt-1 disabled:opacity-60 transition-opacity"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))' }}
              >
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </motion.button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function InputField({
  icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-3)' }}>
        {icon}
      </div>
      <input
        {...props}
        className="w-full rounded-lg py-2.5 pl-9 pr-3 text-sm outline-none transition-shadow"
        style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid var(--border)',
          color: 'var(--text-1)',
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-dim)';
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
    </div>
  );
}
