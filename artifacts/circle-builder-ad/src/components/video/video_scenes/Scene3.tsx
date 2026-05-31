import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const roles = ["Church Leaders", "PTA Parents", "Neighborhood Organizers", "Coaches", "Nonprofit Leaders", "Club Founders"];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col justify-center pl-[10vw] overflow-hidden"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Background graphic */}
      <motion.div 
        className="absolute inset-0 opacity-10 mix-blend-multiply bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/gathering_2.jpg)` }}
      />

      <div className="relative z-10 w-full max-w-4xl">
        <motion.p 
          className="text-[var(--color-secondary)] text-[1.5vw] font-body tracking-widest uppercase mb-4 font-bold"
          initial={{ opacity: 0, x: -20 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          transition={{ duration: 0.8 }}
        >
          We are looking for
        </motion.p>
        
        <motion.h2 
          className="text-[6vw] font-display text-[var(--color-text-primary)] leading-none mb-12"
          initial={{ opacity: 0, y: 40 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          Founding<br/>Ambassadors
        </motion.h2>

        <div className="flex flex-wrap gap-4 max-w-[60vw]">
          {roles.map((role, i) => (
            <motion.div
              key={role}
              className="px-6 py-3 bg-white/60 border border-[var(--color-primary)]/20 shadow-sm rounded-full text-[var(--color-text-primary)] font-medium text-[1.4vw] font-body whitespace-nowrap"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 20 }}
              transition={{ 
                type: "spring", stiffness: 300, damping: 20,
                delay: phase >= 2 ? i * 0.15 : 0 
              }}
            >
              {role}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
