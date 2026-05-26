import { create } from 'zustand';
import type { SpotifyPlaylist } from '../services/spotifyApi';

export interface Track {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  url: string; // The audio source
  uri?: string; // Spotify URI
}

export interface CustomPlaylist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
  coverUrl?: string;
}

interface PlayerState {
  spotifyToken: string | null;
  playlists: SpotifyPlaylist[];
  customPlaylists: CustomPlaylist[];
  isPlaylistViewOpen: boolean;
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  setSpotifyToken: (token: string | null) => void;
  setPlaylists: (playlists: SpotifyPlaylist[]) => void;
  
  // Custom Playlist Actions
  createCustomPlaylist: (name: string) => void;
  addTrackToCustomPlaylist: (playlistId: string, track: Track) => void;
  removeTrackFromCustomPlaylist: (playlistId: string, trackId: string) => void;
  deleteCustomPlaylist: (playlistId: string) => void;
  
  setIsPlaylistViewOpen: (isOpen: boolean) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setTrack: (track: Track) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  skipForward: () => void;
  skipBackward: () => void;
  isSeeking: boolean;
  setIsSeeking: (isSeeking: boolean) => void;
  requestedSeekTime: number | null;
  requestSeek: (time: number | null) => void;
  
  // Queue Management
  currentQueue: Track[];
  currentQueueIndex: number;
  setQueue: (tracks: Track[], startIndex: number) => void;
  playNext: () => void;
  playPrevious: () => void;
}

const loadCustomPlaylists = (): CustomPlaylist[] => {
  try {
    const saved = localStorage.getItem('retro_custom_playlists');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveCustomPlaylists = (playlists: CustomPlaylist[]) => {
  localStorage.setItem('retro_custom_playlists', JSON.stringify(playlists));
};

export const usePlayerStore = create<PlayerState>((set) => ({
  spotifyToken: localStorage.getItem('spotify_access_token') || null,
  playlists: [],
  customPlaylists: loadCustomPlaylists(),
  isPlaylistViewOpen: false,
  currentTrack: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  isSeeking: false,
  requestedSeekTime: null,
  
  setSpotifyToken: (token) => set({ spotifyToken: token }),
  setPlaylists: (playlists) => set({ playlists }),
  
  createCustomPlaylist: (name) => set((state) => {
    const newPlaylist: CustomPlaylist = {
      id: Date.now().toString(),
      name,
      tracks: [],
      createdAt: Date.now(),
    };
    const updated = [...state.customPlaylists, newPlaylist];
    saveCustomPlaylists(updated);
    return { customPlaylists: updated };
  }),
  
  addTrackToCustomPlaylist: (playlistId, track) => set((state) => {
    const updated = state.customPlaylists.map(p => {
      if (p.id === playlistId) {
        // Prevent duplicate tracks in the same playlist
        if (p.tracks.some(t => t.id === track.id)) return p;
        const newTracks = [...p.tracks, track];
        return {
          ...p,
          tracks: newTracks,
          coverUrl: newTracks[0]?.artwork || p.coverUrl
        };
      }
      return p;
    });
    saveCustomPlaylists(updated);
    return { customPlaylists: updated };
  }),
  
  removeTrackFromCustomPlaylist: (playlistId, trackId) => set((state) => {
    const updated = state.customPlaylists.map(p => {
      if (p.id === playlistId) {
        const newTracks = p.tracks.filter(t => t.id !== trackId);
        return { ...p, tracks: newTracks, coverUrl: newTracks[0]?.artwork };
      }
      return p;
    });
    saveCustomPlaylists(updated);
    return { customPlaylists: updated };
  }),
  
  deleteCustomPlaylist: (playlistId) => set((state) => {
    const updated = state.customPlaylists.filter(p => p.id !== playlistId);
    saveCustomPlaylists(updated);
    return { customPlaylists: updated };
  }),

  setIsPlaylistViewOpen: (isPlaylistViewOpen) => set({ isPlaylistViewOpen }),
  setIsSeeking: (isSeeking) => set({ isSeeking }),
  requestSeek: (time) => set({ requestedSeekTime: time }),
  
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  currentQueue: [],
  currentQueueIndex: -1,
  
  setQueue: (tracks, startIndex) => set({ 
    currentQueue: tracks, 
    currentQueueIndex: startIndex,
    currentTrack: tracks[startIndex] || null,
    isPlaying: !!tracks[startIndex],
    position: 0
  }),
  
  playNext: () => set((state) => {
    if (state.currentQueue.length > 0 && state.currentQueueIndex < state.currentQueue.length - 1) {
      const nextIndex = state.currentQueueIndex + 1;
      return {
        currentQueueIndex: nextIndex,
        currentTrack: state.currentQueue[nextIndex],
        isPlaying: true,
        position: 0
      };
    }
    // If no queue or at end, just pause
    return { isPlaying: false, position: 0 };
  }),
  
  playPrevious: () => set((state) => {
    if (state.currentQueue.length > 0 && state.currentQueueIndex > 0) {
      // If position > 3 seconds, just restart song
      if (state.position > 3) {
        return { position: 0, requestedSeekTime: 0 };
      }
      const prevIndex = state.currentQueueIndex - 1;
      return {
        currentQueueIndex: prevIndex,
        currentTrack: state.currentQueue[prevIndex],
        isPlaying: true,
        position: 0
      };
    }
    return { position: 0, requestedSeekTime: 0 };
  }),
  
  setTrack: (track) => set({ 
    currentTrack: track, 
    isPlaying: true, 
    position: 0,
    // Clear queue when a single track is played directly (e.g., from search)
    currentQueue: [track],
    currentQueueIndex: 0
  }),
  setPosition: (position) => set({ position }),
  setDuration: (duration) => set({ duration }),
  
  skipForward: () => set((state) => ({ requestedSeekTime: Math.min(state.position + 10, state.duration) })),
  skipBackward: () => set((state) => ({ requestedSeekTime: Math.max(state.position - 10, 0) })),
}));
