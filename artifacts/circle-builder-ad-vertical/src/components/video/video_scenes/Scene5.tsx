import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 3500), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col justify-center items-center px-8 z-10 text-center"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <motion.div
        className="mb-8"
        initial={{ scale: 0 }}
        animate={phase >= 1 ? { scale: 1 } : { scale: 0 }}
        transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/founder-badge.png`} 
          className="w-48 h-48 object-contain drop-shadow-[0_0_30px_rgba(245,158,11,0.4)]" 
          alt="Founder Badge" 
        />
      </motion.div>

      <motion.h2
        className="text-[10vw] font-black text-white leading-none mb-4"
        style={{ fontFamily: 'var(--font-display)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
      >
        LEAD THE CHANGE
      </motion.h2>

      <motion.p
        className="text-[5vw] text-[#94a3b8] mb-12 font-light"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        Join the MyZolve Circle Builder Program
      </motion.p>

      <motion.div
        className="bg-[#f59e0b] text-[#09090b] px-8 py-5 rounded-full font-bold text-[5vw] shadow-[0_0_40px_rgba(245,158,11,0.3)]"
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
      >
        connect.myzolve.com/circle-builder
      </motion.div>
      
      <motion.p
        className="absolute bottom-10 text-[3.5vw] text-white/40 tracking-widest uppercase font-bold"
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      >
        MyZolve Connect
      </motion.p>
    </motion.div>
  );
}
