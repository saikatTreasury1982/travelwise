// app/lib/services/unsplash.ts
// Server-side Unsplash lookup for trip cover images. Best-effort: returns null
// on any failure so a missing cover never blocks a trip save.

export interface Cover {
  url: string;        // the image URL (regular size)
  credit: string;     // "Photo by <name>"
  link: string;       // photographer's Unsplash profile URL (for attribution link)
}

export async function findCover(query: string): Promise<Cover | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  const q = query.trim();
  if (!key || !q) return null;

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=1&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${key}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data?.results?.[0];
    if (!photo) return null;
    const name = photo.user?.name ?? 'Unknown';
    const profile = photo.user?.links?.html ?? 'https://unsplash.com';
    // Unsplash requires the UTM params on attribution links.
    const link = `${profile}?utm_source=travelwise&utm_medium=referral`;
    return {
      url: photo.urls?.regular ?? photo.urls?.full ?? '',
      credit: `Photo by ${name}`,
      link,
    };
  } catch {
    return null;
  }
}