import { useEffect, useState } from "react";

export type Coords = { lat: number; lng: number };

export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Konum desteklenmiyor");
      return;
    }
    const id = navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError(err.message),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
    );
    return () => { void id; };
  }, []);

  return { coords, error };
}
