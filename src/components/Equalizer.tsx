import React from 'react';
import { usePlayerStore } from '../stores/usePlayerStore';
import { applyEqMode } from '../services/audioEngine';
import './Equalizer.css';

const PRESETS = ['FLAT', 'BASS', 'VOCAL', 'HALL'] as const;

const Equalizer: React.FC = () => {
  const eqMode = usePlayerStore((state) => state.eqMode);
  const setEqMode = usePlayerStore((state) => state.setEqMode);

  const handlePresetClick = (preset: typeof PRESETS[number]) => {
    setEqMode(preset);
    applyEqMode(preset);
  };

  return (
    <div className="equalizer-container">
      {PRESETS.map((preset) => (
        <button
          key={preset}
          className={`eq-btn ${eqMode === preset ? 'active' : ''}`}
          onClick={() => handlePresetClick(preset)}
        >
          {preset}
        </button>
      ))}
    </div>
  );
};

export default Equalizer;
