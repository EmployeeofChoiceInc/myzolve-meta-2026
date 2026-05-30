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
        className="absolute inset-0 z-[-1]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/gathering-3.jpg`} 
          className="w-full h-full object-cover" 
          alt="community gathering" 
        />
        <div className="absolute inset-0 bg-[#FAF3E7]/80 backdrop-blur-sm" />
      </motion.div>

      <motion.div
        className="mb-8"
        initial={{ scale: 0 }}
        animate={phase >= 1 ? { scale: 1 } : { scale: 0 }}
        transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/founder-badge.png`} 
          className="w-48 h-48 object-contain drop-shadow-[0_10px_30px_rgba(217,116,74,0.3)]" 
          alt="Founder Badge" 
        />
      </motion.div>

      <motion.h2
        className="text-[10vw] font-black leading-none mb-4"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
      >
        LEAD THE CHANGE
      </motion.h2>

      <motion.p
        className="text-[5vw] mb-12 font-bold"
        style={{ color: 'var(--color-text-secondary)' }}
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        Join the MyZolve Circle Builder Program
      </motion.p>

      <motion.div
        className="px-8 py-5 rounded-full font-black text-[5vw] shadow-2xl"
        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
      >
        connect.myzolve.com/circle-builder
      </motion.div>
      
      <motion.p
        className="absolute bottom-10 text-[3.5vw] tracking-widest uppercase font-black"
        style={{ color: 'var(--color-accent)' }}
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      >
        MyZolve Connect
      </motion.p>
    </motion.div>
  );
}
