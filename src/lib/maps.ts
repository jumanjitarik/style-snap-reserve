// Open native map app. Prefers an explicit Google Maps URL when provided
// (set by admin per shop), else falls back to lat/lng or address search.
export function openInDeviceMap(opts: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  name?: string;
  maps_url?: string | null;
}) {
  const { lat, lng, address, name, maps_url } = opts;
  let url: string | null = null;
  if (maps_url && maps_url.trim().length > 0) {
    url = maps_url.trim();
  } else if (lat != null && lng != null) {
    const label = encodeURIComponent(name ?? "Konum");
    url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${label}`;
  } else if (address) {
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  if (!url) return;
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) window.location.href = url;
}

export function mapChooserUrls(opts: { lat?: number | null; lng?: number | null; address?: string | null; name?: string }) {
  const { lat, lng, address, name } = opts;
  const q = lat != null && lng != null ? `${lat},${lng}` : address ?? "";
  const encQ = encodeURIComponent(q);
  const encName = encodeURIComponent(name ?? q);
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${encQ}`,
    apple: `https://maps.apple.com/?q=${encName}${lat != null && lng != null ? `&ll=${lat},${lng}` : ""}`,
    yandex: lat != null && lng != null
      ? `https://yandex.com/maps/?pt=${lng},${lat}&z=16&l=map`
      : `https://yandex.com/maps/?text=${encQ}`,
  };
}
