import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

export function Logo({ size = 'md', to }: { size?: 'sm' | 'md' | 'lg'; to?: string }) {
  const sizes = {
    sm: { box: 'h-8 w-8', text: 'text-base' },
    md: { box: 'h-10 w-10', text: 'text-lg' },
    lg: { box: 'h-14 w-14', text: 'text-2xl' },
  };
  const s = sizes[size];

  const inner = (
    <div className="flex items-center gap-2.5">
      <motion.div
        initial={{ rotate: -10, scale: 0.9 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className={cn(
          'relative flex items-center justify-center rounded-2xl bg-gradient-warm shadow-glow-orange',
          s.box
        )}
      >
        <svg viewBox="0 0 24 24" className="h-2/3 w-2/3 text-white" fill="none">
          <path
            d="M12 21s-7-4.5-7-10a4 4 0 017-2.65A4 4 0 0119 11c0 5.5-7 10-7 10z"
            fill="currentColor"
            fillOpacity="0.95"
          />
        </svg>
      </motion.div>
      <span className={cn('font-display font-extrabold tracking-tight', s.text)}>
        Bond<span className="gradient-text">&amp;Beyond</span>
      </span>
    </div>
  );

  if (to) return <Link to={to}>{inner}</Link>;
  return inner;
}
