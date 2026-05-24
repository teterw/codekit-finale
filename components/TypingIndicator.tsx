'use client';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  typers: string[];
}

export default function TypingIndicator({ typers }: Props) {
  if (!typers.length) return null;

  const label =
    typers.length === 1
      ? `${typers[0]} is typing`
      : typers.length === 2
        ? `${typers[0]} and ${typers[1]} are typing`
        : `${typers.length} people are typing`;

  return (
    <AnimatePresence>
      <motion.div
        key="typing"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.15 }}
        className="flex items-center gap-2 px-4 py-1"
      >
        <div className="flex gap-0.5">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--text-3)' }}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
            />
          ))}
        </div>
        <span className="text-xs italic" style={{ color: 'var(--text-3)' }}>{label}…</span>
      </motion.div>
    </AnimatePresence>
  );
}
