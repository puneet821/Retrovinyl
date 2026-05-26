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

interface PlayerState {
  spotifyToken: string | null;
  playlists: SpotifyPlaylist[];
  isPlaylistViewOpen: boolean;
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  setSpotifyToken: (token: string | null) => void;
  setPlaylists: (playlists: SpotifyPlaylist[]) => void;
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
}

export const usePlayerStore = create<PlayerState>((set) => ({
  spotifyToken: localStorage.getItem('spotify_access_token') || null,
  playlists: [],
  isPlaylistViewOpen: false,
  currentTrack: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  isSeeking: false,
  requestedSeekTime: null,
  
  setSpotifyToken: (token) => set({ spotifyToken: token }),
  setPlaylists: (playlists) => set({ playlists }),
  setIsPlaylistViewOpen: (isPlaylistViewOpen) => set({ isPlaylistViewOpen }),
  setIsSeeking: (isSeeking) => set({ isSeeking }),
  requestSeek: (time) => set({ requestedSeekTime: time }),
  
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  setTrack: (track) => set({ currentTrack: track, isPlaying: true, position: 0 }),
  setPosition: (position) => set({ position }),
  setDuration: (duration) => set({ duration }),
  
  skipForward: () => set((state) => ({ requestedSeekTime: Math.min(state.position + 10, state.duration) })),
  skipBackward: () => set((state) => ({ requestedSeekTime: Math.max(state.position - 10, 0) })),
}));
