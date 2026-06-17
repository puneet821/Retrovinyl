import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Server-side Spotify proxy — fetches playlist data with zero config.
// Multiple fallback strategies to ensure reliability.
function spotifyProxy(): Plugin {
  let cachedToken: { token: string; expiresAt: number } | null = null;
  let sessionCookies = '';

  // Try to read response as JSON safely
  async function safeJson(response: Response): Promise<any> {
    const text = await response.text();
    if (!text || !text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async function getAnonymousToken(): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
      return cachedToken.token;
    }

    // Step 1: Visit spotify.com to establish session cookies
    try {
      const homeRes = await fetch('https://open.spotify.com/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      });
      // Collect cookies from response
      const setCookies = homeRes.headers.getSetCookie?.() || [];
      if (setCookies.length > 0) {
        sessionCookies = setCookies.map(c => c.split(';')[0]).join('; ');
      }

      // Try to extract access token from the page HTML
      const html = await homeRes.text();
      const tokenMatch = html.match(/"accessToken"\s*:\s*"([^"]+)"/);
      if (tokenMatch) {
        cachedToken = { token: tokenMatch[1], expiresAt: Date.now() + 3500000 };
        return cachedToken.token;
      }
    } catch (e) {
      console.log('Home page token extraction failed:', e);
    }

    // Step 2: Try the get_access_token endpoint with cookies
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      };
      if (sessionCookies) headers['Cookie'] = sessionCookies;

      const res = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web-player', {
        headers,
      });
      const data = await safeJson(res);
      if (data?.accessToken) {
        cachedToken = {
          token: data.accessToken,
          expiresAt: data.accessTokenExpirationTimestampMs
            ? data.accessTokenExpirationTimestampMs - 60000
            : Date.now() + 3500000,
        };
        return cachedToken.token;
      }
    } catch (e) {
      console.log('get_access_token failed:', e);
    }

    // Step 3: Try client token endpoint
    try {
      const ctRes = await fetch('https://clienttoken.spotify.com/v1/clienttoken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          client_data: {
            client_version: '1.2.52.442.g4caaca6e',
            client_id: 'd8a5ed958d274c2e8ee717e6a4b0971d',
            js_sdk_data: { device_brand: 'unknown', device_model: 'unknown', os: 'windows', os_version: 'NT 10.0' },
          },
        }),
      });
      const ctData = await safeJson(ctRes);
      if (ctData?.granted_token?.token) {
        cachedToken = { token: ctData.granted_token.token, expiresAt: Date.now() + 3500000 };
        return cachedToken.token;
      }
    } catch (e) {
      console.log('clienttoken failed:', e);
    }

    throw new Error('Could not get Spotify access');
  }

  // Fallback: scrape the Spotify embed page for track data (no token needed)
  async function scrapePlaylist(playlistId: string) {
    const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) throw new Error(`Embed page returned ${res.status}`);

    const html = await res.text();

    // Try to find __NEXT_DATA__ or similar embedded JSON
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      const nextData = JSON.parse(nextDataMatch[1]);
      const entity = nextData?.props?.pageProps?.state?.data?.entity;
      if (entity) {
        const tracks = (entity.trackList || []).map((t: any) => ({
          name: t.title || t.name || 'Unknown',
          artist: t.subtitle || t.artists?.[0]?.name || 'Unknown',
          artwork: t.images?.[0]?.url || '',
        }));
        return { name: entity.name || 'Imported Playlist', tracks };
      }
    }

    // Fallback: parse any JSON resource data in the page
    const resourceMatch = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g);
    if (resourceMatch) {
      for (const scriptTag of resourceMatch) {
        const jsonContent = scriptTag.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        try {
          const data = JSON.parse(jsonContent);
          // Navigate through possible data structures
          const items = data?.props?.pageProps?.state?.data?.entity?.trackList
            || data?.entities?.items;
          if (items && Array.isArray(items)) {
            const tracks = items.map((t: any) => ({
              name: t.title || t.name || 'Unknown',
              artist: t.subtitle || t.artists?.[0]?.name || 'Unknown',
              artwork: '',
            }));
            return { name: data?.props?.pageProps?.state?.data?.entity?.name || 'Imported Playlist', tracks };
          }
        } catch { /* skip invalid JSON */ }
      }
    }

    // Last resort: extract from meta tags
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/);
    const name = titleMatch ? titleMatch[1].replace(/ \| Spotify.*/, '').replace(/ - playlist by.*/, '') : 'Imported Playlist';

    if (descMatch) {
      // Description often contains track listing like "Song1 · Artist1, Song2 · Artist2"
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

  return {
    name: 'spotify-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/spotify-playlist')) return next();

        const url = new URL(req.url, 'http://localhost');
        const playlistId = url.searchParams.get('id');

        if (!playlistId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing playlist ID' }));
          return;
        }

        try {
          // Strategy 1: Try the Spotify Web API with an anonymous token
          let result = null;
          try {
            const token = await getAnonymousToken();
            const playlistRes = await fetch(
              `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,images,tracks(total,next,items(track(name,artists(name),album(images))))`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (playlistRes.ok) {
              const playlist = await safeJson(playlistRes);
              if (playlist?.tracks?.items) {
                const allItems = [...playlist.tracks.items];

                let nextPageUrl = playlist.tracks?.next;
                while (nextPageUrl) {
                  const pageRes = await fetch(nextPageUrl, { headers: { Authorization: `Bearer ${token}` } });
                  if (!pageRes.ok) break;
                  const page = await safeJson(pageRes);
                  if (!page?.items) break;
                  allItems.push(...page.items);
                  nextPageUrl = page.next;
                }

                const tracks = allItems
                  .filter((item: any) => item?.track)
                  .map((item: any) => ({
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
            console.log('API approach failed, trying scrape fallback...', e);
          }

          // Strategy 2: Scrape the embed page
          if (!result || !result.tracks.length) {
            console.log('Falling back to embed page scraping...');
            const scraped = await scrapePlaylist(playlistId);
            result = { name: scraped.name, image: '', total: scraped.tracks.length, tracks: scraped.tracks };
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err: any) {
          console.error('Spotify proxy error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message || 'Failed to fetch playlist. Make sure it\'s a valid public playlist link.' }));
        }
      });
    },
  };
}

