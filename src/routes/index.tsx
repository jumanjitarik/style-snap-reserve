import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Scissors, MapPin, Navigation2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel } from "@/lib/categories";
import { useCustomCategories } from "@/lib/dynamic-categories";
import { CategoryIcon } from "@/components/CategoryIcon";
import { AppShell } from "@/components/AppShell";
import { LocationGate } from "@/components/LocationGate";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGeolocation } from "@/lib/geo";
import { distanceKm, formatKm } from "@/lib/distance";
import { SafeImg } from "@/components/SafeImg";
import categoryMarble from "@/assets/category-marble.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KuaförApp — Berber & Güzellik Randevusu" },
      { name: "description", content: "Yakınındaki en iyi berberleri keşfet, online randevu al." },
      { property: "og:title", content: "KuaförApp — Berber & Güzellik Randevusu" },
      { property: "og:description", content: "Yakınındaki en iyi berberleri keşfet, online randevu al." },
      { property: "og:url", content: "https://style-snap-reserve.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://style-snap-reserve.lovable.app/" }],
  }),
  component: Index,
});

function Index() {
  const [q, setQ] = useState("");
  const { coords } = useGeolocation();
  const [myCity, setMyCity] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("city").eq("id", data.user.id).maybeSingle();
      if (p?.city) setMyCity(p.city);
    });
  }, []);

  const { data: shops } = useQuery({
    queryKey: ["shops", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbershops")
        .select("id, name, category, address, city, cover_image_url, is_featured, lat, lng, description")
        .order("is_featured", { ascending: false })
        .limit(120);
      if (error) throw error;
      return data;
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["shops", "reviews-agg"],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("shop_id, rating");
      const map = new Map<string, { sum: number; count: number }>();
      (data ?? []).forEach((r) => {
        const cur = map.get(r.shop_id) ?? { sum: 0, count: 0 };
        cur.sum += Number(r.rating ?? 0); cur.count += 1;
        map.set(r.shop_id, cur);
      });
      return map;
    },
  });

  // Search corpus: services + staff names per shop, used by the smart matcher
  const { data: searchCorpus } = useQuery({
    queryKey: ["search-corpus"],
    queryFn: async () => {
      const [svc, st] = await Promise.all([
        supabase.from("services").select("shop_id, name, description"),
        supabase.from("staff").select("shop_id, name, title"),
      ]);
      const map = new Map<string, string>();
      (svc.data ?? []).forEach((s) => {
        const cur = map.get(s.shop_id) ?? "";
        map.set(s.shop_id, cur + " " + (s.name ?? "") + " " + (s.description ?? ""));
      });
      (st.data ?? []).forEach((s) => {
        const cur = map.get(s.shop_id) ?? "";
        map.set(s.shop_id, cur + " " + (s.name ?? "") + " " + (s.title ?? ""));
      });
      return map;
    },
    staleTime: 60_000,
  });

  const { data: welcome } = useQuery({
    queryKey: ["welcome-text"],
    queryFn: async () => {
      const keys = [
        "welcome_title", "welcome_subtitle", "search_placeholder", "hero_url",
        "welcome_line1_text", "welcome_line1_color",
        "welcome_line2_text", "welcome_line2_color",
        "welcome_line3_text", "welcome_line3_color",
        "hero_height_px", "gap_top_px", "gap_line12_px", "gap_line23_px", "gap_search_px",
        "hero_slides", "hero_interval_ms",
        "category_card_w_px", "category_card_h_px",
      ];
      const { data } = await supabase.from("app_settings").select("key, value").in("key", keys);
      const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      const num = (k: string, d: number) => { const n = Number(map[k]); return Number.isFinite(n) ? n : d; };
      let slides: { url: string; link?: string }[] = [];
      try { const p = JSON.parse(map.hero_slides || "[]"); if (Array.isArray(p)) slides = p.filter((s: { url?: string }) => s && typeof s.url === "string" && s.url); } catch { /* ignore */ }
      return {
        line1: { text: map.welcome_line1_text || map.welcome_subtitle || "HOŞ GELDİN", color: map.welcome_line1_color || "#FFD400" },
        line2: { text: map.welcome_line2_text || (map.welcome_title?.split(" ").slice(0, 2).join(" ")) || "BUGÜN GÜZEL", color: map.welcome_line2_color || "#FFFFFF" },
        line3: { text: map.welcome_line3_text || "VE ŞIKSIN", color: map.welcome_line3_color || "#FFD400" },
        searchPlaceholder: map.search_placeholder || "Berber, salon, hizmet ara...",
        heroUrl: map.hero_url || "",
        heroHeight: num("hero_height_px", 120),
        gapTop: num("gap_top_px", 8),
        gapLine12: num("gap_line12_px", 2),
        gapLine23: num("gap_line23_px", 0),
        gapSearch: num("gap_search_px", 8),
        slides,
        slideIntervalMs: Math.max(1000, num("hero_interval_ms", 5000)),
        catW: num("category_card_w_px", 0),
        catH: num("category_card_h_px", 0),
      };
    },
    staleTime: 60_000,
  });


  type Shop = NonNullable<typeof shops>[number] & { dist?: number; rating?: number; reviewCount?: number };

  const enriched = useMemo<Shop[]>(() => {
    return (shops ?? []).map((s) => {
      const agg = reviews?.get(s.id);
      const dist = coords && s.lat != null && s.lng != null ? distanceKm(coords.lat, coords.lng, s.lat, s.lng) : undefined;
      return {
        ...s,
        dist,
        rating: agg && agg.count > 0 ? agg.sum / agg.count : undefined,
        reviewCount: agg?.count ?? 0,
      };
    });
  }, [shops, reviews, coords]);

  const isSearching = q.trim().length > 0;
  // Turkish-aware normalize: lowercase + strip diacritics + Turkish-specific chars
  const normalize = (str: string) => str
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/i̇/g, "i")
    .replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = useMemo(() => {
    if (!isSearching) return enriched;
    const tokens = normalize(q).split(/\s+/).filter(Boolean);
    return enriched.filter((s) => {
      const hay = normalize(
        [s.name, s.address, s.city, s.description, categoryLabel(s.category), searchCorpus?.get(s.id) ?? ""].filter(Boolean).join(" "),
      );
      return tokens.every((t) => hay.includes(t));
    });
  }, [enriched, q, isSearching, searchCorpus]);

  // Featured filtered by user's city (if known)
  const featured = useMemo(() => {
    const fa = enriched.filter((s) => s.is_featured);
    if (!myCity) return fa;
    const norm = myCity.toLowerCase();
    return fa.filter((s) => (s.city ?? s.address ?? "").toLowerCase().includes(norm));
  }, [enriched, myCity]);

  const nearest = useMemo(() => {
    if (!coords) return [];
    return enriched
      .filter((s) => s.dist != null)
      .sort((a, b) => (a.dist! - b.dist!))
      .slice(0, 8);
  }, [enriched, coords]);

  return (
    <LocationGate><AppShell>
      <header className="relative overflow-hidden" style={{ minHeight: (welcome?.slides.length || welcome?.heroUrl) ? `${welcome?.heroHeight ?? 120}px` : undefined }}>
        {welcome?.slides.length ? (
          <HeroBanner
            slides={welcome.slides}
            intervalMs={welcome.slideIntervalMs}
            heightPx={welcome.heroHeight}
          />
        ) : welcome?.heroUrl ? (
          <div className="absolute inset-0" style={{ height: `${welcome?.heroHeight ?? 120}px` }}>
            <SafeImg src={welcome.heroUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div className="relative px-4 pb-3" style={{ paddingTop: `${welcome?.gapTop ?? 8}px` }}>
          <p className="text-xs normal-case tracking-widest font-semibold" style={{ color: welcome?.line1.color }}>{welcome?.line1.text}</p>
          <h1 className="text-3xl font-sans font-black leading-[0.95] normal-case" style={{ color: welcome?.line2.color, marginTop: `${welcome?.gapLine12 ?? 2}px` }}>{welcome?.line2.text}</h1>
          <h1 className="text-3xl font-sans font-black leading-[0.95] normal-case" style={{ color: welcome?.line3.color, marginTop: `${welcome?.gapLine23 ?? 0}px` }}>{welcome?.line3.text}</h1>
        </div>
      </header>

      <div className="px-4" style={{ paddingTop: `${welcome?.gapSearch ?? 8}px` }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={welcome?.searchPlaceholder ?? "Berber, salon, hizmet ara..."}
            aria-label="Salon veya hizmet ara"
            className="pl-9 bg-card border-border h-12"
          />
        </div>
      </div>


      {!isSearching && <CategoriesSection widthPx={welcome?.catW ?? 0} heightPx={welcome?.catH ?? 0} />}




      {(isSearching || featured.length > 0) && (
        <section className="px-4 pt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-display tracking-wider">
              {isSearching ? "Arama Sonuçları" : "Öne Çıkanlar"}
            </h2>
            {!isSearching && <Link to="/kuaforler" className="text-xs text-primary">Tümü →</Link>}
          </div>
          <div className="space-y-3">
            {(isSearching ? filtered : featured).slice(0, 12).map((s) => (
              <Link
                key={s.id}
                to="/kuafor/$id"
                params={{ id: s.id }}
                className="block overflow-hidden rounded-xl bg-card border border-border hover:border-primary/50 transition active:scale-[0.98]"
              >
                <div className="relative aspect-[16/9] bg-muted">
                  {s.cover_image_url && (
                    <SafeImg src={s.cover_image_url} alt={s.name} className="h-full w-full object-cover" />
                  )}
                  <span className="absolute top-2 left-2 rounded-full bg-background/80 backdrop-blur px-2 py-0.5 text-[10px] font-medium">
                    {categoryLabel(s.category)}
                  </span>
                  {s.is_featured && (
                    <span className="absolute top-2 right-2 rounded-full bg-primary/90 text-primary-foreground px-2 py-0.5 text-[10px] font-bold tracking-wide">
                      ★ ÖNE ÇIKAN
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold leading-tight">{s.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {s.dist != null && (
                      <span className="inline-flex items-center gap-1 text-primary font-semibold">
                        <Navigation2 className="h-3 w-3" /> {formatKm(s.dist)}
                      </span>
                    )}
                    {s.rating != null ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3 w-3 fill-primary text-primary" /> {s.rating.toFixed(1)} ({s.reviewCount} yorum)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 opacity-70">
                        <Star className="h-3 w-3" /> Henüz yorum yok
                      </span>
                    )}
                  </div>
                  {s.address && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{s.address}</span>
                    </p>
                  )}
                </div>
              </Link>
            ))}
            {(isSearching ? filtered : shops ?? []).length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <Scissors className="mx-auto mb-2 h-8 w-8 opacity-50" />
                {isSearching ? "Sonuç bulunamadı." : "Henüz salon eklenmemiş."}
              </div>
            )}
          </div>
        </section>
      )}

      {!isSearching && (
        <section className="px-4 pt-8 pb-4">
          <div className="mb-3 flex items-center gap-2">
            <Navigation2 className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-display tracking-wider">Sana En Yakın</h2>
          </div>
          {!coords ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Konum bekleniyor…
            </div>
          ) : nearest.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Yakında konumu girilmiş salon yok.
            </div>
          ) : (
            <div className="space-y-2">
              {nearest.map((s) => (
                <Link
                  key={s.id}
                  to="/kuafor/$id"
                  params={{ id: s.id }}
                  className="flex gap-3 rounded-xl bg-card border border-border p-3 hover:border-primary/50 transition active:scale-[0.98]"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {s.cover_image_url && <SafeImg src={s.cover_image_url} alt={s.name} className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold leading-tight truncate">{s.name}</p>
                      <span className="shrink-0 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-bold">
                        {formatKm(s.dist!)}
                      </span>
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-primary mt-0.5">{categoryLabel(s.category)}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {s.rating != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3 fill-primary text-primary" /> {s.rating.toFixed(1)} ({s.reviewCount})
                        </span>
                      ) : <span className="opacity-60">Henüz yorum yok</span>}
                    </div>
                    {s.address && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{s.address}</span>
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </AppShell></LocationGate>
  );
}

function CategoriesSection() {
  const { data: cats } = useCustomCategories();
  const list = cats ?? [];
  if (list.length === 0) return null;
  return (
    <section className="px-4 pt-6">
      <h2 className="mb-3 text-lg font-display tracking-wider">Kategoriler</h2>
      <div className="grid grid-cols-4 gap-2">
        {list.map((c) => (
          <Link
            key={c.id}
            to="/kuaforler"
            search={{ cat: c.slug } as never}
            className="group relative flex aspect-square flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-white/5 bg-gradient-to-b from-neutral-900 to-black p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_6px_16px_-10px_rgba(0,0,0,0.8)] transition hover:border-primary/40 active:scale-[0.97]"
          >
            <span
              className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
              style={{ backgroundImage: `url(${categoryMarble})`, backgroundSize: "cover", backgroundPosition: "center" }}
            />
            <span className="pointer-events-none absolute -top-6 left-1/2 h-14 w-14 -translate-x-1/2 rounded-full bg-primary/10 blur-xl" />
            <CategoryIcon
              icon={c.icon_url}
              alt={c.name}
              className="relative h-6 w-6 text-[22px] text-primary drop-shadow-[0_2px_6px_rgba(212,175,55,0.35)]"
            />
            <span className="relative text-center text-[10px] font-medium leading-tight text-neutral-100 line-clamp-2">
              {c.name}
            </span>
          </Link>
        ))}
      </div>

    </section>
  );
}

