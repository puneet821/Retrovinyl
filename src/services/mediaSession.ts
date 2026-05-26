/**
 * Generates a vinyl record image with album art in the center.
 * Returns a data URL that can be used as Media Session artwork.
 */
export function generateVinylArtwork(albumArtUrl: string, size = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas not supported'));

    const center = size / 2;
    const vinylRadius = size / 2 - 4;
    const artRadius = vinylRadius * 0.38;
    const holeRadius = 6;

    // Draw vinyl disc background (dark)
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(center, center, vinylRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw vinyl grooves
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.8;
    for (let r = artRadius + 12; r < vinylRadius - 8; r += 4) {
      ctx.beginPath();
      ctx.arc(center, center, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Subtle vinyl shine/reflection
    const shineGrad = ctx.createLinearGradient(0, 0, size, size);
    shineGrad.addColorStop(0, 'rgba(255,255,255,0.04)');
    shineGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
    shineGrad.addColorStop(1, 'rgba(255,255,255,0.03)');
    ctx.fillStyle = shineGrad;
    ctx.beginPath();
    ctx.arc(center, center, vinylRadius, 0, Math.PI * 2);
    ctx.fill();

    // Load album art and draw it in the center
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Clip to circle for album art
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, artRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, center - artRadius, center - artRadius, artRadius * 2, artRadius * 2);
      ctx.restore();

      // Draw center hole
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(center, center, holeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Art border ring
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(center, center, artRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Outer edge ring
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(center, center, vinylRadius - 1, 0, Math.PI * 2);
      ctx.stroke();

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      // If album art fails to load, still return the vinyl without art
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(center, center, artRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(center, center, holeRadius, 0, Math.PI * 2);
      ctx.fill();

      resolve(canvas.toDataURL('image/png'));
    };

    img.src = albumArtUrl;
  });
}

/**
 * Updates the Media Session metadata with vinyl artwork
 */
export async function updateMediaSessionWithVinyl(
  title: string,
  artist: string,
  albumArtUrl: string
) {
  if (!('mediaSession' in navigator)) return;

  try {
    const vinylDataUrl = await generateVinylArtwork(albumArtUrl);

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: 'Retro Player',
      artwork: [
        // Provide both the vinyl and the original for different contexts
        { src: vinylDataUrl, sizes: '512x512', type: 'image/png' },
        { src: albumArtUrl, sizes: '256x256', type: 'image/jpeg' },
      ]
    });
  } catch (err) {
    console.warn('Failed to generate vinyl artwork:', err);
    // Fallback: use plain album art
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: 'Retro Player',
      artwork: [
        { src: albumArtUrl, sizes: '256x256', type: 'image/jpeg' },
      ]
    });
  }
}
