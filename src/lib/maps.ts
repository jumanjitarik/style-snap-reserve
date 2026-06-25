// Open native map app with given coordinates/address
export function openInDeviceMap(opts: { lat?: number | null; lng?: number | null; address?: string | null; name?: string }) {
  const { lat, lng, address, name } = opts;
  const label = encodeURIComponent(name ?? address ?? "Konum");
  let url: string;
  if (lat != null && lng != null) {
    // geo: scheme works on Android; iOS will fall back via http link
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      url = `https://maps.apple.com/?q=${label}&ll=${lat},${lng}`;
    } else {
      url = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    }
  } else if (address) {
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  } else {
    return;
  }
  window.location.href = url;
}
