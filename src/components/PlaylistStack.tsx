import React from 'react';
import { usePlayerStore } from '../stores/usePlayerStore';
import type { CustomPlaylist } from '../stores/usePlayerStore';
import './PlaylistStack.css';
import { X, Play } from 'lucide-react';

const colors = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#34495e'
];

const PlaylistStack: React.FC = () => {
  const { customPlaylists, setTrack, setIsPlaylistViewOpen: closeView } = usePlayerStore();
  const [selectedPlaylist, setSelectedPlaylist] = React.useState<CustomPlaylist | null>(null);
  const [playingTrackId, setPlayingTrackId] = React.useState<string | null>(null);

  const handleSelectPlaylist = (playlist: CustomPlaylist) => {
    setSelectedPlaylist(playlist);
  };

  const handlePlayTrack = (track: any) => {
    setPlayingTrackId(track.id);
    setTrack(track);
    closeView(false);
  };

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
            {selectedPlaylist.coverUrl ? (
              <img src={selectedPlaylist.coverUrl} alt="" className="detail-cover" />
            ) : (
              <div className="detail-cover-placeholder"></div>
            )}
            <div className="detail-info">
              <h2>{selectedPlaylist.name}</h2>
              <p>{selectedPlaylist.tracks.length} tracks</p>
            </div>
          </div>
          <div className="track-list">
            {selectedPlaylist.tracks.map((t, i) => (
              <div key={t.id + i} className="track-item glass" onClick={() => handlePlayTrack(t)}>
                <img src={t.artwork} alt="" className="track-thumb" />
                <div className="track-info-list">
                  <div className="track-name">{t.title}</div>
                  <div className="track-artists">{t.artist}</div>
                </div>
                {playingTrackId === t.id ? (
                  <div className="spinner small-spinner"></div>
                ) : (
                  <Play size={20} className="track-play-icon" />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="perspective-container">
          <div className="stack-wrapper">
            {customPlaylists.map((playlist, index) => {
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
                    {playlist.coverUrl ? (
                      <img src={playlist.coverUrl} alt={playlist.name} />
                    ) : (
                      <div className="card-face-placeholder">{playlist.name}</div>
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
