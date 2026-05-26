import React, { useState } from 'react';
import { usePlayerStore } from '../stores/usePlayerStore';
import { X, Plus, Music, Trash2 } from 'lucide-react';
import './HamburgerMenu.css';

interface HamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ isOpen, onClose }) => {
  const { customPlaylists, createCustomPlaylist, deleteCustomPlaylist } = usePlayerStore();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlaylistName.trim()) {
      createCustomPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setIsCreating(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="hamburger-backdrop" onClick={onClose} />}
      
      {/* Sidebar */}
      <div className={`hamburger-sidebar glass-panel ${isOpen ? 'open' : ''}`}>
        <div className="hamburger-header">
          <h2>My Library</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="hamburger-content">
          <div className="create-playlist-section">
            {!isCreating ? (
              <button 
                className="create-btn glass" 
                onClick={() => setIsCreating(true)}
              >
                <Plus size={20} />
                <span>New Playlist</span>
              </button>
            ) : (
              <form onSubmit={handleCreate} className="create-form">
                <input
                  type="text"
                  placeholder="Playlist name..."
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  autoFocus
                  className="glass-input"
                />
                <div className="form-actions">
                  <button type="button" onClick={() => setIsCreating(false)} className="cancel-btn">Cancel</button>
                  <button type="submit" className="save-btn" disabled={!newPlaylistName.trim()}>Save</button>
                </div>
              </form>
            )}
          </div>

          <div className="playlists-list">
            <h3>Your Playlists</h3>
            {customPlaylists.length === 0 ? (
              <div className="empty-state">
                <Music size={32} opacity={0.5} />
                <p>No playlists yet</p>
              </div>
            ) : (
              <ul>
                {customPlaylists.map(playlist => (
                  <li key={playlist.id} className="playlist-list-item glass">
                    <div className="playlist-list-info">
                      <span className="playlist-list-name">{playlist.name}</span>
                      <span className="playlist-list-count">{playlist.tracks.length} tracks</span>
                    </div>
                    <button 
                      className="delete-playlist-btn"
                      onClick={() => {
                        if (confirm(`Delete "${playlist.name}"?`)) {
                          deleteCustomPlaylist(playlist.id);
                        }
                      }}
                      title="Delete Playlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default HamburgerMenu;
