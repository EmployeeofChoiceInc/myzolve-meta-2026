import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 3000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 w-full h-full">
        {/* Photo 1: Family */}
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/family.jpg`}
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
          animate={{ 
            opacity: phase >= 1 && phase < 3 ? 0.7 : 0, 
            scale: phase >= 1 ? 1 : 1.1,
            filter: phase >= 1 ? 'blur(0px)' : 'blur(10px)'
          }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        {/* Photo 2: Friends */}
        <motion.img 
          src={`${import.meta.env.BASE_URL}images/friends.jpg`}
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
          animate={{ 
            opacity: phase >= 3 ? 0.7 : 0, 
            scale: phase >= 3 ? 1 : 1.1,
            filter: phase >= 3 ? 'blur(0px)' : 'blur(10px)'
          }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-bg-dark)]/40 via-transparent to-[var(--color-bg-dark)]/80" />
      </div>

      <div className="relative z-10 w-full mt-auto mb-16 text-center">
        <motion.div
          className="inline-block bg-[var(--color-primary)] text-[var(--color-bg-light)] px-4 py-2 rounded-full font-bold text-[3vw] mb-6 uppercase tracking-widest"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 300, damping: 20 }}
        >
          Your trusted circle
        </motion.div>

        <motion.h1 
          className="text-[11vw] font-bold text-[var(--color-bg-light)] leading-[1.1] tracking-tight"
          initial={{ opacity: 0, y: 40 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          is already there.
        </motion.h1>
      </div>
    </motion.div>
  );
}
