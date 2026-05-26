import React, { useEffect } from 'react';
import VinylTurntable from './components/VinylTurntable';
import ToneArm from './components/ToneArm';
import PlaybackControls from './components/PlaybackControls';
import ThemePicker from './components/ThemePicker';
import SearchBar from './components/SearchBar';
import ConnectionModal from './components/ConnectionModal';
import HamburgerMenu from './components/HamburgerMenu';
import { usePlayerStore } from './stores/usePlayerStore';
import { useThemeStore } from './stores/useThemeStore';
import { handleSpotifyCallback } from './services/spotifyAuth';
import { fetchUserPlaylists } from './services/spotifyApi';
import PlaylistStack from './components/PlaylistStack';
import { Settings, Menu, Search, Library, Plus } from 'lucide-react';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import { updateMediaSessionWithVinyl } from './services/mediaSession';
import './App.css';

function App() {
  const { currentTrack, setTrack, isPlaying, setPosition, setDuration, position, duration, spotifyToken, setSpotifyToken, setPlaylists, isPlaylistViewOpen, setIsPlaylistViewOpen } = usePlayerStore();
  const activeTheme = useThemeStore((state) => state.activeTheme);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [showConnectionModal, setShowConnectionModal] = React.useState(false);
  const [showSideMenu, setShowSideMenu] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [addingTrack, setAddingTrack] = React.useState<any | null>(null);

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

    // Setup Media Session handlers
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        usePlayerStore.getState().play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        usePlayerStore.getState().pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        usePlayerStore.getState().playPrevious();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        usePlayerStore.getState().playNext();
      });
    }

    // Restore last playing track from localStorage (survives page reload)
    try {
      const savedState = localStorage.getItem('retro_playback_state');
      if (savedState) {
        const { track, queue, queueIndex, pos } = JSON.parse(savedState);
        if (track && track.url) {
          // Restore track but DON'T auto-play (browser blocks autoplay on reload)
          usePlayerStore.setState({
            currentTrack: track,
            currentQueue: queue || [track],
            currentQueueIndex: queueIndex ?? 0,
            position: pos || 0,
            isPlaying: false, // Always start paused on reload
          });
        }
      } else {
        // First time visit — set default track
        setTrack({
          id: '1',
          title: 'Retro Vibes',
          artist: 'Synthwave Explorer',
          artwork: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&q=80',
          url: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_b8c910eb1b.mp3?filename=retro-wave-style-track-110034.mp3'
        });
      }
    } catch {
      // Fallback default track
      setTrack({
        id: '1',
        title: 'Retro Vibes',
        artist: 'Synthwave Explorer',
        artwork: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&q=80',
        url: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_b8c910eb1b.mp3?filename=retro-wave-style-track-110034.mp3'
      });
    }
    
    document.body.className = `theme-${activeTheme}`;
    
    // Save playback state when page is about to be killed
    const savePlaybackState = () => {
      const state = usePlayerStore.getState();
      if (state.currentTrack) {
        localStorage.setItem('retro_playback_state', JSON.stringify({
          track: state.currentTrack,
          queue: state.currentQueue,
          queueIndex: state.currentQueueIndex,
          pos: state.position,
        }));
      }
    };

    window.addEventListener('beforeunload', savePlaybackState);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') savePlaybackState();
    });

    return () => {
      window.removeEventListener('beforeunload', savePlaybackState);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      }
    }
  }, []);

  // Fetch playlists when token is available
  useEffect(() => {
    if (spotifyToken) {
      fetchUserPlaylists(spotifyToken)
        .then(data => setPlaylists(data))
        .catch(err => {
          console.error("Failed to fetch playlists:", err);
          if (err.message?.includes('expired') || err.message?.includes('401')) {
            setSpotifyToken(null);
            localStorage.removeItem('spotify_access_token');
          }
        });
    }
  }, [spotifyToken, setPlaylists, setSpotifyToken]);

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

  // Re-sync audio when returning from background (mobile browsers pause audio silently)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && audioRef.current) {
        const storeState = usePlayerStore.getState();
        if (storeState.isPlaying) {
          // Audio was supposed to be playing — check if the browser silently paused it
          if (audioRef.current.paused) {
            audioRef.current.play().catch(e => {
              console.warn('Resume after background failed', e);
              // If we can't resume, sync state to paused
              usePlayerStore.getState().pause();
            });
          }
          // Sync position to actual audio position
          setPosition(audioRef.current.currentTime);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [setPosition]);

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
      // Push vinyl artwork to lock screen
      updateMediaSessionWithVinyl(currentTrack.title, currentTrack.artist, currentTrack.artwork);
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
      <audio 
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) setPosition(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => usePlayerStore.getState().playNext()}
        onPlay={() => usePlayerStore.setState({ isPlaying: true })}
        onPause={() => usePlayerStore.setState({ isPlaying: false })}
      />

      {currentTrack?.artwork && (
        <div 
          className="dynamic-bg"
          style={{ backgroundImage: `url(${currentTrack.artwork})` }}
        />
      )}
      <div className="dynamic-bg-overlay" />

      <div className="top-actions">
        <button className="settings-btn glass" onClick={() => setShowSideMenu(true)} style={{ marginRight: 'auto' }}>
          <Menu size={20} />
        </button>
        <button className="settings-btn glass" onClick={() => setShowSearch(!showSearch)} style={{ marginLeft: '10px' }}>
          <Search size={20} />
        </button>
        <button className="settings-btn glass" onClick={() => setIsPlaylistViewOpen(!isPlaylistViewOpen)} style={{ marginLeft: '10px' }}>
          <Library size={20} />
        </button>
        <button className="settings-btn glass" onClick={() => setShowConnectionModal(true)} style={{ marginLeft: '10px', marginRight: '10px' }}>
          <Settings size={20} />
        </button>
        <ThemePicker />
      </div>

      {isPlaylistViewOpen && <PlaylistStack />}

      {showSearch && <SearchBar />}

      <main className="player-main">
        <div className="turntable-wrapper">
          <VinylTurntable />
          <ToneArm />
        </div>

        <div className="bottom-controls-wrapper">
          <div className="track-info">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <h2 className="track-title">{currentTrack?.title || 'No track selected'}</h2>
              {currentTrack && (
                <button 
                  className="add-to-playlist-icon-btn" 
                  onClick={() => setAddingTrack(currentTrack)}
                  title="Add to Playlist"
                  style={{ padding: '4px', marginTop: '-4px' }}
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
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

      <HamburgerMenu isOpen={showSideMenu} onClose={() => setShowSideMenu(false)} />

      {showConnectionModal && (
        <ConnectionModal onClose={() => setShowConnectionModal(false)} />
      )}

      {addingTrack && (
        <AddToPlaylistModal 
          track={addingTrack} 
          onClose={() => setAddingTrack(null)} 
        />
      )}
    </div>
  );
}

export default App;
