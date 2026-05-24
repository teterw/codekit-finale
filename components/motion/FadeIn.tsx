'use client';
import { motion } from 'framer-motion';
import { fadeUp } from '@/lib/animations';
import type { ReactNode } from 'react';

export default function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      exit="exit"
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
