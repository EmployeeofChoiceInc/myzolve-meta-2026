import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1 }}
    >
      <motion.div 
        className="absolute inset-0 opacity-60 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/community.png)` }}
        animate={{ scale: [1.1, 1], filter: ['blur(10px)', 'blur(0px)'] }}
        transition={{ duration: 5, ease: "easeOut" }}
      />
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/80" />

      <div className="z-10 text-center px-12 w-full max-w-6xl">
        <motion.h1 
          className="text-[6vw] font-display text-[var(--color-accent)] leading-tight italic mb-12"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          They were meant to be people.
        </motion.h1>

        <motion.div
          className="mx-auto w-[2px] h-16 bg-[var(--color-primary)] mb-12"
          initial={{ scaleY: 0 }}
          animate={phase >= 2 ? { scaleY: 1 } : { scaleY: 0 }}
          transition={{ duration: 0.8 }}
          style={{ originY: 0 }}
        />

        <motion.p 
          className="text-[2.5vw] font-body text-white font-light"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 1, delay: 0.3 }}
        >
          Help us build <strong className="font-semibold text-white">100 real-world support circles</strong>.
          <br/>
          Gather in person, not just scroll.
        </motion.p>
      </div>
    </motion.div>
  );
}
