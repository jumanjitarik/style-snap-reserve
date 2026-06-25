import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Scissors, MapPin, Navigation2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { AppShell } from "@/components/AppShell";
import { LocationGate } from "@/components/LocationGate";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { useGeolocation } from "@/lib/geo";
import { distanceKm, formatKm } from "@/lib/distance";
import { SafeImg } from "@/components/SafeImg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BarberApp — Berber & Güzellik Randevusu" },
      { name: "description", content: "Yakınındaki en iyi berberleri keşfet, online randevu al." },
    ],
  }),
  component: Index,
});

function Index() {
  const [q, setQ] = useState("");
  const { coords } = useGeolocation();

  const { data: shops } = useQuery({
    queryKey: ["shops", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbershops")
        .select("id, name, category, address, cover_image_url, is_featured, lat, lng")
        .order("is_featured", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });

  const { data: welcome } = useQuery({
    queryKey: ["welcome-text"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("key, value").in("key", ["welcome_title", "welcome_subtitle"]);
      const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      return {
        title: map.welcome_title || "Bugün nasıl şıklaşıyoruz?",
        subtitle: map.welcome_subtitle || "Hoş geldin",
      };
    },
    staleTime: 60_000,
  });

  const isSearching = q.trim().length > 0;
  const filtered = (shops ?? []).filter((s) =>
    !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.address?.toLowerCase().includes(q.toLowerCase()),
  );
  const featured = (shops ?? []).filter((s) => s.is_featured);

  const nearest = useMemo(() => {
    if (!coords || !shops) return [];
    return shops
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({ ...s, dist: distanceKm(coords.lat, coords.lng, s.lat!, s.lng!) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 8);
  }, [coords, shops]);

  return (
    <LocationGate><AppShell>
      <header className="px-4 pt-8 pb-4">
        <p className="text-xs uppercase tracking-widest text-primary">{welcome?.subtitle ?? "Hoş geldin"}</p>
        <h1 className="mt-1 text-4xl font-display">{welcome?.title ?? "Bugün nasıl şıklaşıyoruz?"}</h1>
      </header>

      <div className="px-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Berber, salon, hizmet ara..."
            className="pl-9 bg-card border-border h-12"
          />
        </div>
      </div>

      {!isSearching && (
        <section className="px-4 pt-6">
          <h2 className="mb-3 text-lg font-display tracking-wider">Kategoriler</h2>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <Link
                key={c.value}
                to="/kuaforler"
                search={{ cat: c.value } as never}
                className="flex flex-col items-center gap-2 rounded-xl bg-card border border-border p-3 hover:border-primary/50 transition active:scale-95"
              >
                <c.icon className="h-6 w-6 text-primary" />
                <span className="text-[11px] text-center leading-tight">{c.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="px-4 pt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-display tracking-wider">
            {isSearching ? "Arama Sonuçları" : "Öne Çıkanlar"}
          </h2>
          {!isSearching && <Link to="/kuaforler" className="text-xs text-primary">Tümü →</Link>}
        </div>
        <div className="space-y-3">
          {(isSearching ? filtered : (featured.length > 0 ? featured : filtered)).slice(0, 12).map((s) => (
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

      {!isSearching && (
        <section className="px-4 pt-8 pb-4">
          <div className="mb-3 flex items-center gap-2">
            <Navigation2 className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-display tracking-wider">Sana En Yakın</h2>
          </div>
          {!coords ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Konum izni vermezsen yakındaki salonlar gözükmez.
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
                    {s.cover_image_url && <img src={s.cover_image_url} alt={s.name} className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold leading-tight truncate">{s.name}</p>
                      <span className="shrink-0 rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-bold">
                        {formatKm(s.dist)}
                      </span>
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-primary mt-0.5">{categoryLabel(s.category)}</p>
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
