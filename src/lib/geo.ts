import { useEffect, useState } from "react";

export type Coords = { lat: number; lng: number };
export type GeoPermission = "prompt" | "granted" | "denied" | "unsupported" | "checking";

export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<GeoPermission>("checking");

  const request = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermission("unsupported");
      setError("Konum desteklenmiyor");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPermission("granted");
      },
      (err) => {
        setError(err.message);
        setPermission(err.code === err.PERMISSION_DENIED ? "denied" : "prompt");
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
    );
  };

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermission("unsupported");
      return;
    }
    const perms = (navigator as Navigator & { permissions?: { query: (q: { name: PermissionName }) => Promise<PermissionStatus> } }).permissions;
    if (perms?.query) {
      perms.query({ name: "geolocation" as PermissionName }).then((status) => {
        setPermission(status.state as GeoPermission);
        if (status.state === "granted") request();
        status.onchange = () => {
          setPermission(status.state as GeoPermission);
          if (status.state === "granted") request();
        };
      }).catch(() => request());
    } else {
      request();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { coords, error, permission, request };
}
