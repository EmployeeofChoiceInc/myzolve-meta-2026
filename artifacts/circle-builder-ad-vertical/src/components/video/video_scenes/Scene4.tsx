import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1700),
      setTimeout(() => setPhase(4), 2400),
      setTimeout(() => setPhase(5), 4000), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const steps = [
    { title: 'RECRUIT', desc: 'Invite your community' },
    { title: 'HOST', desc: 'Bring them together' },
    { title: 'FACILITATE', desc: 'Keep the circle thriving' }
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col justify-center px-8 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div 
        className="absolute right-[-20vw] top-[10vh] w-[70vw] opacity-40 mix-blend-screen"
        initial={{ opacity: 0, rotate: -20, scale: 0.8 }}
        animate={phase >= 1 ? { opacity: 0.5, rotate: 0, scale: 1 } : { opacity: 0, rotate: -20, scale: 0.8 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      >
        <img src={`${import.meta.env.BASE_URL}images/founder-badge.png`} className="w-full h-auto drop-shadow-2xl" alt="badge" />
      </motion.div>

      <motion.h3
        className="text-[8vw] font-bold text-white mb-10 leading-tight"
        style={{ fontFamily: 'var(--font-display)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      >
        Become a<br/>
        <span className="text-[#f59e0b] text-[12vw] block mt-2">Founding Ambassador</span>
      </motion.h3>

      <div className="space-y-6 z-10">
        {steps.map((step, idx) => (
          <motion.div
            key={idx}
            className="flex items-start gap-4 bg-[#09090b]/80 backdrop-blur-sm p-5 rounded-2xl border border-white/5"
            initial={{ opacity: 0, x: -30 }}
            animate={phase >= idx + 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.5, type: 'spring', bounce: 0.2 }}
          >
            <div className="w-10 h-10 rounded-full bg-[#f59e0b]/20 flex items-center justify-center shrink-0 border border-[#f59e0b]/50">
              <span className="text-[#f59e0b] font-bold">{idx + 1}</span>
            </div>
            <div>
              <h4 className="text-[5vw] font-bold text-white tracking-wide">{step.title}</h4>
              <p className="text-[4vw] text-[#94a3b8]">{step.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
