import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const steps = [
    { title: "Recruit", desc: "Invite your community" },
    { title: "Host", desc: "Bring them together" },
    { title: "Facilitate", desc: "Keep it thriving" },
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0, clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)' }}
      animate={{ opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex w-full px-[10vw] gap-12 items-center z-10">
        
        <div className="flex-1">
          <motion.div className="flex flex-col gap-12">
            {steps.map((step, i) => (
              <motion.div 
                key={step.title}
                className="flex items-start gap-8"
                initial={{ opacity: 0, x: -40 }}
                animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
                transition={{ duration: 0.8, delay: phase >= 1 ? i * 0.4 : 0 }}
              >
                <div className="w-16 h-16 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-2xl font-bold shrink-0 shadow-md">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-[3vw] font-display text-[var(--color-text-primary)] leading-none mb-2">{step.title}</h3>
                  <p className="text-[1.5vw] font-body text-[var(--color-text-secondary)]">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className="w-[2px] h-[60vh] bg-[var(--color-secondary)]/20 overflow-hidden relative">
          <motion.div 
            className="absolute top-0 left-0 w-full bg-[var(--color-primary)]"
            initial={{ height: "0%" }}
            animate={phase >= 2 ? { height: "100%" } : { height: "0%" }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
        </div>

        <div className="flex-1 pl-12 bg-white/40 p-8 rounded-2xl border border-[var(--color-primary)]/10 shadow-xl backdrop-blur-sm relative overflow-hidden">
          <motion.div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--color-accent)]/20 rounded-full blur-2xl" />
          <motion.h3 
            className="text-[2vw] font-display text-[var(--color-text-primary)] mb-8 font-bold"
            initial={{ opacity: 0 }}
            animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            What you get:
          </motion.h3>
          <ul className="flex flex-col gap-6">
            {[
              "Permanent Founder Badge",
              "Direct product influence",
              "Strategy sessions with team",
              "Exclusive Founder Circle"
            ].map((benefit, i) => (
              <motion.li 
                key={i}
                className="flex items-center gap-4 text-[1.5vw] font-body text-[var(--color-text-primary)] font-medium"
                initial={{ opacity: 0, y: 20 }}
                animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.5, delay: phase >= 3 ? i * 0.15 : 0 }}
              >
                <span className="text-[var(--color-primary)] text-2xl">✤</span> {benefit}
              </motion.li>
            ))}
          </ul>
        </div>

      </div>
    </motion.div>
  );
}
