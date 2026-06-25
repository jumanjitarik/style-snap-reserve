// Open native map app. Uses Google Maps universal URL which deep-links
// into the installed Google Maps app on iOS/Android; falls back to web.
export function openInDeviceMap(opts: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  name?: string;
}) {
  const { lat, lng, address, name } = opts;
  let url: string;
  if (lat != null && lng != null) {
    const label = encodeURIComponent(name ?? "Konum");
    url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${label}`;
  } else if (address) {
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  } else {
    return;
  }
  // _blank lets mobile browsers hand the URL to the Maps app via universal links
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) window.location.href = url;
}

// Open a chooser for Google / Apple / Yandex maps
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
