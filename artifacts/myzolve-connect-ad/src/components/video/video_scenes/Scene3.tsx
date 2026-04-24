import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import iconImg from '../../../../../../artifacts/myzolve-connect-mobile/assets/images/icon.png';

export function Scene3({ cut = 'master' }: { cut?: 'master' | '15s' | '6s' }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const is6s = cut === '6s';
    const timers = is6s
      ? [
          setTimeout(() => setPhase(1), 200),   // Phone appears
          setTimeout(() => setPhase(2), 800),  // Request card pops
          setTimeout(() => setPhase(3), 1500),  // Contribution 1
          setTimeout(() => setPhase(4), 2200),  // Contribution 2
          setTimeout(() => setPhase(5), 2800),  // Success state
        ]
      : [
          setTimeout(() => setPhase(1), 500),   // Phone appears
          setTimeout(() => setPhase(2), 1500),  // Request card pops
          setTimeout(() => setPhase(3), 2800),  // Contribution 1
          setTimeout(() => setPhase(4), 3800),  // Contribution 2
          setTimeout(() => setPhase(5), 5000),  // Success state
        ];
    return () => timers.forEach(t => clearTimeout(t));
  }, [cut]);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-dark)] z-10 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_0%,var(--color-primary),transparent_70%)]" />

      {/* Phone Frame */}
      <motion.div 
        className="relative w-[75vw] h-[150vw] bg-[var(--color-bg-light)] rounded-[10vw] shadow-2xl overflow-hidden border-[1.5vw] border-gray-900 flex flex-col"
        initial={{ y: '100%', rotate: -5 }}
        animate={phase >= 1 ? { y: '5%', rotate: 0 } : { y: '100%', rotate: -5 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      >
        {/* App Header */}
        <div className="bg-white px-6 pt-12 pb-4 shadow-sm z-20 flex items-center gap-3">
          <img src={iconImg} className="w-8 h-8 rounded-lg" alt="icon" />
          <div className="font-bold text-lg text-[var(--color-foreground)] tracking-tight">Family Circle</div>
        </div>

        <div className="flex-1 bg-[var(--color-bg-muted)] p-4 relative z-10 flex flex-col gap-4">
          
          {/* Request Card */}
          <motion.div 
            className="bg-white rounded-2xl p-5 shadow-sm border border-black/5"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)] font-bold">M</div>
              <div className="bg-[var(--color-accent)] text-[var(--color-primary)] text-xs font-bold px-2 py-1 rounded-md">SUPPORT REQUEST</div>
            </div>
            <h3 className="font-bold text-[var(--color-foreground)] text-[4.5vw] leading-tight mb-2">Car Repair Support</h3>
            <p className="text-[var(--color-text-secondary)] text-[3.5vw] leading-snug mb-4">Need a little help covering the unexpected alternator repair. Plan to return support next month.</p>
            
            {/* Progress Bar */}
            <div className="w-full bg-[var(--color-bg-muted)] h-2 rounded-full overflow-hidden mb-2">
              <motion.div 
                className="h-full bg-[var(--color-primary)] rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: phase >= 5 ? '100%' : phase >= 4 ? '75%' : phase >= 3 ? '40%' : '0%' }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-xs font-bold text-[var(--color-text-secondary)]">
              <motion.span>
                {phase >= 5 ? '$400' : phase >= 4 ? '$300' : phase >= 3 ? '$160' : '$0'} raised
              </motion.span>
              <span>Goal: $400</span>
            </div>
          </motion.div>

          {/* Contributions Feed */}
          <div className="flex flex-col gap-2 mt-2">
            <motion.div 
              className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 border border-black/5"
              initial={{ opacity: 0, x: -20 }}
              animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">A</div>
              <div>
                <div className="font-bold text-[3.5vw] text-[var(--color-foreground)]">Aunt Sarah contributed</div>
                <div className="text-[3vw] text-[var(--color-text-secondary)]">"Happy to support you!"</div>
              </div>
            </motion.div>

            <motion.div 
              className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 border border-black/5"
              initial={{ opacity: 0, x: -20 }}
              animate={phase >= 4 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xs">J</div>
              <div>
                <div className="font-bold text-[3.5vw] text-[var(--color-foreground)]">Uncle Joe contributed</div>
                <div className="text-[3vw] text-[var(--color-text-secondary)]">"Got you covered."</div>
              </div>
            </motion.div>

            <motion.div 
              className="bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/30 rounded-xl p-3 flex items-center justify-center gap-2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={phase >= 5 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <svg className="w-5 h-5 text-[var(--color-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-bold text-[3.5vw] text-[var(--color-secondary)]">Goal completed</span>
            </motion.div>
          </div>

        </div>
      </motion.div>

    </motion.div>
  );
}
