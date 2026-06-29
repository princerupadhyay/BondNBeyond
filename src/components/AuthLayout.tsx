import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Logo } from '../components/Logo';
import { AnimatedBackground } from '../components/AnimatedBackground';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      <AnimatedBackground />
      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="card glass p-8 sm:p-10"
        >
          <div className="mb-8 flex justify-center">
            <Logo size="lg" />
          </div>
          {children}
        </motion.div>
        <p className="mt-6 text-center text-xs text-muted">
          Beyond Love. Beyond Distance. Beyond Excuses.
        </p>
      </div>
    </div>
  );
}
