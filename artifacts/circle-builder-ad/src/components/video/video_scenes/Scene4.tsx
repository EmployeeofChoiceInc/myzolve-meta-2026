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
      className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-light)]"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex w-full px-[10vw] gap-12 items-center">
        
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
                <div className="w-16 h-16 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-2xl font-bold shrink-0">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-[3vw] font-display text-[var(--color-bg-dark)] leading-none mb-2">{step.title}</h3>
                  <p className="text-[1.5vw] font-body text-[var(--color-secondary)]">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className="w-[1px] h-[60vh] bg-[var(--color-secondary)]/20 overflow-hidden relative">
          <motion.div 
            className="absolute top-0 left-0 w-full bg-[var(--color-primary)]"
            initial={{ height: "0%" }}
            animate={phase >= 2 ? { height: "100%" } : { height: "0%" }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
        </div>

        <div className="flex-1 pl-12">
          <motion.h3 
            className="text-[2vw] font-display text-[var(--color-bg-dark)] mb-8"
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
                className="flex items-center gap-4 text-[1.5vw] font-body text-[var(--color-secondary)]"
                initial={{ opacity: 0, y: 20 }}
                animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.5, delay: phase >= 3 ? i * 0.15 : 0 }}
              >
                <span className="text-[var(--color-primary)]">★</span> {benefit}
              </motion.li>
            ))}
          </ul>
        </div>

      </div>
    </motion.div>
  );
}
