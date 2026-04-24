import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-light)] z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,var(--color-accent),transparent_70%)] opacity-50" />

      <div className="relative z-10 flex flex-col items-center text-center px-8 w-full gap-8">
        
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {/* Mock Logo / Wordmark */}
          <div className="flex items-center gap-3 mb-2">
            <svg width="48" height="48" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="180" height="180" rx="36" fill="var(--color-primary)"/>
              {/* Heart shape inside logo */}
              <path d="M90 120.5L86.5 117.3C68 100.5 56 90.7 56 76C56 63.9 65.5 54.5 78 54.5C85.1 54.5 91.8 57.8 96 63.3C100.2 57.8 106.9 54.5 114 54.5C126.5 54.5 136 63.9 136 76C136 90.7 124 100.5 105.5 117.4L90 120.5Z" fill="white"/>
            </svg>
            <h1 className="text-[9vw] font-bold text-[var(--color-foreground)] tracking-tight">
              MyZolve <span className="font-normal text-[var(--color-primary)]">Connect</span>
            </h1>
          </div>
          
          <motion.div 
            className="text-[3.5vw] font-medium text-[var(--color-text-secondary)] mt-1"
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            a sub-brand by MyZolve
          </motion.div>
        </motion.div>

        <motion.div
          className="text-[6vw] font-bold text-[var(--color-foreground)] leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          For families and <br/>
          <span className="text-[var(--color-primary)]">trusted circles</span>
        </motion.div>

      </div>

    </motion.div>
  );
}
