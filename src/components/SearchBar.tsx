import React, { useState } from 'react';
import { Search, Loader2, X, Plus } from 'lucide-react';
import { searchSongs } from '../services/api';
import { usePlayerStore } from '../stores/usePlayerStore';
import type { Track } from '../stores/usePlayerStore';
import AddToPlaylistModal from './AddToPlaylistModal';
import './SearchBar.css';

const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const [addingTrack, setAddingTrack] = useState<Track | null>(null);

  const setTrack = usePlayerStore((state) => state.setTrack);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError('');
    
    try {
      const tracks = await searchSongs(query, 10);
      setResults(tracks);
      setIsOpen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to search');
    } finally {
      setIsLoading(false);
    }
  };

  const playTrack = (track: Track) => {
    setTrack(track);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="search-container">
      <form onSubmit={handleSearch} className="search-form glass">
        <button type="submit" className="search-btn">
          <Search size={20} />
        </button>
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Saavn..." 
          className="search-input"
        />
        {isLoading && <Loader2 size={20} className="spin-icon" />}
      </form>

      {isOpen && results.length > 0 && (
        <div className="search-results glass-panel">
          <div className="results-header">
            <h3>Results</h3>
            <button onClick={() => setIsOpen(false)} className="close-btn"><X size={20} /></button>
          </div>
          <ul className="results-list">
            {results.map((track) => (
              <li key={track.id} className="result-item">
                <div className="result-main-clickable" onClick={() => playTrack(track)}>
                  <img src={track.artwork} alt={track.title} className="result-artwork" />
                  <div className="result-info">
                    <p className="result-title">{track.title}</p>
                    <p className="result-artist">{track.artist}</p>
                  </div>
                </div>
                <button 
                  className="add-to-playlist-icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddingTrack(track);
                  }}
                  title="Add to Playlist"
                >
                  <Plus size={20} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {error && <div className="search-error">{error}</div>}

      {addingTrack && (
        <AddToPlaylistModal 
          track={addingTrack} 
          onClose={() => setAddingTrack(null)} 
        />
      )}
    </div>
  );
};

export default SearchBar;
