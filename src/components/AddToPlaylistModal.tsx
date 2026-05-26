import React from 'react';
import { usePlayerStore } from '../stores/usePlayerStore';
import type { Track } from '../stores/usePlayerStore';
import { X, Plus, Music } from 'lucide-react';
import './AddToPlaylistModal.css';

interface Props {
  track: Track;
  onClose: () => void;
}

const AddToPlaylistModal: React.FC<Props> = ({ track, onClose }) => {
  const { customPlaylists, addTrackToCustomPlaylist } = usePlayerStore();

  const handleAdd = (playlistId: string) => {
    addTrackToCustomPlaylist(playlistId, track);
    onClose();
  };

  return (
    <div className="add-modal-overlay" onClick={onClose}>
      <div className="add-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="add-modal-header">
          <h3>Add to Playlist</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="add-modal-track-preview">
          <img src={track.artwork} alt={track.title} />
          <div>
            <h4>{track.title}</h4>
            <p>{track.artist}</p>
          </div>
        </div>

        <div className="add-modal-list">
          {customPlaylists.length === 0 ? (
            <div className="add-modal-empty">
              <p>No custom playlists available.</p>
              <p className="small-text">Open the left menu to create one.</p>
            </div>
          ) : (
            customPlaylists.map(playlist => {
              const hasTrack = playlist.tracks.some(t => t.id === track.id);
              return (
                <button 
                  key={playlist.id} 
                  className={`add-playlist-btn glass ${hasTrack ? 'added' : ''}`}
                  onClick={() => !hasTrack && handleAdd(playlist.id)}
                  disabled={hasTrack}
                >
                  <Music size={16} />
                  <span>{playlist.name}</span>
                  {hasTrack ? <span className="status-text">Added</span> : <Plus size={16} />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default AddToPlaylistModal;
