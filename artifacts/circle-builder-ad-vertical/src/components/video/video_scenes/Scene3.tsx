import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 3500), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col justify-center px-8 z-10"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div 
        className="w-20 h-1 bg-[var(--color-primary)] mb-10"
        initial={{ width: 0 }}
        animate={phase >= 1 ? { width: 80 } : { width: 0 }}
        transition={{ duration: 0.6 }}
      />

      <motion.h2 
        className="text-[11vw] font-bold leading-[1.1] mb-6"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
      >
        Our Mission:
      </motion.h2>

      <motion.p
        className="text-[7vw] font-medium mb-12"
        style={{ color: 'var(--color-text-secondary)' }}
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8 }}
      >
        Build <span style={{ color: 'var(--color-primary)' }} className="font-bold">100 real-world</span> support circles.
      </motion.p>

      <motion.div
        className="space-y-4 border-l-2 pl-6"
        style={{ borderColor: 'var(--color-accent)' }}
        initial={{ opacity: 0, height: 0 }}
        animate={phase >= 3 ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
        transition={{ duration: 0.8 }}
      >
        <p className="text-[5vw] text-[var(--color-secondary)] font-bold">Church leaders.</p>
        <p className="text-[5vw] text-[var(--color-secondary)] font-bold">PTA parents.</p>
        <p className="text-[5vw] text-[var(--color-secondary)] font-bold">Neighborhood organizers.</p>
        <p className="text-[5vw] text-[var(--color-primary)] font-black">Anyone bringing people together.</p>
      </motion.div>

    </motion.div>
  );
}
