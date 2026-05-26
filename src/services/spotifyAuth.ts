// spotifyAuth.ts
// Standard PKCE OAuth flow for Spotify

const CLIENT_ID = '88d6fa9c33824bc3b30378a17fbc4185';
// Dynamically get the current URL (works for both localhost and production deployments)
const REDIRECT_URI = window.location.origin + (window.location.pathname === '/' ? '/' : window.location.pathname); 
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative'
];

export const generateRandomString = (length: number) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
};

const sha256 = async (plain: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
};

const base64encode = (input: ArrayBuffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

export const initiateSpotifyLogin = async () => {
  const codeVerifier = generateRandomString(64);
  window.localStorage.setItem('code_verifier', codeVerifier);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  window.localStorage.setItem('spotify_auth_initiated', 'true');

  const params = {
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: REDIRECT_URI,
    show_dialog: 'true',
  };

  authUrl.search = new URLSearchParams(params).toString();
  window.location.href = authUrl.toString();
};

export const handleSpotifyCallback = async (code: string) => {
  const codeVerifier = localStorage.getItem('code_verifier');
  if (!codeVerifier) return null;

  const payload = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  };

  const body = await fetch("https://accounts.spotify.com/api/token", payload);
  const response = await body.json();

  if (response.access_token) {
    localStorage.setItem('spotify_access_token', response.access_token);
    localStorage.setItem('spotify_refresh_token', response.refresh_token);
    // clean up url
    window.history.replaceState({}, document.title, "/");
    return response.access_token;
  }
  return null;
};
