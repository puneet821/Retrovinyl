import type { Track } from '../stores/usePlayerStore';

export const CUSTOM_SONGS: Track[] = [
  {
    "id": "kaavish-1",
    "title": "Tere Pyaar Main",
    "artist": "Kaavish",
    "artwork": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop",
    "url": "youtube:kfKP4o-bXzM"
  },
  {
    "id": "kaavish-2",
    "title": "Piya Dekho Na",
    "artist": "Kaavish",
    "artwork": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop",
    "url": "youtube:0dqleBxqXHI"
  },
  {
    "id": "kaavish-3",
    "title": "Dekho",
    "artist": "Kaavish",
    "artwork": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop",
    "url": "youtube:VsFjP58j5i8"
  },
  {
    "id": "kaavish-4",
    "title": "Sunn Zaraa",
    "artist": "Kaavish",
    "artwork": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop",
    "url": "youtube:pU5xSm335pE"
  },
  {
    "id": "kaavish-5",
    "title": "Bachpan",
    "artist": "Kaavish",
    "artwork": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop",
    "url": "youtube:-Ot2QrjWCzg"
  },
  {
    "id": "kaavish-6",
    "title": "Koi Hai To Sahee",
    "artist": "Kaavish",
    "artwork": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop",
    "url": "youtube:W9jc_7KjO04"
  },
  {
    "id": "kaavish-7",
    "title": "Chaand Taaray",
    "artist": "Kaavish",
    "artwork": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop",
    "url": "youtube:2fVGYj1dWG8"
  },
  {
    "id": "kaavish-8",
    "title": "Dil Main Meray",
    "artist": "Kaavish",
    "artwork": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop",
    "url": "youtube:eo15zjtbZLo"
  },
  {
    "id": "kaavish-9",
    "title": "Baat Unkahi feat. Samra Khan",
    "artist": "Kaavish",
    "artwork": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop",
    "url": "youtube:rn9aNVsABvc"
  },
  {
    "id": "kaavish-10",
    "title": "Moray Sayyaan",
    "artist": "Kaavish",
    "artwork": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop",
    "url": "youtube:Iy1_0kqytfs"
  },
  {
    "id": "kaavish-11",
    "title": "Chaltay Rahein",
    "artist": "Kaavish",
    "artwork": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop",
    "url": "youtube:YE2Q5T4hap8"
  }
];

export const getBestLink = (urls: any[]) => {
  if (!urls || !urls.length) return null;
  const pref = '160kbps'; // Default quality
  let order = ['320kbps', '160kbps', '96kbps', '48kbps', '12kbps'];
  if (pref === '160kbps') {
      order = ['160kbps', '96kbps', '320kbps', '48kbps', '12kbps'];
  } else if (pref === '96kbps') {
      order = ['96kbps', '48kbps', '160kbps', '320kbps', '12kbps'];
  }
  for (const q of order) {
      const found = urls.find(u => u.quality === q);
      if (found) return found.url || found.link || null;
  }
  const first = urls[0];
  return first?.url || first?.link || null;
};

export const getBestImage = (imgs: any[]) => {
  if (!imgs || !imgs.length) return '';
  const big = imgs.find(i => i.quality === '500x500' || i.quality === '150x150');
  if (big) return big.url || big.link || '';
  const last = imgs[imgs.length - 1];
  return last?.url || last?.link || '';
};

export const formatSongToTrack = (s: any): Track => {
  let finalUrl = '';

  // Only accept URLs that are actual audio CDN links, NOT webpage URLs
  const isAudioUrl = (u: any): u is string =>
    typeof u === 'string' && u.startsWith('http') && u.includes('saavncdn.com');

  // Priority 1: downloadUrl array (v2 API — fresh decrypted URLs that actually work)
  const best = getBestLink(s.downloadUrl || []);
  if (isAudioUrl(best)) {
      finalUrl = best;
  }

  // Priority 2: media_url from the legacy API (can be stale/expired, use as fallback)
  if (!finalUrl && isAudioUrl(s.media_url)) {
      finalUrl = s.media_url;
  }

  return {
      id: s.id,
      title: s.song || s.name || s.title || 'Unknown',
      artist: s.singers || s.primaryArtists || s.artist || (s.artists?.primary || []).map((a: any) => a.name).join(', ') || 'Unknown Artist',
      artwork: getBestImage(s.image || []),
      url: finalUrl,
  };
};

