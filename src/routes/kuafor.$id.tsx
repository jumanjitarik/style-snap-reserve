import { SafeImg } from "@/components/SafeImg";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { MiniMap } from "@/components/MiniMap";
import { categoryLabel, type ShopCategory } from "@/lib/categories";
import { openInDeviceMap } from "@/lib/maps";
import { MapPin, Phone, Star, Heart, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";

const BASE_URL = "https://style-snap-reserve.lovable.app";

export const Route = createFileRoute("/kuafor/$id")({
  component: ShopDetail,
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("barbershops")
      .select("name, description, address, phone, category, cover_image_url")
      .eq("id", params.id)
      .maybeSingle();
    return { shop: data };
  },
  head: ({ params, loaderData }) => {
    const shop = loaderData?.shop;
    const title = shop ? `${shop.name} — KuaförApp` : "Salon — KuaförApp";
    const desc = shop
      ? `${shop.name}${shop.address ? `, ${shop.address}` : ""}. ${shop.description ?? "Online randevu al."}`.slice(0, 158)
      : "Salon detayları ve online randevu.";
    const url = `${BASE_URL}/kuafor/${params.id}`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:url", content: url },
      { property: "og:type", content: "business.business" },
    ];
    if (shop?.cover_image_url) {
      meta.push({ property: "og:image", content: shop.cover_image_url });
      meta.push({ name: "twitter:image", content: shop.cover_image_url });
    }
    const scripts = shop
      ? [{
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HealthAndBeautyBusiness",
            name: shop.name,
            description: shop.description ?? undefined,
            address: shop.address ?? undefined,
            telephone: shop.phone ?? undefined,
            image: shop.cover_image_url ?? undefined,
            url,
          }),
        }]
      : undefined;
    return { meta, links: [{ rel: "canonical", href: url }], scripts };
  },
  errorComponent: ({ error }) => <div className="p-8 text-center text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center">Salon bulunamadı</div>,
});

function ShopDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: shop } = useQuery({
    queryKey: ["shop", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("barbershops").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });
  const { data: services } = useQuery({
    queryKey: ["services", id],
    queryFn: async () => (await supabase.from("services").select("*").eq("shop_id", id)).data ?? [],
  });
  const { data: staff } = useQuery({
    queryKey: ["staff", id],
    queryFn: async () => (await supabase.from("staff").select("*").eq("shop_id", id)).data ?? [],
  });
  const { data: images } = useQuery({
    queryKey: ["images", id],
    queryFn: async () => (await supabase.from("barbershop_images").select("*").eq("shop_id", id).order("sort_order")).data ?? [],
  });
  const { data: reviews } = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_shop_reviews" as never, { _shop_id: id } as never);
      return (data as { id: string; rating: number; comment: string | null; created_at: string; user_id: string; author_name: string }[] | null) ?? [];
    },
  });
  const { data: isFav } = useQuery({
    queryKey: ["fav", id, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("user_id").eq("shop_id", id).eq("user_id", userId!).maybeSingle();
      return !!data;
    },
  });

  const toggleFav = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Önce giriş yap");
      if (isFav) {
        await supabase.from("favorites").delete().eq("shop_id", id).eq("user_id", userId);
      } else {
        await supabase.from("favorites").insert({ shop_id: id, user_id: userId });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fav", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  if (!shop) return <AppShell><div className="p-8 text-center text-muted-foreground">Yükleniyor...</div></AppShell>;

  return (
    <AppShell>
      <BackButton />
      <div className="relative">
        <CoverCarousel
          coverUrl={shop.cover_image_url}
          images={(images ?? []).map((i) => i.url)}
          alt={shop.name}
        />
        {userId && (
          <button
            onClick={() => toggleFav.mutate()}
            aria-label={isFav ? "Favorilerden çıkar" : "Favorilere ekle"}
            className="absolute top-3 right-3 z-10 rounded-full bg-background/80 backdrop-blur p-2 active:scale-90 transition"
          >
            <Heart className={`h-5 w-5 ${isFav ? "fill-primary text-primary" : ""}`} />
          </button>
        )}

        <div className="px-4 pt-4">
          <p className="text-xs uppercase tracking-widest text-primary">{categoryLabel(shop.category as ShopCategory)}</p>
          <h1 className="mt-1 text-3xl font-display">{shop.name}</h1>
          {avgRating && (
            <div className="mt-1 flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-primary text-primary" />
              <span className="font-semibold">{avgRating}</span>
              <span className="text-muted-foreground">({reviews?.length} yorum)</span>
            </div>
          )}
          {shop.description && <p className="mt-2 text-sm text-muted-foreground">{shop.description}</p>}

          <div className="mt-4 space-y-2 text-sm">
            {shop.address && (
              <button
                onClick={() => openInDeviceMap({ lat: shop.lat, lng: shop.lng, address: shop.address, name: shop.name })}
                className="flex items-start gap-2 w-full text-left active:opacity-60 transition"
              >
                <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span className="underline-offset-2 hover:underline">{shop.address}</span>
                <Navigation className="h-3.5 w-3.5 ml-auto mt-0.5 text-primary" />
              </button>
            )}
            {shop.phone && (
              <a href={`tel:${shop.phone}`} className="flex items-center gap-2 active:opacity-60"><Phone className="h-4 w-4 text-primary" />{shop.phone}</a>
            )}
          </div>


          <ServicesSection shopId={id} services={services ?? []} />

          <section className="mt-6">
            <h2 className="mb-2 font-display text-lg tracking-wider">Ekibimiz</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {(staff ?? []).map((p) => {
                const initial = (p.name ?? "?").trim().charAt(0).toLocaleUpperCase("tr-TR");
                return (
                  <div key={p.id} className="w-24 shrink-0 text-center">
                    <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-primary/30 to-primary/10 overflow-hidden flex items-center justify-center ring-2 ring-primary/30">
                      {p.photo_url ? (
                        <SafeImg src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-display text-3xl text-primary">{initial}</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-medium truncate">{p.name}</p>
                    {p.title && <p className="text-[10px] text-muted-foreground truncate">{p.title}</p>}
                  </div>
                );
              })}
            </div>
          </section>

          <ReviewSection shopId={id} userId={userId} reviews={reviews ?? []} />

          <WaitlistWidget shopId={id} userId={userId} />


          {shop.lat != null && shop.lng != null && (
            <section className="mt-6 mb-6">
              <h2 className="mb-2 font-display text-lg tracking-wider">Konum</h2>
              <button
                onClick={() => openInDeviceMap({ lat: shop.lat, lng: shop.lng, address: shop.address, name: shop.name })}
                className="block w-full active:opacity-80 transition"
                aria-label="Haritada aç"
              >
                <MiniMap lat={shop.lat} lng={shop.lng} name={shop.name} />
              </button>
              <p className="mt-1 text-[11px] text-center text-muted-foreground">Haritaya dokunarak telefondaki harita uygulamasında aç</p>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}

type ServiceRow = { id: string; name: string; description: string | null; duration_min: number | null; price: number | string | null };

function ServicesSection({ shopId, services }: { shopId: string; services: ServiceRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => setSelected((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const sel = useMemo(() => services.filter((s) => selected.includes(s.id)), [services, selected]);
  const total = useMemo(() => sel.reduce((s, x) => s + Number(x.price ?? 0), 0), [sel]);
  const totalMin = useMemo(() => sel.reduce((s, x) => s + Number(x.duration_min ?? 0), 0), [sel]);
  return (
    <section className="mt-6">
      <h2 className="mb-2 font-display text-lg tracking-wider">Hizmetler</h2>
      <p className="text-xs text-muted-foreground mb-2">Birden fazla hizmet seçebilirsin.</p>
      <div className="space-y-2">
        {services.map((s) => {
          const checked = selected.includes(s.id);
          return (
            <button
              key={s.id} type="button" onClick={() => toggle(s.id)}
              className={`w-full text-left rounded-xl border p-3 active:scale-[0.99] transition flex gap-3 ${checked ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            >
              <Checkbox checked={checked} className="mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{s.name}</p>
                  <p className="font-display text-xl text-primary shrink-0">{Number(s.price ?? 0).toFixed(0)}₺</p>
                </div>
                {s.description && <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{s.duration_min} dk</p>
              </div>
            </button>
          );
        })}
        {services.length === 0 && <p className="text-sm text-muted-foreground">Hizmet eklenmemiş.</p>}
      </div>
      {services.length > 0 && (
        <Link
          to="/randevu-al"
          search={{ shop: shopId, services: selected.join(",") } as never}
          className="mt-4 flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-primary/80 font-semibold text-primary-foreground shadow-lg active:scale-95 transition"
        >
          {selected.length > 0
            ? <>Randevu Al · {sel.length} hizmet · {total.toFixed(0)}₺ ({totalMin} dk)</>
            : <>Randevu Al</>}
        </Link>
      )}
    </section>
  );
}

function ReviewSection({ shopId, userId, reviews }: { shopId: string; userId: string | null; reviews: { id: string; rating: number; comment: string | null; created_at: string; user_id: string }[] }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const mine = reviews.find((r) => r.user_id === userId);

  const submit = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Yorum yapmak için giriş yap");
      const { error } = await supabase.from("reviews").upsert({ shop_id: shopId, user_id: userId, rating, comment }, { onConflict: "shop_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reviews", shopId] }); toast.success("Yorum kaydedildi"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-6">
      <h2 className="mb-2 font-display text-lg tracking-wider">Yorumlar</h2>
      {userId && (
        <div className="mb-3 rounded-xl border border-border bg-card p-3">
          <p className="mb-2 text-xs text-muted-foreground">{mine ? "Yorumunu güncelle" : "Yorum yap"}</p>
          <div className="mb-2 flex gap-1">
            {[1,2,3,4,5].map((n) => (
              <button key={n} onClick={() => setRating(n)}>
                <Star className={`h-6 w-6 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Deneyimini paylaş..." rows={2} />
          <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="mt-2 w-full">Gönder</Button>
        </div>
      )}
      <div className="space-y-2">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map((n) => <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />)}
            </div>
            {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
          </div>
        ))}
        {reviews.length === 0 && <p className="text-sm text-muted-foreground">Henüz yorum yok.</p>}
      </div>
    </section>
  );
}

function CoverCarousel({ coverUrl, images, alt }: { coverUrl: string | null; images: string[]; alt: string }) {
  const all = useMemo(() => {
    const arr: string[] = [];
    if (coverUrl) arr.push(coverUrl);
    images.forEach((u) => { if (u && u !== coverUrl) arr.push(u); });
    return arr;
  }, [coverUrl, images]);
  const { data: settings } = useQuery({
    queryKey: ["gallery-interval"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "gallery_interval_ms").maybeSingle();
      const ms = Number(data?.value ?? 3000);
      return Number.isFinite(ms) && ms >= 1000 ? ms : 3000;
    },
    staleTime: 60_000,
  });
  const intervalMs = settings ?? 3000;
  const [idx, setIdx] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);

  useEffect(() => {
    if (all.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % all.length), intervalMs);
    return () => clearInterval(t);
  }, [all.length, intervalMs]);

  if (all.length === 0) return <div className="relative aspect-[16/10] bg-muted" />;

  return (
    <div
      className="relative aspect-[16/10] bg-muted overflow-hidden select-none"
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX == null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 40) {
          setIdx((i) => (i + (dx < 0 ? 1 : all.length - 1)) % all.length);
        }
        setTouchX(null);
      }}
    >
      <div className="flex h-full transition-transform duration-500 ease-out w-full" style={{ transform: `translateX(-${idx * 100}%)` }}>
        {all.map((u, i) => (
          <div key={i} className="h-full w-full shrink-0 bg-muted">
            <SafeImg src={u} alt={alt} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
      {all.length > 1 && (
        <>
          <button aria-label="Önceki" onClick={() => setIdx((i) => (i - 1 + all.length) % all.length)} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/70 backdrop-blur p-1.5 text-foreground active:scale-90">‹</button>
          <button aria-label="Sonraki" onClick={() => setIdx((i) => (i + 1) % all.length)} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/70 backdrop-blur p-1.5 text-foreground active:scale-90">›</button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1">
            {all.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-primary" : "w-1.5 bg-background/70"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
