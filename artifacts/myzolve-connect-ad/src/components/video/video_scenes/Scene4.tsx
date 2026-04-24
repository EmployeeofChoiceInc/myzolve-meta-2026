import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4(_props: { cut?: 'master' | '15s' | '6s' } = {}) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2400),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-primary)] z-10"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          className="absolute top-[10%] left-[10%] w-[120%] h-[120%] bg-white rounded-full opacity-10 blur-2xl"
          animate={{ scale: [1, 1.1, 1], x: [0, -30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 text-center px-8 w-full">
        <motion.h2 
          className="text-[12vw] font-bold text-white leading-[1.1] tracking-tight mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          A place to <br/>
          <span className="text-[var(--color-accent)]">share</span>, <br/>
          <span className="text-[var(--color-accent)]">support</span>, and <br/>
          <span className="text-[var(--color-accent)]">return</span>.
        </motion.h2>

        <div className="flex flex-col gap-4 items-center">
          <motion.div
            className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-6 py-4 rounded-2xl font-semibold text-[4.5vw] w-[80%] max-w-sm"
            initial={{ opacity: 0, x: -40 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            No public networks.
          </motion.div>

          <motion.div
            className="bg-white text-[var(--color-primary)] px-6 py-4 rounded-2xl font-bold text-[4.5vw] w-[80%] max-w-sm shadow-xl"
            initial={{ opacity: 0, x: 40 }}
            animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            Just the people you trust.
          </motion.div>
        </div>
      </div>

    </motion.div>
  );
}
