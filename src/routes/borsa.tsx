import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { useGeolocation } from "@/lib/geo";
import { distanceKm, formatKm } from "@/lib/distance";
import { Link } from "@tanstack/react-router";
import { LineChart, MapPin, ArrowUpDown } from "lucide-react";
import { CATEGORIES, type ShopCategory } from "@/lib/categories";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/borsa")({
  ssr: false,
  component: BorsaPage,
});

type SortKey = "price" | "near" | "name" | "rating" | "reviews";
const MAX_KM = 25;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "price", label: "Fiyat" },
  { key: "near", label: "Yakın" },
  { key: "rating", label: "Puan" },
  { key: "reviews", label: "Yorum" },
  { key: "name", label: "Ad" },
];

function BorsaPage() {
  const { coords, permission, request } = useGeolocation();
  const [sortBy, setSortBy] = useState<SortKey>("price");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string | null>(null);

  const { data: shops } = useQuery({
    queryKey: ["borsa-shops"],
    queryFn: async () => {
      const { data } = await supabase.from("barbershops").select("id, name, address, city, lat, lng, category, cover_image_url");
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

  const shopIds = useMemo(() => (shops ?? []).map((s) => s.id), [shops]);
  const { data: reviewMap } = useQuery({
    queryKey: ["borsa-reviews", shopIds],
    enabled: shopIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("shop_id, rating").in("shop_id", shopIds);
      const map = new Map<string, { rating: number; count: number }>();
      (data ?? []).forEach((r) => {
        const cur = map.get(r.shop_id) ?? { rating: 0, count: 0 };
        cur.rating += Number(r.rating ?? 0);
        cur.count += 1;
        map.set(r.shop_id, cur);
      });
      map.forEach((v, k) => map.set(k, { rating: v.count ? v.rating / v.count : 0, count: v.count }));
      return map;
    },
  });

  const rows = useMemo(() => {
    if (!shops || !services) return [];
    const ui = cat ? CATEGORIES.find((c) => c.key === cat) : null;
    const allowed = ui ? new Set(ui.dbValues as ShopCategory[]) : null;
    const shopMap = new Map(shops.filter((s) => !allowed || allowed.has(s.category as ShopCategory)).map((s) => [s.id, s]));
    const list = services.map((sv) => {
      const shop = shopMap.get(sv.shop_id);
      if (!shop) return null;
      let km: number | null = null;
      if (coords && shop.lat != null && shop.lng != null) {
        km = distanceKm(coords.lat, coords.lng, Number(shop.lat), Number(shop.lng));
      }
      return {
        serviceId: sv.id,
        serviceName: sv.name,
        price: Number(sv.price ?? 0),
        duration: sv.duration_min,
        shopId: shop.id,
        shopName: shop.name,
        shopImage: (shop as any).cover_image_url as string | null,
        city: shop.city,
        address: shop.address,
        km,
        rating: reviewMap?.get(shop.id)?.rating ?? 0,
        reviewsCount: reviewMap?.get(shop.id)?.count ?? 0,
      };
    }).filter(Boolean) as Array<{ serviceId: string; serviceName: string; price: number; duration: number | null; shopId: string; shopName: string; shopImage: string | null; city: string | null; address: string | null; km: number | null; rating: number; reviewsCount: number }>;

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
      if (sortBy === "near") return (a.km ?? 9999) - (b.km ?? 9999);
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "reviews") return b.reviewsCount - a.reviewsCount;
      return a.shopName.localeCompare(b.shopName, "tr");
    });
    return searched.slice(0, 300);
  }, [shops, services, coords, sortBy, search, cat, reviewMap]);

  return (
    <AppShell>
      <header className="px-4 pt-4 pb-2 flex items-end justify-between gap-2">
        <h1 className="font-display text-3xl flex items-center gap-2"><LineChart className="h-7 w-7 text-primary" /> Borsa</h1>
        <div className="flex items-center gap-1.5 text-xs">
          <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
          <div className="flex gap-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key)}
                className={cn(
                  "rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide transition active:scale-95",
                  sortBy === s.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <p className="px-4 text-xs text-muted-foreground pb-2">{coords ? `${MAX_KM} km içindeki en ucuz hizmetler` : "Konum izni vererek yakındaki en ucuz fiyatları gör"}</p>

      <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
        <button
          onClick={() => setCat(null)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition active:scale-95",
            !cat ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/40",
          )}
        >
          Tümü
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition active:scale-95",
              cat === c.key ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/40",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

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

        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {coords ? `${MAX_KM} km içinde uygun hizmet bulunamadı.` : "Hizmet bulunamadı."}
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
                    {r.reviewsCount > 0 ? ` · ★ ${r.rating.toFixed(1)} (${r.reviewsCount})` : ""}
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