import CryptoJS from 'crypto-js';

// Server-side JioSaavn search — talks directly to JioSaavn's API and decrypts media URLs.
// No third-party wrappers, no stale URLs.
function saavnSearchProxy(): Plugin {
  const DECRYPT_KEY = '38346591';

  function decryptUrl(encryptedUrl: string): string {
    try {
      const key = CryptoJS.enc.Utf8.parse(DECRYPT_KEY);
      const decrypted = CryptoJS.DES.decrypt({
        ciphertext: CryptoJS.enc.Base64.parse(encryptedUrl)
      }, key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      });
      const url = decrypted.toString(CryptoJS.enc.Utf8);
      if (!url) return '';
      // Replace _96. with _320. for higher quality, or _160. for balanced
      return url.replace(/_96\./, '_320.');
    } catch (e) {
      console.warn('CryptoJS Decryption failed:', e);
      return '';
    }
  }

  return {
    name: 'saavn-search-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/saavn-search')) return next();

        const url = new URL(req.url, 'http://localhost');
        const query = url.searchParams.get('query');
        if (!query) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing query parameter' }));
          return;
        }

        try {
          // Step 1: Search for songs using JioSaavn's autocomplete/search API
          const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=0&ctx=web6dot0&api_version=4&q=${encodeURIComponent(query)}&p=1&n=5`;
          const searchRes = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
            },
          });
          const searchData = await searchRes.json();
          const songs = searchData?.results || [];

          if (!songs.length) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([]));
            return;
          }

          // Step 2: For each result, decrypt the encrypted_media_url
          const tracks = songs.map((s: any) => {
            const encUrl = s.more_info?.encrypted_media_url || s.encrypted_media_url || '';
            const decryptedUrl = encUrl ? decryptUrl(encUrl) : '';
            const image = s.image?.replace('-150x150', '-500x500').replace('-50x50', '-500x500') || '';

            // Extract primary artists names safely
            let artistName = 'Unknown Artist';
            if (s.more_info?.artistMap?.primary_artists?.length > 0) {
              artistName = s.more_info.artistMap.primary_artists.map((a: any) => a.name).join(', ');
            } else if (s.more_info?.primary_artists) {
              artistName = s.more_info.primary_artists;
            } else if (s.subtitle) {
              artistName = s.subtitle;
            }

            return {
              id: s.id || '',
              title: s.title || s.song || 'Unknown',
              artist: artistName,
              artwork: image,
              url: decryptedUrl,
            };
          }).filter((t: any) => t.url && t.url.includes('saavncdn.com'));

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(tracks));
        } catch (err: any) {
          console.error('Saavn search proxy error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    spotifyProxy(),
    saavnSearchProxy(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'vinyl_splatter.png'],
      manifest: {
        name: 'Retro Web App',
        short_name: 'Retro',
        description: 'Retro Web Application',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'vinyl_splatter.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'vinyl_splatter.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  server: {
    host: true,
    allowedHosts: true,
    cors: true
  }
})

