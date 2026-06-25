import { useEffect, useRef } from "react";

export function MiniMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: { remove: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !ref.current) return;
      // @ts-expect-error icon default fix
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      const m = L.map(ref.current, { zoomControl: false, attributionControl: true }).setView([lat, lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(m);
      L.marker([lat, lng]).addTo(m).bindPopup(name);
      map = m as unknown as { remove: () => void };
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [lat, lng, name]);
  // isolation + z-0 keeps Leaflet panes (which use high z-index inside) below the fixed bottom nav.
  return (
    <div
      ref={ref}
      className="h-48 w-full rounded-xl overflow-hidden relative z-0"
      style={{ isolation: "isolate" }}
    />
  );
}
