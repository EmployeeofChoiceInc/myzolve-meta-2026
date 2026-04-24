import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 3800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 bg-[var(--color-bg-light)]"
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: '0%' }}
      exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute -top-[20%] -left-[20%] w-[140%] h-[50%] bg-[var(--color-muted)] rounded-[100%] blur-3xl opacity-50"
          animate={{ rotate: 5, scale: [1, 1.05, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col gap-6 mt-[-10%]">
        
        {/* Chat bubble 1 */}
        <motion.div 
          className="self-start bg-[var(--color-muted)] text-[var(--color-foreground)] p-5 rounded-2xl rounded-tl-sm shadow-sm max-w-[85%]"
          initial={{ opacity: 0, scale: 0.8, x: -20 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1, x: 0 } : { opacity: 0, scale: 0.8, x: -20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <p className="text-[4vw] font-medium leading-snug">"Car broke down again. Really stressed about the repair bill."</p>
        </motion.div>

        {/* Chat bubble 2 */}
        <motion.div 
          className="self-end bg-[var(--color-primary)] text-white p-5 rounded-2xl rounded-tr-sm shadow-md max-w-[85%]"
          initial={{ opacity: 0, scale: 0.8, x: 20 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1, x: 0 } : { opacity: 0, scale: 0.8, x: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <p className="text-[4vw] font-medium leading-snug">"We've got you. Let's start a support request in the circle."</p>
        </motion.div>

      </div>

      <div className="absolute bottom-[15%] w-full text-center px-8">
        <motion.h2 
          className="text-[8vw] font-bold text-[var(--color-foreground)] leading-tight tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          Now there's a <span className="text-[var(--color-primary)]">kind, private</span> way to use it.
        </motion.h2>
      </div>

    </motion.div>
  );
}
