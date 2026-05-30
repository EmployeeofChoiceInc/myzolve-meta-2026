import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-black overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1 }}
    >
      <motion.div 
        className="absolute inset-0 opacity-40 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/algorithm.png)` }}
        animate={{ scale: [1, 1.1], opacity: [0.2, 0.4] }}
        transition={{ duration: 6, ease: "linear" }}
      />
      
      <div className="absolute inset-0 bg-black/60" />

      <div className="z-10 text-center px-8 w-full max-w-5xl">
        <motion.p 
          className="text-white/70 text-[2vw] font-body tracking-widest uppercase mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 1 }}
        >
          The Problem
        </motion.p>

        <h1 className="text-[5vw] font-display text-white leading-tight font-medium">
          {'COMMUNITIES WERE NEVER'.split(' ').map((word, i) => (
            <motion.span 
              key={i} 
              className="inline-block mr-[1.5vw]"
              initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
              animate={phase >= 2 ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 40, filter: 'blur(10px)' }}
              transition={{ duration: 0.8, delay: phase >= 2 ? i * 0.15 : 0, ease: [0.16, 1, 0.3, 1] }}
            >
              {word}
            </motion.span>
          ))}
          <br/>
          {'MEANT TO BE ALGORITHMS.'.split(' ').map((word, i) => (
            <motion.span 
              key={`line2-${i}`} 
              className="inline-block mr-[1.5vw] text-transparent bg-clip-text bg-gradient-to-r from-gray-400 to-gray-600"
              initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
              animate={phase >= 2 ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 40, filter: 'blur(10px)' }}
              transition={{ duration: 0.8, delay: phase >= 2 ? 0.6 + i * 0.15 : 0, ease: [0.16, 1, 0.3, 1] }}
            >
              {word}
            </motion.span>
          ))}
        </h1>
      </div>
    </motion.div>
  );
}
