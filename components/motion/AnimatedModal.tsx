'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { backdrop, pop } from '@/lib/animations';
import type { ReactNode } from 'react';

export default function AnimatedModal({
  show,
  onClose,
  children,
  className = '',
}: {
  show: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          variants={backdrop}
          initial="hidden"
          animate="show"
          exit="exit"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            variants={pop}
            initial="hidden"
            animate="show"
            exit="exit"
            className={className}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
