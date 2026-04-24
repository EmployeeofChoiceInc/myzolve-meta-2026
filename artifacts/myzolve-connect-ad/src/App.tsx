import { useMemo } from 'react';
import VideoWithControls from "@/components/video/VideoWithControls";
import VideoTemplate, { 
  SCENE_DURATIONS_15S, 
  SCENE_DURATIONS_6S 
} from "@/components/video/VideoTemplate";

export default function App() {
  const cut = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('cut');
  }, []);

  if (cut === '15s') {
    return <VideoTemplate durations={SCENE_DURATIONS_15S} cut="15s" />;
  }

  if (cut === '6s') {
    return <VideoTemplate durations={SCENE_DURATIONS_6S} cut="6s" />;
  }

  return <VideoWithControls />;
}