// Search JioSaavn for songs — uses our own server-side proxy first (fresh decrypted URLs)
export const searchSongs = async (query: string, limit = 10): Promise<Track[]> => {
  const q = encodeURIComponent(query);
  const normalize = (str: string) => str.toLowerCase().replace(/pyaar/g, 'pyar').replace(/main|mein/g, 'me');
  const normalizedQuery = normalize(query);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  // 1. Search custom songs first
  const customResults = CUSTOM_SONGS.filter((song) => {
    const searchableText = normalize(`${song.title} ${song.artist}`);
    return terms.every(term => searchableText.includes(term));
  });

  // Source 1: Our own server-side proxy (decrypts URLs directly from JioSaavn)
  try {
    const res = await fetch(`/api/saavn-search?query=${encodeURIComponent(q)}`);
    if (res.ok) {
      const tracks: Track[] = await res.json();
      if (tracks.length > 0) return [...customResults, ...tracks];
    }
  } catch (e) {
    console.warn('Local proxy failed, trying external APIs...', e);
  }

  // Helper to fetch from external APIs as fallback
  const fetchSource = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let raw = [];
    if (Array.isArray(data)) raw = data;
    else if (data.status === 'SUCCESS' && data.data?.results) raw = data.data.results;
    else if (Array.isArray(data.results)) raw = data.results;
    else throw new Error('Invalid format');

    const tracks = raw.map(formatSongToTrack).filter((t: Track) => t.url);
    if (!tracks.length) throw new Error('No valid playable tracks found');
    return tracks;
  };

  // Source 2: External v2 API (downloadUrl with decrypted links)
  try {
    const tracks = await fetchSource(`https://jiosaavn-api-2.vercel.app/search/songs?query=${q}&limit=${limit}`);
    return [...customResults, ...tracks];
  } catch (e) {
    console.warn('External v2 API failed', e);
  }

  // Source 3: Legacy API (media_url — often stale but last resort)
  try {
    const tracks = await fetchSource(`https://saavnapi-nine.vercel.app/result/?query=${q}`);
    return [...customResults, ...tracks];
  } catch (e) {
    console.warn('Legacy API also failed', e);
  }

  if (customResults.length > 0) return customResults;
  throw new Error('All search sources failed');
};

// Match a Spotify track to a JioSaavn audio stream
export const playSpotifyTrackViaSaavn = async (spotifyTrackTitle: string, spotifyArtistName: string, spotifyArtwork: string): Promise<Track> => {
  // Try with full "Song Artist" query first
  const queries = [
    `${spotifyTrackTitle} ${spotifyArtistName}`,
    spotifyTrackTitle, // Fallback: just the song name
  ];

  for (const query of queries) {
    try {
      const results = await searchSongs(query, 5);
      // Find a result that has a valid audio URL
      const playable = results.find(t => t.url.includes('saavncdn.com'));
      if (playable) {
        return {
          ...playable,
          id: `hybrid-${playable.id}`,
          title: spotifyTrackTitle,
          artist: spotifyArtistName,
          artwork: playable.artwork || spotifyArtwork,
        };
      }
    } catch (e) {
      console.warn(`Search failed for: ${query}`, e);
    }
  }

  throw new Error(`Could not find playable audio for: ${spotifyTrackTitle}`);
};

// Smart AutoPlay: Get a related track based on the artist
export const getAutoPlayRecommendation = async (seedArtist: string, excludeIds: string[]): Promise<Track | null> => {
  const trySearch = async (query: string) => {
    try {
      const results = await searchSongs(query, 20);
      const unplayed = results.filter(t => !excludeIds.includes(t.id));
      if (unplayed.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(5, unplayed.length));
        return unplayed[randomIndex];
      }
    } catch (e) {
      console.warn(`Autoplay search for ${query} failed`, e);
    }
    return null;
  };

  // Attempt 1: The exact artist
  let recommendation = await trySearch(seedArtist);
  if (recommendation) return recommendation;

  // Attempt 2: Fallback to some generic vibe keywords if artist yielded nothing new
  const fallbacks = ['lofi', 'synthwave', 'chill', 'pop', 'trending'];
  const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
  recommendation = await trySearch(randomFallback);
  
  return recommendation; // Even if null, we tried our best
};
