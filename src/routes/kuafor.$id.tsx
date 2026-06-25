import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { MiniMap } from "@/components/MiniMap";
import { categoryLabel, type ShopCategory } from "@/lib/categories";
import { MapPin, Phone, Star, Heart, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/kuafor/$id")({
  component: ShopDetail,
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
    queryFn: async () => (await supabase.from("reviews").select("id, rating, comment, created_at, user_id").eq("shop_id", id).order("created_at", { ascending: false })).data ?? [],
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
      <div className="relative">
        <div className="relative aspect-[16/10] bg-muted">
          {shop.cover_image_url && <img src={shop.cover_image_url} alt={shop.name} className="h-full w-full object-cover" />}
          <Link to="/kuaforler" className="absolute top-3 left-3 rounded-full bg-background/80 backdrop-blur p-2">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {userId && (
            <button
              onClick={() => toggleFav.mutate()}
              className="absolute top-3 right-3 rounded-full bg-background/80 backdrop-blur p-2"
            >
              <Heart className={`h-5 w-5 ${isFav ? "fill-primary text-primary" : ""}`} />
            </button>
          )}
        </div>

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
              <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />{shop.address}</p>
            )}
            {shop.phone && (
              <a href={`tel:${shop.phone}`} className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" />{shop.phone}</a>
            )}
          </div>

          {shop.lat != null && shop.lng != null && (
            <div className="mt-4">
              <MiniMap lat={shop.lat} lng={shop.lng} name={shop.name} />
            </div>
          )}

          {images && images.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 font-display text-lg tracking-wider">Galeri</h2>
              <div className="flex gap-2 overflow-x-auto">
                {images.map((im) => (
                  <img key={im.id} src={im.url} alt="" className="h-28 w-40 shrink-0 rounded-lg object-cover" />
                ))}
              </div>
            </section>
          )}

          <section className="mt-6">
            <h2 className="mb-2 font-display text-lg tracking-wider">Hizmetler</h2>
            <div className="space-y-2">
              {(services ?? []).map((s) => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{s.name}</p>
                      {s.description && <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">{s.duration_min} dk</p>
                    </div>
                    <p className="font-display text-xl text-primary">{Number(s.price).toFixed(0)}₺</p>
                  </div>
                </div>
              ))}
              {(services ?? []).length === 0 && <p className="text-sm text-muted-foreground">Hizmet eklenmemiş.</p>}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-2 font-display text-lg tracking-wider">Ekibimiz</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {(staff ?? []).map((p) => (
                <div key={p.id} className="w-24 shrink-0 text-center">
                  <div className="h-20 w-20 mx-auto rounded-full bg-muted overflow-hidden">
                    {p.photo_url && <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />}
                  </div>
                  <p className="mt-1 text-xs font-medium truncate">{p.name}</p>
                  {p.title && <p className="text-[10px] text-muted-foreground truncate">{p.title}</p>}
                </div>
              ))}
            </div>
          </section>

          <ReviewSection shopId={id} userId={userId} reviews={reviews ?? []} />

          <div className="mt-6 mb-4">
            <Link
              to="/randevu-al"
              search={{ shop: id } as never}
              className="flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground"
            >
              Randevu Al
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
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
