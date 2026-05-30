import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 3000), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col justify-center items-center px-8 z-10"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -50 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div
        className="absolute inset-0 z-[-1]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ duration: 2 }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/community.png`} 
          className="w-full h-full object-cover" 
          alt="community" 
        />
        <div className="absolute inset-0 bg-[#09090b]/40 mix-blend-overlay" />
      </motion.div>

      <div className="text-center bg-[#09090b]/60 backdrop-blur-md p-8 rounded-3xl border border-white/10 w-full">
        <motion.p
          className="text-[6vw] text-[#94a3b8] font-light tracking-wide uppercase mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8 }}
        >
          They were meant to be
        </motion.p>
        
        <motion.h2 
          className="text-[14vw] font-black text-white leading-none tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.8, delay: 0.4, type: 'spring', bounce: 0.4 }}
        >
          PEOPLE.
        </motion.h2>
      </div>
    </motion.div>
  );
}
