import React from 'react';
import { usePlayerStore } from '../stores/usePlayerStore';
import { fetchPlaylistTracks } from '../services/spotifyApi';
import type { SpotifyPlaylist } from '../services/spotifyApi';
import { initiateSpotifyLogin } from '../services/spotifyAuth';
import { playSpotifyTrackViaSaavn } from '../services/api';
import './PlaylistStack.css';
import { X, Play } from 'lucide-react';

const colors = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#34495e'
];

const PlaylistStack: React.FC = () => {
  const { playlists, spotifyToken, setTrack, setIsPlaylistViewOpen: closeView } = usePlayerStore();
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = React.useState<SpotifyPlaylist | null>(null);
  const [tracks, setTracks] = React.useState<any[]>([]);
  const [playingTrackId, setPlayingTrackId] = React.useState<string | null>(null);

  const handleSelectPlaylist = async (playlist: SpotifyPlaylist) => {
    if (!spotifyToken) return;
    setLoadingId(playlist.id);
    try {
      const fetchedTracks = await fetchPlaylistTracks(spotifyToken, playlist.id);
      setTracks(fetchedTracks);
      setSelectedPlaylist(playlist);
    } catch (err: any) {
      console.error(err);
      const isAuthError = err.message?.includes('expired') || err.message?.includes('401') || err.message?.includes('Forbidden') || err.message?.includes('403');
      if (isAuthError) {
        usePlayerStore.getState().setSpotifyToken(null);
        localStorage.removeItem('spotify_access_token');
        alert("Spotify permissions missing or expired. Please click 'Connect Spotify' again to grant playlist access.");
      } else {
        alert(err.message || "Failed to load tracks. The playlist might be empty or private.");
      }
    } finally {
      setLoadingId(null);
    }
  };

  const handlePlayTrack = async (trackItem: any) => {
    const t = trackItem.track;
    if (!t) return;
    setPlayingTrackId(t.id);
    
    try {
      if (t.preview_url) {
        setTrack({
          id: t.id,
          title: t.name,
          artist: t.artists.map((a: any) => a.name).join(', '),
          artwork: t.album.images[0]?.url || '',
          url: t.preview_url,
        });
        closeView(false);
      } else {
        // Fallback to Saavn search to get full audio
        const artistName = t.artists[0]?.name || '';
        const artwork = t.album.images[0]?.url || '';
        const saavnTrack = await playSpotifyTrackViaSaavn(t.name, artistName, artwork);
        setTrack(saavnTrack);
        closeView(false);
      }
    } catch (err) {
      alert("Could not find audio for this track.");
      console.error(err);
    } finally {
      setPlayingTrackId(null);
    }
  };

  if (!spotifyToken) {
    return (
      <div className="playlist-stack-overlay">
        <div className="playlist-auth-prompt glass-panel">
          <h2>Spotify Login Required</h2>
          <p>Connect your Spotify account to view your playlists in 3D.</p>
          <button className="spotify-login-btn" onClick={initiateSpotifyLogin}>
            Connect Spotify
          </button>
          <button className="close-btn" onClick={() => closeView(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="playlist-stack-overlay">
      <button className="close-stack-btn glass" onClick={() => closeView(false)}>
        <X size={24} />
      </button>
      
      {selectedPlaylist ? (
        <div className="playlist-detail-view">
          <div className="playlist-detail-header glass">
            <button className="back-btn" onClick={() => setSelectedPlaylist(null)}>
              &larr; Back
            </button>
            <img src={selectedPlaylist.images[0]?.url} alt="" className="detail-cover" />
            <div className="detail-info">
              <h2>{selectedPlaylist.name}</h2>
              <p>{selectedPlaylist.tracks.total} tracks</p>
            </div>
          </div>
          <div className="track-list">
            {tracks.map((item, i) => {
              const t = item.track;
              if (!t) return null;
              return (
                <div key={t.id + i} className="track-item glass" onClick={() => handlePlayTrack(item)}>
                  <img src={t.album.images[2]?.url || t.album.images[0]?.url} alt="" className="track-thumb" />
                  <div className="track-info-list">
                    <div className="track-name">{t.name}</div>
                    <div className="track-artists">{t.artists.map((a: any) => a.name).join(', ')}</div>
                  </div>
                  {playingTrackId === t.id ? (
                    <div className="spinner small-spinner"></div>
                  ) : (
                    <Play size={20} className="track-play-icon" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="perspective-container">
          <div className="stack-wrapper">
            {playlists.map((playlist, index) => {
              const edgeColor = colors[index % colors.length];
              return (
                <div 
                  key={playlist.id} 
                  className="playlist-card-3d"
                  style={{ 
                    '--edge-color': edgeColor
                  } as React.CSSProperties}
                  data-title={playlist.name}
                  onClick={() => handleSelectPlaylist(playlist)}
                >
                  <div className="card-face main-face">
                    <img src={playlist.images[0]?.url} alt={playlist.name} />
                    {loadingId === playlist.id && (
                      <div className="loading-overlay">
                        <div className="spinner"></div>
                      </div>
                    )}
                    <div className="play-overlay">
                      <Play size={40} fill="white" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaylistStack;
