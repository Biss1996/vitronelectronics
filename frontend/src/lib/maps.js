// Google Maps helpers for the shop location. No API key needed.

/** What to search for on the map: coordinates if we can find them, else the place text. */
export function mapQuery(settings) {
  const raw = (settings?.mapLocation || settings?.address || "").trim();
  if (!raw) return "";
  const at = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);           // pasted Google Maps link
  if (at) return `${at[1]},${at[2]}`;
  const ll = raw.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/); // "lat,lng"
  if (ll) return `${ll[1]},${ll[2]}`;
  if (/^https?:\/\//.test(raw)) return settings?.address || "";   // short links can't be embedded
  return raw;
}

export const mapEmbedUrl = (q) => `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=17&output=embed`;
export const directionsUrl = (q) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
