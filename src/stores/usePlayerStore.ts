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
  updatePlaylistCover: (playlistId: string, coverUrl: string) => void;
  // Custom Playlist Actions
  createCustomPlaylist: (name: string) => void;
  addTrackToCustomPlaylist: (playlistId: string, track: Track) => void;
  removeTrackFromCustomPlaylist: (playlistId: string, trackId: string) => void;
  deleteCustomPlaylist: (playlistId: string) => void;
  exportPlaylists: () => void;
  importPlaylists: (importedPlaylists: CustomPlaylist[]) => void;
  createCustomPlaylistWithTracks: (name: string, tracks: Track[]) => void;
  
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
  eqMode: 'flat' | 'bass' | 'reverb' | 'hall';
  setEqMode: (mode: 'flat' | 'bass' | 'reverb' | 'hall') => void;
  
  // Queue Management
  currentQueue: Track[];
  currentQueueIndex: number;
  queueOrigin: 'playlist' | 'search' | 'autoplay';
  isAutoPlayLoading: boolean;
  setIsAutoPlayLoading: (loading: boolean) => void;
  setQueue: (tracks: Track[], startIndex: number) => void;
  appendAutoPlayTrack: (track: Track) => void;
  playNext: (audioElement?: HTMLAudioElement) => void;
  playPrevious: (audioElement?: HTMLAudioElement) => void;
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

export const usePlayerStore = create<PlayerState>((set, get) => ({
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
  eqMode: 'flat',
  isAutoPlayLoading: false,
  
  setSpotifyToken: (token) => set({ spotifyToken: token }),
  setPlaylists: (playlists) => set({ playlists }),
  setEqMode: (eqMode) => set({ eqMode }),
  setIsAutoPlayLoading: (loading) => set({ isAutoPlayLoading: loading }),
  
  exportPlaylists: () => {
    const playlists = get().customPlaylists;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(playlists));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "retro_playlists.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  },
  
  importPlaylists: (importedPlaylists) => set((state) => {
    // Optionally merge or overwrite. We will just overwrite/merge by ID.
    // Let's do a simple overwrite for now, or append missing ones.
    const currentIds = new Set(state.customPlaylists.map(p => p.id));
    const newPlaylists = importedPlaylists.filter(p => !currentIds.has(p.id));
    const updated = [...state.customPlaylists, ...newPlaylists];
    saveCustomPlaylists(updated);
    return { customPlaylists: updated };
  }),

  createCustomPlaylistWithTracks: (name, tracks) => set((state) => {
    const newPlaylist: CustomPlaylist = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      name,
      tracks,
      createdAt: Date.now(),
      coverUrl: tracks[0]?.artwork,
    };
    const updated = [...state.customPlaylists, newPlaylist];
    saveCustomPlaylists(updated);
    return { customPlaylists: updated };
  }),

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

  updatePlaylistCover: (playlistId, coverUrl) => set((state) => {
    const updated = state.customPlaylists.map(p => 
      p.id === playlistId ? { ...p, coverUrl } : p
    );
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
  queueOrigin: 'playlist',
  
  setQueue: (tracks, startIndex) => {
    // Sanitize older imported playlists that might have raw 11-character YouTube IDs instead of valid URLs
    const sanitizedTracks = tracks.map(t => {
      if (t.url && /^[a-zA-Z0-9_-]{11}$/.test(t.url)) {
        return { ...t, url: `youtube:${t.url}` };
      }
      return t;
    });

    set({ 
      currentQueue: sanitizedTracks, 
      currentQueueIndex: startIndex,
      currentTrack: sanitizedTracks[startIndex] || null,
      isPlaying: !!sanitizedTracks[startIndex],
      position: 0,
      queueOrigin: 'playlist'
    });
  },
  
  appendAutoPlayTrack: (track) => set((state) => ({
    currentQueue: [...state.currentQueue, track],
    queueOrigin: 'autoplay'
  })),
  
  playNext: (audioElement) => set((state) => {
    if (state.currentQueue.length > 0 && state.currentQueueIndex < state.currentQueue.length - 1) {
      const nextIndex = state.currentQueueIndex + 1;
      const nextTrack = state.currentQueue[nextIndex];
      
      // Synchronous background loading (skip for YouTube videos)
      if (audioElement && !nextTrack.url.startsWith('youtube:')) {
        audioElement.src = nextTrack.url;
        audioElement.load();
        audioElement.play().catch(e => console.warn('Sync playback prevented', e));
      }
      
      return {
        currentQueueIndex: nextIndex,
        currentTrack: nextTrack,
        isPlaying: true,
        position: 0
      };
    }
    return { isPlaying: false, position: 0 };
  }),
  
  playPrevious: (audioElement) => set((state) => {
    if (state.currentQueue.length > 0 && state.currentQueueIndex > 0) {
      if (state.position > 3) {
        if (audioElement) audioElement.currentTime = 0;
        return { position: 0, requestedSeekTime: 0 };
      }
      
      const prevIndex = state.currentQueueIndex - 1;
      const prevTrack = state.currentQueue[prevIndex];
      
      // Synchronous background loading (skip for YouTube videos)
      if (audioElement && !prevTrack.url.startsWith('youtube:')) {
        audioElement.src = prevTrack.url;
        audioElement.load();
        audioElement.play().catch(e => console.warn('Sync playback prevented', e));
      }

      return {
        currentQueueIndex: prevIndex,
        currentTrack: prevTrack,
        isPlaying: true,
        position: 0
      };
    }
    if (audioElement) audioElement.currentTime = 0;
    return { position: 0, requestedSeekTime: 0 };
  }),
  
  setTrack: (track) => set({ 
    currentTrack: track, 
    isPlaying: true, 
    position: 0,
    // Clear queue when a single track is played directly (e.g., from search)
    currentQueue: [track],
    currentQueueIndex: 0,
    queueOrigin: 'search'
  }),
  setPosition: (position) => set({ position }),
  setDuration: (duration) => set({ duration }),
  
  skipForward: () => set((state) => ({ requestedSeekTime: Math.min(state.position + 10, state.duration) })),
  skipBackward: () => set((state) => ({ requestedSeekTime: Math.max(state.position - 10, 0) })),
}));
