import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useGeolocation } from "@/lib/geo";
import { distanceKm, formatKm } from "@/lib/distance";
import { Link } from "@tanstack/react-router";
import { LineChart, MapPin } from "lucide-react";

export const Route = createFileRoute("/borsa")({
  ssr: false,
  component: BorsaPage,
});

type SortKey = "price" | "distance" | "name";
const MAX_KM = 40;

function BorsaPage() {
  const { coords, permission, request } = useGeolocation();
  const [sortBy, setSortBy] = useState<SortKey>("price");
  const [search, setSearch] = useState("");

  const { data: shops } = useQuery({
    queryKey: ["borsa-shops"],
    queryFn: async () => {
      const { data } = await supabase.from("barbershops").select("id, name, address, city, latitude, longitude").eq("active", true);
      return data ?? [];
    },
  });

  const { data: services } = useQuery({
    queryKey: ["borsa-services"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("id, name, price, duration_min, shop_id");
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    if (!shops || !services) return [];
    const shopMap = new Map(shops.map((s) => [s.id, s]));
    const list = services.map((sv) => {
      const shop = shopMap.get(sv.shop_id);
      if (!shop) return null;
      let km: number | null = null;
      if (coords && shop.latitude != null && shop.longitude != null) {
        km = distanceKm(coords.lat, coords.lng, Number(shop.latitude), Number(shop.longitude));
      }
      return {
        serviceId: sv.id,
        serviceName: sv.name,
        price: Number(sv.price ?? 0),
        duration: sv.duration_min,
        shopId: shop.id,
        shopName: shop.name,
        city: shop.city,
        address: shop.address,
        km,
      };
    }).filter(Boolean) as Array<{ serviceId: string; serviceName: string; price: number; duration: number | null; shopId: string; shopName: string; city: string | null; address: string | null; km: number | null }>;

    // Filter by distance only when we have coords
    const filtered = list.filter((r) => {
      if (coords) return r.km != null && r.km <= MAX_KM;
      return true;
    });

    const q = search.trim().toLocaleLowerCase("tr");
    const searched = q
      ? filtered.filter((r) =>
          r.serviceName.toLocaleLowerCase("tr").includes(q) ||
          r.shopName.toLocaleLowerCase("tr").includes(q) ||
          (r.city ?? "").toLocaleLowerCase("tr").includes(q),
        )
      : filtered;

    searched.sort((a, b) => {
      if (sortBy === "price") return a.price - b.price;
      if (sortBy === "distance") return (a.km ?? 9999) - (b.km ?? 9999);
      return a.serviceName.localeCompare(b.serviceName, "tr");
    });
    return searched.slice(0, 300);
  }, [shops, services, coords, sortBy, search]);

  return (
    <AppShell>
      <header className="px-4 pt-4 pb-3">
        <h1 className="font-display text-3xl flex items-center gap-2"><LineChart className="h-7 w-7 text-primary" /> Borsa</h1>
        <p className="text-xs text-muted-foreground">{coords ? `${MAX_KM} km içindeki en ucuz hizmetler` : "Konum izni vererek yakındaki en ucuz fiyatları gör"}</p>
      </header>

      <div className="px-4 space-y-3 pb-6">
        {!coords && permission !== "checking" && (
          <button
            onClick={request}
            className="w-full rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary flex items-center justify-center gap-2"
          >
            <MapPin className="h-4 w-4" /> Konumumu kullan
          </button>
        )}

        <Input placeholder="Hizmet, salon veya şehir ara…" value={search} onChange={(e) => setSearch(e.target.value)} />

        <div>
          <Label className="text-xs">Sırala</Label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="price">En ucuz fiyat</SelectItem>
              <SelectItem value="distance">En yakın mesafe</SelectItem>
              <SelectItem value="name">Hizmet adı (A→Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {coords ? "40 km içinde uygun hizmet bulunamadı." : "Hizmet bulunamadı."}
            </p>
          )}
          {rows.map((r) => (
            <Link
              key={`${r.shopId}-${r.serviceId}`}
              to="/kuafor/$id"
              params={{ id: r.shopId }}
              className="block rounded-xl border border-border bg-card p-3 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{r.serviceName}</p>
                  <p className="text-xs text-muted-foreground truncate">🏪 {r.shopName}{r.city ? ` · ${r.city}` : ""}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {r.duration ? `⏱ ${r.duration} dk` : ""}
                    {r.km != null ? ` · 📍 ${formatKm(r.km)}` : ""}
                  </p>
                </div>
                <p className="font-display text-2xl text-primary whitespace-nowrap">{r.price.toFixed(0)}₺</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
