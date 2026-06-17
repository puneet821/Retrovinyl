let cachedToken = null;

async function getAnonymousToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  
  try {
    const ctRes = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      }
    });
    const ctData = await ctRes.json().catch(() => null);
    if (ctData && ctData.clientId && !ctData.isAnonymous) {
       const token = ctData.accessToken;
       cachedToken = { token, expiresAt: Date.now() + 3500000 };
       return token;
    }
  } catch(e) {}

  try {
    const res = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player');
    const data = await res.json().catch(() => null);
    if (data?.accessToken) {
      cachedToken = { token: data.accessToken, expiresAt: data.accessTokenExpirationTimestampMs || (Date.now() + 3500000) };
      return cachedToken.token;
    }
  } catch (e) {}

  throw new Error('Could not get Spotify access token');
}

async function scrapePlaylist(playlistId) {
  const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`Embed page returned ${res.status}`);

  const html = await res.text();

  const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    const nextData = JSON.parse(nextDataMatch[1]);
    const entity = nextData?.props?.pageProps?.state?.data?.entity;
    if (entity) {
      const tracks = (entity.trackList || []).map((t) => ({
        name: t.title || t.name || 'Unknown',
        artist: t.subtitle || t.artists?.[0]?.name || 'Unknown',
        artwork: t.images?.[0]?.url || '',
      }));
      return { name: entity.name || 'Imported Playlist', tracks };
    }
  }

  const resourceMatch = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g);
  if (resourceMatch) {
    for (const scriptTag of resourceMatch) {
      const jsonContent = scriptTag.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
      try {
        const data = JSON.parse(jsonContent);
        const items = data?.props?.pageProps?.state?.data?.entity?.trackList || data?.entities?.items;
        if (items && Array.isArray(items)) {
          const tracks = items.map((t) => ({
            name: t.title || t.name || 'Unknown',
            artist: t.subtitle || t.artists?.[0]?.name || 'Unknown',
            artwork: '',
          }));
          return { name: data?.props?.pageProps?.state?.data?.entity?.name || 'Imported Playlist', tracks };
        }
      } catch { /* skip */ }
    }
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/);
  const name = titleMatch ? titleMatch[1].replace(/ \| Spotify.*/, '').replace(/ - playlist by.*/, '') : 'Imported Playlist';

  if (descMatch) {
    const desc = descMatch[1];
    const trackStrings = desc.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    const tracks = trackStrings
      .filter(s => s.includes('·') || s.includes('-'))
      .map(s => {
        const parts = s.split(/[·\-]/);
        return { name: parts[0]?.trim() || s, artist: parts[1]?.trim() || 'Unknown', artwork: '' };
      });
    if (tracks.length > 0) return { name, tracks };
  }

  throw new Error('Could not parse playlist data from Spotify');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const playlistId = req.query.id;
  if (!playlistId) {
    return res.status(400).json({ error: 'Missing playlist ID' });
  }

  try {
    let result = null;
    try {
      const token = await getAnonymousToken();
      const playlistRes = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,images,tracks(total,next,items(track(name,artists(name),album(images))))`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (playlistRes.ok) {
        const playlist = await playlistRes.json();
        if (playlist?.tracks?.items) {
          const allItems = [...playlist.tracks.items];
          let nextPageUrl = playlist.tracks?.next;
          
          while (nextPageUrl) {
            const pageRes = await fetch(nextPageUrl, { headers: { Authorization: `Bearer ${token}` } });
            if (!pageRes.ok) break;
            const page = await pageRes.json();
            if (!page?.items) break;
            allItems.push(...page.items);
            nextPageUrl = page.next;
          }

          const tracks = allItems
            .filter((item) => item?.track)
            .map((item) => ({
              name: item.track.name,
              artist: item.track.artists?.[0]?.name || 'Unknown',
              artwork: item.track.album?.images?.[0]?.url || '',
            }));

          result = {
            name: playlist.name || 'Imported Playlist',
            image: playlist.images?.[0]?.url || '',
            total: playlist.tracks?.total || tracks.length,
            tracks,
          };
        }
      } else if (playlistRes.status === 401) {
        cachedToken = null;
      }
    } catch (e) {
      console.log('API approach failed, trying scrape fallback...', e.message);
    }

    if (!result || !result.tracks.length) {
      console.log('Falling back to embed page scraping...');
      const scraped = await scrapePlaylist(playlistId);
      result = { name: scraped.name, image: '', total: scraped.tracks.length, tracks: scraped.tracks };
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Spotify proxy error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch playlist' });
  }
}
