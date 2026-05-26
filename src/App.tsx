import React, { useEffect } from 'react';
import VinylTurntable from './components/VinylTurntable';
import ToneArm from './components/ToneArm';
import PlaybackControls from './components/PlaybackControls';
import ThemePicker from './components/ThemePicker';
import SearchBar from './components/SearchBar';
import ConnectionModal from './components/ConnectionModal';
import SideMenu from './components/SideMenu';
import { usePlayerStore } from './stores/usePlayerStore';
import { useThemeStore } from './stores/useThemeStore';
import { handleSpotifyCallback } from './services/spotifyAuth';
import { Settings, Menu, Search } from 'lucide-react';
import './App.css';

function App() {
  const { currentTrack, setTrack, isPlaying, pause, setPosition, setDuration, position, duration, setSpotifyToken } = usePlayerStore();
  const activeTheme = useThemeStore((state) => state.activeTheme);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [showConnectionModal, setShowConnectionModal] = React.useState(false);
  const [showSideMenu, setShowSideMenu] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);

  // Initialize Audio Element and Check Spotify Callback
  useEffect(() => {
    // Check Spotify Auth Callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      handleSpotifyCallback(code).then(token => {
        if (token) setSpotifyToken(token);
      });
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current) {
          setPosition(audioRef.current.currentTime);
        }
      });
      audioRef.current.addEventListener('loadedmetadata', () => {
        if (audioRef.current) {
          setDuration(audioRef.current.duration);
        }
      });
      audioRef.current.addEventListener('ended', () => {
        pause();
        setPosition(0);
      });
    }

    setTrack({
      id: '1',
      title: 'Retro Vibes',
      artist: 'Synthwave Explorer',
      artwork: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&q=80',
      url: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_b8c910eb1b.mp3?filename=retro-wave-style-track-110034.mp3' // public royalty free demo track
    });
    
    document.body.className = `theme-${activeTheme}`;
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    }
  }, []);

  // Handle Play/Pause synchronization
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.warn('Playback prevented', e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Handle Seek synchronization
  const requestedSeekTime = usePlayerStore((state) => state.requestedSeekTime);
  const requestSeek = usePlayerStore((state) => state.requestSeek);

  useEffect(() => {
    if (requestedSeekTime !== null && audioRef.current) {
      audioRef.current.currentTime = requestedSeekTime;
      setPosition(requestedSeekTime);
      requestSeek(null);
    }
  }, [requestedSeekTime, setPosition, requestSeek]);

  // Handle track source change
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      if (audioRef.current.src !== currentTrack.url) {
        audioRef.current.src = currentTrack.url;
        if (isPlaying) {
          audioRef.current.play().catch(e => console.warn('Playback prevented', e));
        }
      }
    }
  }, [currentTrack, isPlaying]);

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    setPosition(newTime);
  };

  return (
    <div className="app-container">
      <div className="top-actions">
        <button className="settings-btn glass" onClick={() => setShowSideMenu(true)} style={{ marginRight: 'auto' }}>
          <Menu size={20} />
        </button>
        <button className="settings-btn glass" onClick={() => setShowSearch(!showSearch)} style={{ marginLeft: '10px' }}>
          <Search size={20} />
        </button>
        <button className="settings-btn glass" onClick={() => setShowConnectionModal(true)} style={{ marginLeft: '10px', marginRight: '10px' }}>
          <Settings size={20} />
        </button>
        <ThemePicker />
      </div>

      {showSearch && <SearchBar />}

      <main className="player-main">
        <div className="turntable-wrapper">
          <VinylTurntable />
          <ToneArm />
        </div>

        <div className="bottom-controls-wrapper">
          <div className="track-info">
            <h2 className="track-title">{currentTrack?.title || 'No track selected'}</h2>
            <p className="track-artist">{currentTrack?.artist || 'Unknown Artist'}</p>
          </div>

          <div className="progress-container">
            <span className="time">{formatTime(position)}</span>
            <div className="progress-bar-container">
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={position} 
                onChange={handleSeek}
                className="progress-slider"
              />
              <div 
                className="progress-fill" 
                style={{ width: `${(position / (duration || 1)) * 100}%` }}
              ></div>
            </div>
            <span className="time">{formatTime(duration)}</span>
          </div>

          <PlaybackControls />
        </div>
      </main>

      <SideMenu isOpen={showSideMenu} onClose={() => setShowSideMenu(false)} />

      {showConnectionModal && (
        <ConnectionModal onClose={() => setShowConnectionModal(false)} />
      )}
    </div>
  );
}

export default App;
