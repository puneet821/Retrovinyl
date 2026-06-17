import CryptoJS from 'crypto-js';

const DECRYPT_KEY = '38346591';

function decryptUrl(encryptedUrl) {
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
    return url.replace(/_96\./, '_320.');
  } catch (e) {
    console.warn('CryptoJS Decryption failed:', e);
    return '';
  }
}

export default async function handler(req, res) {
  // Add CORS headers for Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  try {
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
      return res.status(200).json([]);
    }

    const tracks = songs.map((s) => {
      const encUrl = s.more_info?.encrypted_media_url || s.encrypted_media_url || '';
      const decryptedUrl = encUrl ? decryptUrl(encUrl) : '';
      const image = s.image?.replace('-150x150', '-500x500').replace('-50x50', '-500x500') || '';

      let artistName = 'Unknown Artist';
      if (s.more_info?.artistMap?.primary_artists?.length > 0) {
        artistName = s.more_info.artistMap.primary_artists.map(a => a.name).join(', ');
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
    }).filter(t => t.url && t.url.includes('saavncdn.com'));

    return res.status(200).json(tracks);
  } catch (err) {
    console.error('Saavn search proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
