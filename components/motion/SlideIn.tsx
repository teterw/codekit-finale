'use client';
import { motion } from 'framer-motion';
import { slideInLeft, slideInRight } from '@/lib/animations';
import type { ReactNode } from 'react';

export default function SlideIn({
  children,
  className,
  from = 'left',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  from?: 'left' | 'right';
  delay?: number;
}) {
  return (
    <motion.div
      variants={from === 'left' ? slideInLeft : slideInRight}
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
