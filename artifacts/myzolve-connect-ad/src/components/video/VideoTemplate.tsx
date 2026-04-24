import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS_MASTER = {
  hook: 4000,
  problem: 5000,
  product: 7000,
  payoff: 5000,
  outro: 4500,
};

export const SCENE_DURATIONS_15S = {
  hook: 4000,
  product: 7000,
  outro: 4000,
};

export const SCENE_DURATIONS_6S = {
  product: 4000,
  outro: 2000,
};

export const SCENE_DURATIONS = SCENE_DURATIONS_MASTER;

export type CutVariant = 'master' | '15s' | '6s';

export interface SceneComponentProps {
  cut?: CutVariant;
}

export type SceneComponent = React.ComponentType<SceneComponentProps>;

const DEFAULT_SCENE_COMPONENTS: Record<string, SceneComponent> = {
  hook: Scene1,
  problem: Scene2,
  product: Scene3,
  payoff: Scene4,
  outro: Scene5,
};

interface VideoTemplateProps {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
  sceneComponents?: Record<string, SceneComponent>;
  cut?: CutVariant;
}

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
  sceneComponents = DEFAULT_SCENE_COMPONENTS,
  cut = 'master',
}: VideoTemplateProps = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const SceneComponent = sceneComponents[baseSceneKey];

  return (
    <div className="relative w-full h-screen bg-[#1A1A1A] flex items-center justify-center overflow-hidden">
      {/* Vertical 9:16 Aspect Ratio Container */}
      <div
        className="relative overflow-hidden shadow-2xl"
        style={{
          width: 'calc(100vh * (9/16))',
          height: '100vh',
          maxWidth: '100vw',
          maxHeight: 'calc(100vw * (16/9))',
          backgroundColor: 'var(--color-bg-light)',
          margin: '0 auto',
        }}
      >
        {/* Persistent cinematic background layer */}
        <div className="absolute inset-0 z-0">
          <video
            src={`${import.meta.env.BASE_URL}videos/bg-warm.mp4`}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />

          <motion.div
            className="absolute inset-0 opacity-40 mix-blend-multiply"
            animate={{
              background: [
                'radial-gradient(circle at 0% 0%, var(--color-accent) 0%, transparent 70%)',
                'radial-gradient(circle at 100% 100%, var(--color-secondary) 0%, transparent 70%)',
                'radial-gradient(circle at 50% 50%, var(--color-primary) 0%, transparent 70%)',
                'radial-gradient(circle at 0% 0%, var(--color-accent) 0%, transparent 70%)',
              ],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* Global persistent elements (e.g. subtle particles) */}
        <motion.div
          className="absolute right-[10%] top-[15%] w-32 h-32 rounded-full blur-2xl opacity-20 pointer-events-none"
          style={{ backgroundColor: 'var(--color-primary)' }}
          animate={{
            x: ['-20%', '20%', '-10%'],
            y: ['0%', '40%', '10%'],
            scale: [1, 1.2, 0.9],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Scenes — key MUST be currentSceneKey (with _r suffix) so scene-lock loop re-mounts properly */}
        <AnimatePresence initial={false} mode="wait">
          {SceneComponent && <SceneComponent key={currentSceneKey} cut={cut} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
