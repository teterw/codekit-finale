'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Hash, Mic, MessageSquare, ShieldCheck, Sparkles, Video } from 'lucide-react';

const features = [
  { icon: MessageSquare, title: 'Real-time chat', desc: 'Messages, reactions and threads that land instantly.' },
  { icon: Mic, title: 'Crystal voice', desc: 'Hop into voice channels with effects and a soundboard.' },
  { icon: Video, title: 'Video & screen', desc: 'Turn on your camera or go live to share your screen.' },
  { icon: ShieldCheck, title: 'Roles & control', desc: 'Promote admins and hand off ownership in a click.' },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: '#1E1F22', color: '#F2F3F5' }}
    >
      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{ background: 'rgba(88,101,242,0.35)' }}
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/3 -right-24 h-[26rem] w-[26rem] rounded-full blur-3xl"
          style={{ background: 'rgba(235,69,158,0.22)' }}
          animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full blur-3xl"
          style={{ background: 'rgba(35,165,90,0.18)' }}
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-extrabold text-lg">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: '#5865F2' }}>
            <Hash size={20} />
          </span>
          Nexus
        </div>
        <button
          onClick={() => router.push('/login')}
          className="rounded-full px-5 py-2 text-sm font-semibold transition-all hover:brightness-110 active:scale-95"
          style={{ background: '#fff', color: '#23272A' }}
        >
          Login
        </button>
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto max-w-6xl px-6">
        <section className="flex flex-col items-center pt-16 pb-20 text-center sm:pt-24">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold"
            style={{ background: 'rgba(88,101,242,0.15)', color: '#C9CDFB', border: '1px solid rgba(88,101,242,0.4)' }}
          >
            <Sparkles size={13} /> Your place to talk, play and hang out
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="max-w-3xl text-4xl font-black leading-[1.1] sm:text-6xl"
          >
            Where every{' '}
            <span style={{ background: 'linear-gradient(90deg,#5865F2,#EB459E)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              conversation
            </span>{' '}
            feels like home
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-6 max-w-xl text-base sm:text-lg"
            style={{ color: '#B5BAC1' }}
          >
            Create servers, jump into voice, share your screen and build your community —
            all in one fast, beautiful app.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <button
              onClick={() => router.push('/register')}
              className="rounded-full px-7 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-95"
              style={{ background: '#5865F2', boxShadow: '0 8px 30px rgba(88,101,242,0.45)' }}
            >
              Get started — it&apos;s free
            </button>
            <button
              onClick={() => router.push('/login')}
              className="rounded-full px-7 py-3.5 text-sm font-semibold transition-all hover:bg-white/[0.06] active:scale-95"
              style={{ color: '#F2F3F5', border: '1px solid rgba(255,255,255,0.18)' }}
            >
              I already have an account
            </button>
          </motion.div>
        </section>

        {/* Feature cards */}
        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="rounded-2xl p-5"
              style={{ background: 'rgba(43,45,49,0.7)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(6px)' }}
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'rgba(88,101,242,0.15)', color: '#5865F2' }}>
                <f.icon size={22} />
              </div>
              <h3 className="text-base font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: '#949BA4' }}>{f.desc}</p>
            </motion.div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t py-6 text-center text-xs" style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#80848E' }}>
        Built with Next.js · Nexus Chat
      </footer>
    </div>
  );
}
