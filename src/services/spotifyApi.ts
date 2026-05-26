// spotifyApi.ts
// Functions to interact with the Spotify Web API

export interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string; height: number; width: number }[];
  owner: { display_name: string };
  tracks: { total: number };
}

export const fetchUserPlaylists = async (token: string): Promise<SpotifyPlaylist[]> => {
  try {
    const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired
        localStorage.removeItem('spotify_access_token');
        throw new Error('Spotify session expired. Please log in again.');
      }
      throw new Error('Failed to fetch playlists');
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching Spotify playlists:', error);
    throw error;
  }
};

export const fetchPlaylistTracks = async (token: string, playlistId: string): Promise<any[]> => {
  try {
    const response = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=50`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Spotify session expired.');
      }
      let errorMsg = 'Failed to fetch playlist tracks';
      try {
        const errData = await response.json();
        if (errData.error?.message) {
          errorMsg = `Spotify Error: ${errData.error.message}`;
        }
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching playlist tracks:', error);
    throw error;
  }
};
