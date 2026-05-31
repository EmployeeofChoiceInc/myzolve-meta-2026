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
        className="absolute inset-0 z-[-1]"
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 4, ease: "easeOut" }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/gathering-2.jpg`} 
          className="w-full h-full object-cover" 
          alt="community gathering" 
        />
        <div className="absolute inset-0 bg-[#FBF5EA]/70" />
      </motion.div>

      <motion.div 
        className="absolute right-[-20vw] top-[5vh] w-[70vw] opacity-40 mix-blend-multiply drop-shadow-lg"
        initial={{ opacity: 0, rotate: -20, scale: 0.8 }}
        animate={phase >= 1 ? { opacity: 0.3, rotate: 0, scale: 1 } : { opacity: 0, rotate: -20, scale: 0.8 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      >
        <img src={`${import.meta.env.BASE_URL}images/founder-peach-badge.png`} className="w-full h-auto drop-shadow-2xl" alt="badge" />
      </motion.div>

      <motion.h3
        className="text-[8vw] font-bold mb-10 leading-tight relative z-10"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      >
        Become a<br/>
        <span className="text-[var(--color-primary)] text-[12vw] block mt-2">Founding Ambassador</span>
      </motion.h3>

      <div className="space-y-6 z-10">
        {steps.map((step, idx) => (
          <motion.div
            key={idx}
            className="flex items-start gap-4 bg-[#FBF5EA]/90 backdrop-blur-md p-5 rounded-2xl border border-[var(--color-primary)]/20 shadow-xl"
            initial={{ opacity: 0, x: -30 }}
            animate={phase >= idx + 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{ duration: 0.5, type: 'spring', bounce: 0.2 }}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 border-[var(--color-primary)]" style={{ backgroundColor: 'var(--color-bg-muted)' }}>
              <span className="text-[var(--color-primary)] font-bold">{idx + 1}</span>
            </div>
            <div>
              <h4 className="text-[5vw] font-black tracking-wide" style={{ color: 'var(--color-text-primary)' }}>{step.title}</h4>
              <p className="text-[4vw] font-medium" style={{ color: 'var(--color-text-muted)' }}>{step.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
