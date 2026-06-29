import { SafeImg } from "@/components/SafeImg";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { CATEGORIES, categoryLabel, findUiCategory, type ShopCategory } from "@/lib/categories";
import { MapPin, ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useGeolocation } from "@/lib/geo";
import { distanceKm, formatKm } from "@/lib/distance";

const searchSchema = z.object({ cat: z.string().optional() });
type SortKey = "near" | "rating" | "reviews" | "price";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "near", label: "Yakın" },
  { key: "rating", label: "Puan" },
  { key: "reviews", label: "Yorum" },
  { key: "price", label: "Fiyat" },
];

export const Route = createFileRoute("/kuaforler")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Salonlar — BarberApp" },
      { name: "description", content: "Berber, kuaför, lazer, tırnak, cilt ve estetik salonlarını yakınlık, puan ve fiyata göre keşfet." },
      { property: "og:title", content: "Salonlar — BarberApp" },
      { property: "og:description", content: "Berber, kuaför, lazer, tırnak, cilt ve estetik salonlarını yakınlık, puan ve fiyata göre keşfet." },
      { property: "og:url", content: "https://style-snap-reserve.lovable.app/kuaforler" },
    ],
    links: [{ rel: "canonical", href: "https://style-snap-reserve.lovable.app/kuaforler" }],
  }),
  component: ShopList,
});

function ShopList() {
  const { cat } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { coords } = useGeolocation();
  const [sort, setSort] = useState<SortKey>("near");
  const [myCity, setMyCity] = useState<string | null>(null);
  const [onlyMyCity, setOnlyMyCity] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("city").eq("id", data.user.id).maybeSingle();
      if (p?.city) { setMyCity(p.city); setOnlyMyCity(true); }
    });
  }, []);

  const { data } = useQuery({
    queryKey: ["shops-list", cat ?? "all"],
    queryFn: async () => {
      let q = supabase.from("barbershops").select("id, name, category, address, city, cover_image_url, lat, lng");
      const ui = cat ? findUiCategory(cat) : null;
      if (ui) q = q.in("category", ui.dbValues as ShopCategory[]);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const shopIds = useMemo(() => (data ?? []).map((s) => s.id), [data]);
  const { data: reviews } = useQuery({
    queryKey: ["shop-reviews-agg", shopIds],
    enabled: shopIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("shop_id, rating").in("shop_id", shopIds);
      const map = new Map<string, { sum: number; n: number }>();
      (data ?? []).forEach((r) => {
        const cur = map.get(r.shop_id) ?? { sum: 0, n: 0 };
        cur.sum += r.rating; cur.n += 1; map.set(r.shop_id, cur);
      });
      return map;
    },
  });
  const { data: priceMap } = useQuery({
    queryKey: ["shop-min-price", shopIds],
    enabled: shopIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("services").select("shop_id, price").in("shop_id", shopIds);
      const m = new Map<string, number>();
      (data ?? []).forEach((s) => {
        const cur = m.get(s.shop_id);
        const p = Number(s.price);
        if (cur == null || p < cur) m.set(s.shop_id, p);
      });
      return m;
    },
  });

  const enriched = useMemo(() => {
    return (data ?? []).map((s) => {
      const agg = reviews?.get(s.id);
      const rating = agg ? agg.sum / agg.n : 0;
      const reviewsCount = agg?.n ?? 0;
      const minPrice = priceMap?.get(s.id) ?? Infinity;
      const dist = coords && s.lat != null && s.lng != null ? distanceKm(coords.lat, coords.lng, s.lat, s.lng) : Infinity;
      return { ...s, rating, reviewsCount, minPrice, dist };
    });
  }, [data, reviews, priceMap, coords]);

  const { data: serviceMatchIds } = useQuery({
    queryKey: ["shops-service-search", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const q = search.trim();
      const { data } = await supabase.from("services").select("shop_id").ilike("name", `%${q}%`);
      return new Set((data ?? []).map((r) => r.shop_id));
    },
  });

  const filtered = useMemo(() => {
    let arr = enriched;
    if (onlyMyCity && myCity) {
      const norm = myCity.toLowerCase();
      arr = arr.filter((s) => (s.city ?? s.address ?? "").toLowerCase().includes(norm));
    }
    const q = search.trim().toLocaleLowerCase("tr");
    if (q) {
      arr = arr.filter((s) =>
        s.name.toLocaleLowerCase("tr").includes(q) ||
        (s.city ?? "").toLocaleLowerCase("tr").includes(q) ||
        (s.address ?? "").toLocaleLowerCase("tr").includes(q) ||
        (serviceMatchIds?.has(s.id) ?? false),
      );
    }
    return arr;
  }, [enriched, onlyMyCity, myCity, search, serviceMatchIds]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "near") arr.sort((a, b) => a.dist - b.dist);
    else if (sort === "rating") arr.sort((a, b) => b.rating - a.rating);
    else if (sort === "reviews") arr.sort((a, b) => b.reviewsCount - a.reviewsCount);
    else if (sort === "price") arr.sort((a, b) => a.minPrice - b.minPrice);
    return arr;
  }, [filtered, sort]);

  return (
    <AppShell>
      <BackButton to="/" />
      <header className="px-4 pt-4 pb-2 flex items-end justify-between gap-2">
        <h1 className="text-3xl font-display">Salonlar</h1>
        <div className="flex items-center gap-1.5 text-xs">
          <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
          <div className="flex gap-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={cn(
                  "rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide transition active:scale-95",
                  sort === s.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="px-4 pb-2 relative">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Hizmet, salon veya şehir ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {myCity && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setOnlyMyCity((v) => !v)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] active:scale-95 transition",
              onlyMyCity ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground",
            )}
          >
            📍 Sadece {myCity} {onlyMyCity ? "✓" : ""}
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
        <button
          onClick={() => navigate({ search: {} })}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition active:scale-95",
            !cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground",
          )}
        >
          Tümü
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => navigate({ search: { cat: c.key } })}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition active:scale-95",
              cat === c.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4 pb-4">
        {sorted.map((s) => (
          <Link
            key={s.id}
            to="/kuafor/$id"
            params={{ id: s.id }}
            className="flex gap-3 overflow-hidden rounded-xl bg-card border border-border hover:border-primary/50 transition p-3 active:scale-[0.98]"
          >
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
              {s.cover_image_url && <SafeImg src={s.cover_image_url} alt={s.name} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-primary">{categoryLabel(s.category)}</p>
                {Number.isFinite(s.dist) && (
                  <span className="shrink-0 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-bold">
                    {formatKm(s.dist)}
                  </span>
                )}
              </div>
              <h3 className="font-semibold leading-tight truncate">{s.name}</h3>
              {s.address && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{s.address}</span>
                </p>
              )}
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                {s.rating > 0 && <span>★ {s.rating.toFixed(1)} ({s.reviewsCount})</span>}
                {Number.isFinite(s.minPrice) && <span className="text-primary font-semibold">{s.minPrice.toFixed(0)}₺ ↑</span>}
              </div>
            </div>
          </Link>
        ))}
        {sorted.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Eşleşen salon yok.</p>
        )}
      </div>
    </AppShell>
  );
}
