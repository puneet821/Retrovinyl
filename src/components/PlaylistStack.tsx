import React from 'react';
import { usePlayerStore } from '../stores/usePlayerStore';
import { fetchPlaylistTracks } from '../services/spotifyApi';
import { initiateSpotifyLogin } from '../services/spotifyAuth';
import './PlaylistStack.css';
import { X, Play } from 'lucide-react';

const colors = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#34495e'
];

const PlaylistStack: React.FC = () => {
  const { playlists, spotifyToken, setTrack, setIsPlaylistViewOpen: closeView } = usePlayerStore();
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const handlePlayPlaylist = async (playlistId: string) => {
    if (!spotifyToken) return;
    setLoadingId(playlistId);
    try {
      const tracks = await fetchPlaylistTracks(spotifyToken, playlistId);
      if (tracks.length > 0) {
        const firstTrack = tracks[0].track;
        setTrack({
          id: firstTrack.id,
          title: firstTrack.name,
          artist: firstTrack.artists.map((a: any) => a.name).join(', '),
          artwork: firstTrack.album.images[0]?.url || '',
          url: firstTrack.preview_url || '', // We might need Saavn fallback here later if no preview
        });
        closeView(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
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
                onClick={() => handlePlayPlaylist(playlist.id)}
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
    </div>
  );
};

export default PlaylistStack;
