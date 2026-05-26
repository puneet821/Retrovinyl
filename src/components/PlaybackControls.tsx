import React from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { usePlayerStore } from '../stores/usePlayerStore';
import './PlaybackControls.css';

const PlaybackControls: React.FC = () => {
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const skipForward = usePlayerStore((state) => state.skipForward);
  const skipBackward = usePlayerStore((state) => state.skipBackward);

  return (
    <div className="playback-controls">
      <button className="control-group" onClick={togglePlay}>
        <div className="pill-btn large-pill"></div>
        <span className="control-label">{isPlaying ? 'PAUSE' : 'PLAY'}</span>
      </button>
      
      <div className="right-controls">
        <button className="control-group" onClick={skipBackward}>
          <div className="pill-btn small-pill"></div>
          <SkipBack size={18} className="control-icon" fill="currentColor" />
        </button>
        
        <button className="control-group" onClick={skipForward}>
          <div className="pill-btn small-pill"></div>
          <SkipForward size={18} className="control-icon" fill="currentColor" />
        </button>
      </div>
    </div>
  );
};

export default PlaybackControls;
