import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { CATEGORIES, categoryLabel, type ShopCategory } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { addDays, format, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";

const searchSchema = z.object({ shop: z.string().optional(), service: z.string().optional(), services: z.string().optional() });

export const Route = createFileRoute("/randevu-al")({
  validateSearch: (s) => searchSchema.parse(s),
  component: BookPage,
});

const SLOTS = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"];

function BookPage() {
  const navigate = useNavigate();
  const { shop: initialShop, service: initialService, services: initialServices } = Route.useSearch();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setAuthChecked(true);
      if (!data.user) navigate({ to: "/auth" });
    });
  }, [navigate]);

  const initialIds = initialServices ? initialServices.split(",").filter(Boolean) : (initialService ? [initialService] : []);
  const [step, setStep] = useState<1|2|3|4|5>(initialShop ? (initialIds.length > 0 ? 4 : 3) : 1);
  const [category, setCategory] = useState<ShopCategory | null>(null);
  const [shopId, setShopId] = useState<string | null>(initialShop ?? null);
  const [serviceIds, setServiceIds] = useState<string[]>(initialIds);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(addDays(startOfDay(new Date()), 1));
  const [time, setTime] = useState<string | null>(null);

  const { data: shops } = useQuery({
    queryKey: ["book-shops", category],
    enabled: step >= 2 && !!userId,
    queryFn: async () => {
      let q = supabase.from("barbershops").select("id, name, category, address");
      if (category) q = q.eq("category", category);
      const { data } = await q;
      return data ?? [];
    },
  });
  const { data: services } = useQuery({
    queryKey: ["book-services", shopId],
    enabled: !!shopId && !!userId,
    queryFn: async () => (await supabase.from("services").select("*").eq("shop_id", shopId!)).data ?? [],
  });
  const { data: staff } = useQuery({
    queryKey: ["book-staff", shopId],
    enabled: !!shopId && !!userId,
    queryFn: async () => (await supabase.from("staff").select("*").eq("shop_id", shopId!)).data ?? [],
  });

  const selectedServices = useMemo(() => (services ?? []).filter((s) => serviceIds.includes(s.id)), [services, serviceIds]);
  const totalPrice = useMemo(() => selectedServices.reduce((s, x) => s + Number(x.price ?? 0), 0), [selectedServices]);
  const totalMin = useMemo(() => selectedServices.reduce((s, x) => s + Number(x.duration_min ?? 0), 0), [selectedServices]);

  function toggleService(id: string) {
    setServiceIds((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Giriş yap");
      if (!shopId || serviceIds.length === 0 || !date || !time) throw new Error("Eksik bilgi");
      const [hh, mm] = time.split(":").map(Number);
      const starts = new Date(date);
      starts.setHours(hh, mm, 0, 0);
      const { error } = await supabase.from("appointments").insert({
        user_id: userId,
        shop_id: shopId,
        service_id: serviceIds[0],
        service_ids: serviceIds,
        staff_id: staffId,
        starts_at: starts.toISOString(),
        status: "confirmed",
        payment_amount: totalPrice,
        payment_ref: "SIM-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ödeme alındı, randevu onaylandı!");
      navigate({ to: "/randevularim" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authChecked && !userId) {
    return (
      <AppShell>
        <BackButton to="/" />
        <header className="px-4 pt-16 pb-3">
          <h1 className="font-display text-3xl">Randevu Al</h1>
          <p className="text-sm text-muted-foreground mt-1">Giriş sayfasına yönlendiriliyorsun…</p>
        </header>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <BackButton to="/" />
      <header className="px-4 pt-16 pb-3">
        <h1 className="font-display text-3xl">Randevu Al</h1>
        <div className="mt-3 flex gap-1">
          {[1,2,3,4,5].map((n) => (
            <div key={n} className={cn("h-1 flex-1 rounded-full", n <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </header>

      <div className="px-4 pb-4 space-y-4">
        {step === 1 && (
          <>
            <h2 className="font-display text-xl">Kategori Seç</h2>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <button key={c.value} onClick={() => { setCategory(c.value); setStep(2); }}
                  className="rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2 active:scale-95 transition">
                  <c.icon className="h-7 w-7 text-primary" />
                  <span className="text-sm text-center">{c.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <button onClick={() => setStep(1)} className="text-xs text-primary">← Kategori</button>
            <h2 className="font-display text-xl">Salon Seç {category && `· ${categoryLabel(category)}`}</h2>
            <div className="space-y-2">
              {(shops ?? []).map((s) => (
                <button key={s.id} onClick={() => { setShopId(s.id); setStep(3); }}
                  className={cn("w-full text-left rounded-xl border p-3 active:scale-[0.98] transition", shopId === s.id ? "border-primary" : "border-border bg-card")}>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.address}</p>
                </button>
              ))}
              {(shops ?? []).length === 0 && <p className="text-sm text-muted-foreground">Salon yok.</p>}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <button onClick={() => initialShop ? navigate({ to: "/kuafor/$id", params: { id: shopId! } }) : setStep(2)} className="text-xs text-primary">← Salon</button>
            <h2 className="font-display text-xl">Hizmet(ler) Seç</h2>
            <p className="text-xs text-muted-foreground">Birden fazla hizmet seçebilirsin.</p>
            <div className="space-y-2">
              {(services ?? []).map((s) => {
                const checked = serviceIds.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggleService(s.id)}
                    className={cn("w-full text-left rounded-xl border p-3 active:scale-[0.98] transition flex gap-3", checked ? "border-primary bg-primary/5" : "border-border bg-card")}>
                    <Checkbox checked={checked} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <p className="font-medium">{s.name}</p>
                        <p className="font-display text-lg text-primary shrink-0">{Number(s.price).toFixed(0)}₺</p>
                      </div>
                      {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{s.duration_min} dk</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {(staff ?? []).length > 0 && (
              <>
                <h3 className="font-display text-lg mt-4">Çalışan (opsiyonel)</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  <button onClick={() => setStaffId(null)} className={cn("rounded-full px-3 py-1.5 text-xs border whitespace-nowrap active:scale-95 transition", !staffId ? "bg-primary text-primary-foreground border-primary" : "border-border")}>
                    Farketmez
                  </button>
                  {(staff ?? []).map((p) => (
                    <button key={p.id} onClick={() => setStaffId(p.id)} className={cn("rounded-full px-3 py-1.5 text-xs border whitespace-nowrap active:scale-95 transition", staffId === p.id ? "bg-primary text-primary-foreground border-primary" : "border-border")}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <Button onClick={() => serviceIds.length > 0 && setStep(4)} disabled={serviceIds.length === 0} className="w-full h-12">
              Devam · {totalPrice.toFixed(0)}₺ ({totalMin} dk)
            </Button>
          </>
        )}

        {step === 4 && (
          <>
            <button onClick={() => setStep(3)} className="text-xs text-primary">← Hizmet</button>
            <h2 className="font-display text-xl">Tarih & Saat</h2>
            <p className="text-xs text-muted-foreground">En erken yarın için randevu alabilirsin. Pazar günleri kapalı.</p>
            <div className="rounded-xl border border-border bg-card p-2">
              <Calendar mode="single" selected={date} onSelect={setDate} locale={tr}
                disabled={(d) => d < addDays(startOfDay(new Date()), 1) || d.getDay() === 0}
                className="pointer-events-auto"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SLOTS.map((s) => (
                <button key={s} onClick={() => setTime(s)}
                  className={cn("rounded-lg border py-2 text-sm active:scale-95 transition", time === s ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card")}>
                  {s}
                </button>
              ))}
            </div>
            <Button onClick={() => time && setStep(5)} disabled={!time} className="w-full h-12">Devam Et</Button>
          </>
        )}

        {step === 5 && (
          <>
            <button onClick={() => setStep(4)} className="text-xs text-primary">← Tarih</button>
            <h2 className="font-display text-xl">Ödeme & Onay</h2>
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
              <p className="text-muted-foreground text-xs uppercase tracking-wider">Hizmetler</p>
              {selectedServices.map((s) => (
                <p key={s.id} className="flex justify-between"><span>{s.name}</span><span className="font-semibold">{Number(s.price).toFixed(0)}₺</span></p>
              ))}
              <hr className="border-border" />
              <p><span className="text-muted-foreground">Tarih:</span> {date && format(date, "d MMMM yyyy", { locale: tr })} · {time}</p>
              <p className="flex justify-between items-center"><span className="text-muted-foreground">Toplam:</span> <span className="font-display text-2xl text-primary">{totalPrice.toFixed(0)}₺</span></p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Kart Bilgileri (Demo)</p>
              <input placeholder="Kart Numarası" className="w-full rounded-md bg-input border border-border p-2 text-sm" defaultValue="4242 4242 4242 4242" />
              <div className="flex gap-2">
                <input placeholder="AA/YY" className="w-1/2 rounded-md bg-input border border-border p-2 text-sm" defaultValue="12/30" />
                <input placeholder="CVC" className="w-1/2 rounded-md bg-input border border-border p-2 text-sm" defaultValue="123" />
              </div>
            </div>
            <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full h-12 font-semibold bg-gradient-to-r from-primary to-primary/80">
              {create.isPending ? "İşleniyor..." : `Öde ve Onayla · ${totalPrice.toFixed(0)}₺`}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">Gerçek kart çekimi Stripe entegrasyonu gerektirir.</p>
          </>
        )}
      </div>
    </AppShell>
  );
}
