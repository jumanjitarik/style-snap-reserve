import { Bell, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/lib/geo";
import { useEffect, useState } from "react";

export function LocationGate({ children }: { children: React.ReactNode }) {
  const { permission, request } = useGeolocation();
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const i = setInterval(() => setNotifPerm(Notification.permission), 1000);
    return () => clearInterval(i);
  }, []);

  // Location gate first — must be granted, no skip
  if (permission !== "granted" && permission !== "unsupported" && permission !== "checking") {
    const denied = permission === "denied";
    return (
      <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="h-20 w-20 rounded-full bg-primary/15 flex items-center justify-center mb-6">
          <MapPin className="h-10 w-10 text-primary" />
        </div>
        <h1 className="font-display text-2xl mb-3">Konum izni gerekli</h1>
        <p className="text-sm text-muted-foreground max-w-xs mb-8">
          En yakın salonları görmen için konum izni gerekli.
        </p>
        {!denied ? (
          <Button onClick={request} className="w-full max-w-xs h-12">
            <MapPin className="h-4 w-4 mr-2" /> Konum İzni Ver
          </Button>
        ) : (
          <div className="w-full max-w-xs space-y-3">
            <p className="text-xs text-destructive">
              Konum izni reddedildi. Tarayıcı ayarlarından izin verip sayfayı yenileyin.
            </p>
            <Button onClick={() => window.location.reload()} variant="outline" className="w-full h-12">
              Tekrar Dene
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Notification gate — must be granted (if supported)
  if (notifPerm === "default" || notifPerm === "denied") {
    const denied = notifPerm === "denied";
    const ask = async () => {
      try { const p = await Notification.requestPermission(); setNotifPerm(p); } catch { /* noop */ }
    };
    return (
      <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="h-20 w-20 rounded-full bg-primary/15 flex items-center justify-center mb-6">
          <Bell className="h-10 w-10 text-primary" />
        </div>
        <h1 className="font-display text-2xl mb-3">Bildirim izni gerekli</h1>
        <p className="text-sm text-muted-foreground max-w-xs mb-8">
          Randevu bilgileri ve salon üyeliği bilgileri için bildirim izni gerekir.
        </p>
        {!denied ? (
          <Button onClick={ask} className="w-full max-w-xs h-12">
            <Bell className="h-4 w-4 mr-2" /> Bildirim İzni Ver
          </Button>
        ) : (
          <div className="w-full max-w-xs space-y-3">
            <p className="text-xs text-destructive">
              Bildirim izni reddedildi. Tarayıcı ayarlarından izin verip sayfayı yenileyin.
            </p>
            <Button onClick={() => window.location.reload()} variant="outline" className="w-full h-12">
              Tekrar Dene
            </Button>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
