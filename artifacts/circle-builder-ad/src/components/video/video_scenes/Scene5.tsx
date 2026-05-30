import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center text-[var(--color-text-primary)] overflow-hidden"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <motion.div 
        className="absolute inset-0 opacity-20 mix-blend-multiply bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/gathering_3.jpg)` }}
        animate={{ scale: [1.1, 1] }}
        transition={{ duration: 8, ease: "easeOut" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-bg-light)]/60 to-[var(--color-bg-light)]/90" />

      <div className="z-10 text-center flex flex-col items-center w-full max-w-4xl">
        <motion.div 
          className="w-[10vw] h-[10vw] border-[0.3vw] border-[var(--color-primary)] rounded-full mb-[3vw] flex items-center justify-center bg-white/50 backdrop-blur-md shadow-xl"
          initial={{ scale: 0, rotate: -90 }}
          animate={phase >= 1 ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -90 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="w-[5vw] h-[5vw] bg-[var(--color-accent)] rounded-full shadow-inner" />
        </motion.div>

        <motion.h1 
          className="text-[5vw] font-display leading-tight mb-[1vw] text-[var(--color-text-primary)]"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          Lead the change.
        </motion.h1>

        <motion.p 
          className="text-[2vw] font-body text-[var(--color-text-secondary)] mb-[4vw] font-medium"
          initial={{ opacity: 0 }}
          animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1, delay: 0.8 }}
        >
          Become a Founding Ambassador.
        </motion.p>

        <motion.div 
          className="px-[4vw] py-[1.5vw] bg-[var(--color-primary)] text-white text-[1.8vw] font-body font-bold rounded-full shadow-[0_10px_25px_rgba(217,116,74,0.4)]"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.8, type: "spring" }}
        >
          connect.myzolve.com/circle-builder
        </motion.div>
      </div>
    </motion.div>
  );
}
