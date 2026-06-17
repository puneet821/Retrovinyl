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
import { searchSongs } from './services/api';
import PlaylistStack from './components/PlaylistStack';
import { Settings, Menu, Search, Library, Plus } from 'lucide-react';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import { updateMediaSessionWithVinyl } from './services/mediaSession';
import { initializeAudioPipeline, setEqualizerPreset, resumeAudioContext, suspendAudioContext } from './services/audioManager';
import YouTube from 'react-youtube';
import './App.css';

const YOUTUBE_OPTS = {
  height: '0',
  width: '0',
  playerVars: {
    autoplay: 0,
    controls: 0,
    disablekb: 1,
  },
};

function App() {
  const { currentTrack, setTrack, setPosition, setDuration, position, duration, spotifyToken, setSpotifyToken, setPlaylists, isPlaylistViewOpen, setIsPlaylistViewOpen, eqMode, setEqMode } = usePlayerStore();
  const activeTheme = useThemeStore((state) => state.activeTheme);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [showConnectionModal, setShowConnectionModal] = React.useState(false);
  const [showSideMenu, setShowSideMenu] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [addingTrack, setAddingTrack] = React.useState<any | null>(null);
  const ytPlayerRef = React.useRef<any>(null);
  const skipErrorCount = React.useRef(0);
  const lastErrorTime = React.useRef(0);

  const handleYtReady = React.useCallback((e: any) => {
    ytPlayerRef.current = e.target;
    e.target.setVolume(100);
    const duration = e.target.getDuration();
    if (!isNaN(duration) && duration > 0) {
      usePlayerStore.getState().setDuration(duration);
    }
    if (usePlayerStore.getState().isPlaying) {
      e.target.playVideo();
    }
  }, []);

  const handleTrackEnded = React.useCallback(() => {
    usePlayerStore.getState().playNext(audioRef.current || undefined);
  }, []);

  const handleYtStateChange = React.useCallback((e: any) => {
    if (e.data === 0) {
      handleTrackEnded();
    } else if (e.data === 1) {
      usePlayerStore.setState({ isPlaying: true });
    } else if (e.data === 2) {
      usePlayerStore.setState({ isPlaying: false });
    }
  }, [handleTrackEnded]);

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
        usePlayerStore.getState().playPrevious(audioRef.current || undefined);
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        usePlayerStore.getState().playNext(audioRef.current || undefined);
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

  // Direct audio sync via store subscription (works in background unlike React useEffect)
  useEffect(() => {
    let prevTrackUrl = '';
    let prevIsPlaying = false;
    let ytPollingInterval: any = null;

    const unsub = usePlayerStore.subscribe((state) => {
      const audio = audioRef.current;
      const ytPlayer = ytPlayerRef.current;
      
      // Track changed — load new source
      if (state.currentTrack && state.currentTrack.url !== prevTrackUrl) {
        prevTrackUrl = state.currentTrack.url;
        
        const isYouTube = state.currentTrack.url.startsWith('youtube:');

        if (!isYouTube) {
          if (audio) {
            // Prevent double-loading: if playNext already set the src synchronously, don't set it again.
            if (audio.getAttribute('src') !== state.currentTrack.url) {
              audio.src = state.currentTrack.url;
              audio.load();
            }

            if (state.isPlaying) {
              resumeAudioContext();
              audio.play().catch(e => console.warn('Playback prevented', e));
            }
          }
        }
        
        // Update lock screen artwork
        updateMediaSessionWithVinyl(state.currentTrack.title, state.currentTrack.artist, state.currentTrack.artwork);
      }

      // Play/pause changed
      if (state.isPlaying !== prevIsPlaying) {
        prevIsPlaying = state.isPlaying;
        
        const isYouTube = state.currentTrack?.url?.startsWith('youtube:');
        
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
        }
        
        if (!isYouTube) {
          if (audio) {
            if (state.isPlaying) {
              resumeAudioContext();
              audio.play().catch(e => console.warn('Playback prevented', e));
            } else {
              audio.pause();
              suspendAudioContext();
            }
          }
        } else if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
          // YouTube play/pause logic
          if (state.isPlaying) {
            ytPlayer.playVideo();
          } else {
            ytPlayer.pauseVideo();
          }
        }

        // YouTube Position Polling
        if (isYouTube && state.isPlaying) {
          if (!ytPollingInterval) {
            ytPollingInterval = setInterval(() => {
              const yt = ytPlayerRef.current;
              if (yt && typeof yt.getCurrentTime === 'function' && typeof yt.getDuration === 'function') {
                const currentTime = yt.getCurrentTime();
                const totalTime = yt.getDuration();
                // Ensure we don't dispatch NaN to the store
                if (!isNaN(currentTime)) setPosition(currentTime);
                if (!isNaN(totalTime) && totalTime > 0) setDuration(totalTime);
              }
            }, 1000);
          }
        } else {
          if (ytPollingInterval) {
            clearInterval(ytPollingInterval);
            ytPollingInterval = null;
          }
        }
      }

      // Seek requested
      if (state.requestedSeekTime !== null) {
        const isYouTube = state.currentTrack?.url?.startsWith('youtube:');
        
        if (!isYouTube && audio) {
          audio.currentTime = state.requestedSeekTime;
        } else if (isYouTube && ytPlayer && typeof ytPlayer.seekTo === 'function') {
          ytPlayer.seekTo(state.requestedSeekTime, true);
        }
        
        setPosition(state.requestedSeekTime);
        usePlayerStore.getState().requestSeek(null);
      }
    });

    return () => {
      unsub();
      if (ytPollingInterval) clearInterval(ytPollingInterval);
    };
  }, [setPosition, setDuration]);

  // Sync Equalizer preset state changes
  useEffect(() => {
    if (audioRef.current) {
      // We only set the preset here. Initialization is deferred to actual user interaction (onPlay)
      setEqualizerPreset(eqMode);
    }
  }, [eqMode]);

  // Re-sync audio when returning from background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && audioRef.current) {
        const state = usePlayerStore.getState();
        if (state.isPlaying) {
          resumeAudioContext();
          if (audioRef.current.paused) {
            audioRef.current.play().catch(e => {
              console.warn('Resume after background failed', e);
              usePlayerStore.getState().pause();
            });
          }
        }
        if (state.currentTrack && audioRef.current.src !== state.currentTrack.url) {
          audioRef.current.src = state.currentTrack.url;
          audioRef.current.load();
          if (state.isPlaying) {
            resumeAudioContext();
            audioRef.current.play().catch(e => console.warn('Playback prevented', e));
          }
        }
        setPosition(audioRef.current.currentTime);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [setPosition]);

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
        crossOrigin="anonymous"
        onTimeUpdate={() => {
          if (audioRef.current) setPosition(audioRef.current.currentTime);
          // Attempt to keep Web Audio API alive in the background
          if (usePlayerStore.getState().isPlaying) {
            resumeAudioContext();
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={handleTrackEnded}
        onPlay={() => {
          if (audioRef.current) {
            initializeAudioPipeline(audioRef.current);
            setEqualizerPreset(usePlayerStore.getState().eqMode);
          }
          // Track played successfully — reset the error circuit breaker
          skipErrorCount.current = 0;
          usePlayerStore.setState({ isPlaying: true });
        }}
        onPause={(e) => {
          // Ignore phantom pause events caused by the browser aborting playback when the audio source is changed.
          // readyState >= 2 means the media is loaded and playable, so it's a genuine pause.
          if (e.currentTarget.readyState >= 2) {
            usePlayerStore.setState({ isPlaying: false });
          }
        }}
        onError={async () => {
          const now = Date.now();
          if (now - lastErrorTime.current > 5000) skipErrorCount.current = 0;
          lastErrorTime.current = now;
          skipErrorCount.current++;

          if (skipErrorCount.current >= 3) {
            console.warn('Too many consecutive audio errors. Stopping.');
            usePlayerStore.setState({ isPlaying: false });
            skipErrorCount.current = 0;
            return;
          }

          // Self-healing: try to re-fetch a fresh URL from JioSaavn
          const track = usePlayerStore.getState().currentTrack;
          if (track) {
            console.warn(`Broken URL for "${track.title}". Re-fetching from JioSaavn...`);
            try {
              const results = await searchSongs(`${track.title} ${track.artist}`, 5);
              const fresh = results.find(t => t.url.includes('saavncdn.com'));
              if (fresh && audioRef.current) {
                // Patch the track with the fresh URL and play it
                const updatedTrack = { ...track, url: fresh.url, artwork: fresh.artwork || track.artwork };
                usePlayerStore.setState({ currentTrack: updatedTrack, isPlaying: true, position: 0 });
                
                // Also patch it in the queue so it doesn't break again
                const state = usePlayerStore.getState();
                const updatedQueue = [...state.currentQueue];
                if (state.currentQueueIndex >= 0 && state.currentQueueIndex < updatedQueue.length) {
                  updatedQueue[state.currentQueueIndex] = updatedTrack;
                  usePlayerStore.setState({ currentQueue: updatedQueue });
                }
                audioRef.current.src = fresh.url;
                audioRef.current.load();
                audioRef.current.play().catch(() => {});
                console.log(`✅ Self-healed "${track.title}"`);
                return;
              }
            } catch (e) {
              console.warn(`Self-heal failed for "${track.title}"`, e);
            }
          }

          // If self-heal failed, skip to next
          console.warn(`Skipping "${track?.title}" (attempt ${skipErrorCount.current}/3)`);
          handleTrackEnded();
        }}
      />
      {/* Hidden YouTube Player */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
        {currentTrack?.url?.startsWith('youtube:') && (
          <YouTube 
            videoId={currentTrack.url.replace('youtube:', '')}
            opts={YOUTUBE_OPTS}
            onReady={handleYtReady}
            onStateChange={handleYtStateChange}
            onError={(e) => {
              console.warn("YouTube player error. Skipping track...", e);
              handleTrackEnded();
            }}
          />
        )}
      </div>

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
            
            <div className="eq-container glass">
              <button 
                className={`eq-btn ${eqMode === 'flat' ? 'active' : ''}`}
                onClick={() => setEqMode('flat')}
              >
                <span className="eq-btn-dot"></span>
                Flat
              </button>
              <button 
                className={`eq-btn ${eqMode === 'bass' ? 'active' : ''}`}
                onClick={() => setEqMode('bass')}
              >
                <span className="eq-btn-dot"></span>
                Bass
              </button>
              <button 
                className={`eq-btn ${eqMode === 'reverb' ? 'active' : ''}`}
                onClick={() => setEqMode('reverb')}
              >
                <span className="eq-btn-dot"></span>
                Reverb
              </button>
              <button 
                className={`eq-btn ${eqMode === 'hall' ? 'active' : ''}`}
                onClick={() => setEqMode('hall')}
              >
                <span className="eq-btn-dot"></span>
                Hall
              </button>
            </div>
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
                style={{ width: `${duration > 0 ? Math.min((position / duration) * 100, 100) : 0}%` }}
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
