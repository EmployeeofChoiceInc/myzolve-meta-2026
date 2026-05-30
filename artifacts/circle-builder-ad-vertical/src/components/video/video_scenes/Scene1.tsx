import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3500), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col justify-center items-center px-8 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(10px)', scale: 1.1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Cold moment for "Algorithms" */}
      <motion.div
        className="absolute inset-0 z-[-1] bg-[#1e293b]"
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 0.8 } : { opacity: 0 }}
        transition={{ duration: 1 }}
      />
      <motion.div
        className="absolute inset-0 z-[-1]"
        initial={{ opacity: 0, scale: 1.2 }}
        animate={{ opacity: phase >= 2 ? 0.4 : 0, scale: 1 }}
        transition={{ duration: 3, ease: 'easeOut' }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/algorithm.png`} 
          className="w-full h-full object-cover mix-blend-luminosity grayscale" 
          alt="algorithm" 
        />
      </motion.div>

      <div className="text-center relative z-10">
        <motion.h1 
          className="text-[10vw] font-bold leading-[1.1] mb-6"
          style={{ fontFamily: 'var(--font-display)', color: phase >= 2 ? '#e2e8f0' : 'var(--color-text-primary)' }}
          transition={{ duration: 0.5 }}
        >
          {'COMMUNITIES'.split('').map((char, i) => (
            <motion.span key={i} style={{ display: 'inline-block' }}
              initial={{ opacity: 0, y: 20, rotateX: 90 }}
              animate={phase >= 1 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 20, rotateX: 90 }}
              transition={{ duration: 0.8, delay: phase >= 1 ? i * 0.06 : 0, type: 'spring', damping: 20 }}
            >
              {char}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          className="text-[6vw] font-bold tracking-wide uppercase"
          style={{ color: phase >= 2 ? '#94a3b8' : 'var(--color-secondary)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          Were never meant to be
        </motion.p>
        
        <motion.p
          className="text-[12vw] font-black uppercase mt-2 tracking-tighter"
          style={{ color: '#38bdf8' }}
          initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
          animate={phase >= 2 ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : { opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
          transition={{ duration: 0.8, delay: 0.3, type: 'spring', damping: 15 }}
        >
          Algorithms
        </motion.p>
      </div>
    </motion.div>
  );
}
