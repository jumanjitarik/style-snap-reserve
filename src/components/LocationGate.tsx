import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/lib/geo";

export function LocationGate({ children }: { children: React.ReactNode }) {
  const { permission, request } = useGeolocation();

  if (permission === "checking" || permission === "granted" || permission === "unsupported") {
    return <>{children}</>;
  }

  const denied = permission === "denied";

  const tryClose = () => {
    try { window.close(); } catch { /* noop */ }
    setTimeout(() => {
      // Browsers usually block window.close() for non-script-opened tabs.
      // As fallback, navigate away to a blank page.
      try { window.location.href = "about:blank"; } catch { /* noop */ }
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="h-20 w-20 rounded-full bg-primary/15 flex items-center justify-center mb-6">
        <MapPin className="h-10 w-10 text-primary" />
      </div>
      <h1 className="font-display text-2xl mb-3">Konum izni gerekli</h1>
      <p className="text-sm text-muted-foreground max-w-xs mb-8">
        Size en yakın salonları görmek için konum izni vermelisiniz.
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
          <Button onClick={tryClose} variant="destructive" className="w-full h-12">
            <X className="h-4 w-4 mr-2" /> Uygulamayı Kapat
          </Button>
        </div>
      )}
    </div>
  );
}
