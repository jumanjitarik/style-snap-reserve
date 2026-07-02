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
import { CATEGORIES, categoryLabel, findUiCategory, type ShopCategory } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { addDays, format, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import { useGeolocation } from "@/lib/geo";
import { distanceKm, formatKm } from "@/lib/distance";
import { MapPin } from "lucide-react";

const searchSchema = z.object({ shop: z.string().optional(), service: z.string().optional(), services: z.string().optional(), mode: z.enum(["appointment", "membership"]).optional() });

export const Route = createFileRoute("/randevu-al")({
  validateSearch: (s) => searchSchema.parse(s),
  component: BookPage,
});

const SLOTS = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"];

function BookPage() {
  const navigate = useNavigate();
  const { shop: initialShop, service: initialService, services: initialServices, mode } = Route.useSearch();
  const isMembershipMode = mode === "membership";
  const pageTitle = isMembershipMode ? "Üyelik Al" : "Randevu Al";
  const visibleCategories = useMemo(() => {
    const membershipKeys = new Set(["fitness", "yoga_pilates"]);
    return isMembershipMode
      ? CATEGORIES.filter((c) => membershipKeys.has(c.key))
      : CATEGORIES.filter((c) => !membershipKeys.has(c.key));
  }, [isMembershipMode]);
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
  const [category, setCategory] = useState<string | null>(null);
  const [shopId, setShopId] = useState<string | null>(initialShop ?? null);
  const [serviceIds, setServiceIds] = useState<string[]>(initialIds);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(addDays(startOfDay(new Date()), 1));
  const [time, setTime] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"full" | "deposit">("full");
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [customerNote, setCustomerNote] = useState("");
  const [usePoints, setUsePoints] = useState(false);

  // Loyalty: user's current points balance
  const { data: profilePts } = useQuery({
    queryKey: ["profile-points", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("points").eq("id", userId!).maybeSingle();
      return Number(data?.points ?? 0);
    },
  });


  const { coords } = useGeolocation();

  const { data: shops } = useQuery({
    queryKey: ["book-shops", category],
    enabled: step >= 2 && !!userId,
    queryFn: async () => {
      let q = supabase.from("barbershops").select("id, name, category, address, lat, lng, allow_full_payment, allow_deposit_payment");
      const ui = category ? findUiCategory(category) : null;
      if (ui) q = q.in("category", ui.dbValues as ShopCategory[]);
      const { data } = await q;
      return data ?? [];
    },
  });

  const sortedShops = useMemo((): Array<{ id: string; name: string; address: string | null; lat: number | null; lng: number | null; _km: number }> => {
    const arr = (shops ?? []).map((s) => ({ ...s, _km: (coords && s.lat && s.lng) ? distanceKm(coords.lat, coords.lng, Number(s.lat), Number(s.lng)) : Infinity }));
    arr.sort((a, b) => a._km - b._km);
    return arr as never;
  }, [shops, coords]);


  const { data: services } = useQuery({
    queryKey: ["book-services", shopId],
    enabled: !!shopId && !!userId,
    queryFn: async () => (await supabase.from("services").select("*").eq("shop_id", shopId!)).data ?? [],
  });
  const { data: shopPay } = useQuery({
    queryKey: ["book-shop-pay", shopId],
    enabled: !!shopId,
    queryFn: async () => (await supabase.from("barbershops").select("allow_full_payment, allow_deposit_payment, category, slot_capacity").eq("id", shopId!).maybeSingle()).data,
  });
  const { data: depositPct } = useQuery({
    queryKey: ["deposit-percent"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "deposit_percent").maybeSingle();
      const n = Number(data?.value ?? 25);
      return isNaN(n) ? 25 : Math.max(1, Math.min(100, n));
    },
    staleTime: 60_000,
  });
  const allowFull = shopPay?.allow_full_payment ?? true;
  const allowDeposit = shopPay?.allow_deposit_payment ?? true;
  const depPct = depositPct ?? 25;
  const shopCategory = (shopPay as any)?.category as string | undefined;
  const slotCapacity = Math.max(1, Number((shopPay as any)?.slot_capacity ?? 1));
  const skipDateTime = shopCategory === "fitness" || shopCategory === "yoga_pilates";
  useEffect(() => {
    if (!allowFull && paymentMethod === "full") setPaymentMethod("deposit");
    if (!allowDeposit && paymentMethod === "deposit") setPaymentMethod("full");
  }, [allowFull, allowDeposit]);

  // Fitness/yoga salonlarında tarih & saat adımını atla
  useEffect(() => {
    if (skipDateTime && step === 4) setStep(5);
  }, [skipDateTime, step]);



  const { data: staff } = useQuery({
    queryKey: ["book-staff", shopId],
    enabled: !!shopId && !!userId,
    queryFn: async () => (await supabase.from("staff").select("*").eq("shop_id", shopId!)).data ?? [],
  });
  const { data: workingHours } = useQuery({
    queryKey: ["book-working-hours", shopId],
    enabled: !!shopId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_working_hours")
        .select("weekday, is_open, open_time, close_time")
        .eq("shop_id", shopId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedServices = useMemo(() => (services ?? []).filter((s) => serviceIds.includes(s.id)), [services, serviceIds]);
  const totalPrice = useMemo(() => selectedServices.reduce((s, x) => s + Number(x.price ?? 0), 0), [selectedServices]);
  const totalMin = useMemo(() => selectedServices.reduce((s, x) => s + Number(x.duration_min ?? 0), 0), [selectedServices]);

  function toggleService(id: string) {
    setServiceIds((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  }

  const hoursByDay = useMemo(() => {
    const m = new Map<number, { is_open: boolean; open_time: string; close_time: string }>();
    (workingHours ?? []).forEach((h: any) => m.set(h.weekday, h));
    return m;
  }, [workingHours]);
  const selectedDayHours = date ? hoursByDay.get(date.getDay()) : null;
  const isDateDisabled = (d: Date) => {
    if (d < addDays(startOfDay(new Date()), 1)) return true;
    const h = hoursByDay.get(d.getDay());
    if (h) return !h.is_open;
    return d.getDay() === 0;
  };
  const dateStr = date ? format(date, "yyyy-MM-dd") : null;
  const { data: overrides } = useQuery({
    queryKey: ["slot-overrides-book", shopId, dateStr],
    enabled: !!shopId && !!dateStr,
    queryFn: async () => {
      const { data } = await supabase.from("slot_overrides" as never)
        .select("slot_time, is_active")
        .eq("shop_id", shopId!)
        .eq("date", dateStr!);
      return (data as { slot_time: string; is_active: boolean }[] | null) ?? [];
    },
  });
  const overrideMap = useMemo(() => {
    const m = new Map<string, boolean>();
    (overrides ?? []).forEach((o) => m.set(o.slot_time.slice(0, 5), o.is_active));
    return m;
  }, [overrides]);

  // Aynı gün için mevcut randevuları çekip saat başına doluluk sayısını çıkar
  const { data: dayAppts } = useQuery({
    queryKey: ["slot-usage", shopId, dateStr],
    enabled: !!shopId && !!dateStr,
    queryFn: async () => {
      const start = new Date(dateStr! + "T00:00:00").toISOString();
      const end = new Date(dateStr! + "T23:59:59").toISOString();
      const { data } = await supabase.from("appointments")
        .select("starts_at, status")
        .eq("shop_id", shopId!)
        .neq("status", "cancelled")
        .gte("starts_at", start)
        .lte("starts_at", end);
      return data ?? [];
    },
  });
  const slotUsage = useMemo(() => {
    const m = new Map<string, number>();
    (dayAppts ?? []).forEach((a: any) => {
      const d = new Date(a.starts_at);
      const key = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    });
    return m;
  }, [dayAppts]);

  const availableSlots = useMemo(() => {
    if (!date) return [];
    const h = selectedDayHours;
    if (h && !h.is_open) return [];
    const open = (h?.open_time ?? (date.getDay() === 0 ? "" : "09:00")).slice(0, 5);
    const close = (h?.close_time ?? (date.getDay() === 0 ? "" : "19:00")).slice(0, 5);
    if (!open || !close) return [];
    return SLOTS
      .filter((s) => s >= open && s < close)
      .filter((s) => overrideMap.get(s) !== false)
      .filter((s) => (slotUsage.get(s) ?? 0) < slotCapacity);
  }, [date, selectedDayHours, overrideMap, slotUsage, slotCapacity]);


  useEffect(() => {
    if (date && isDateDisabled(date)) { setDate(undefined); setTime(null); }
  }, [workingHours]);

  useEffect(() => {
    if (time && !availableSlots.includes(time)) setTime(null);
  }, [availableSlots, time]);

  const balance = profilePts ?? 0;
  const afterDiscount = Math.max(0, totalPrice - (appliedDiscount?.amount ?? 0));
  // 1 puan = 1₺. Toplamı geçemez.
  const pointsToUse = usePoints ? Math.min(balance, Math.floor(afterDiscount)) : 0;
  const finalTotal = Math.max(0, afterDiscount - pointsToUse);

  async function applyDiscount() {
    const code = discountCode.trim().toUpperCase();
    if (!code) return;
    const { data, error } = await supabase
      .from("discount_codes")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();
    if (error || !data) { toast.error("Geçersiz indirim kodu"); setAppliedDiscount(null); return; }
    if (data.expires_at && new Date(data.expires_at) < new Date()) { toast.error("Kodun süresi dolmuş"); setAppliedDiscount(null); return; }
    const amount = data.discount_type === "percent"
      ? totalPrice * Number(data.discount_value) / 100
      : Number(data.discount_value);
    setAppliedDiscount({ code: data.code, amount: Math.min(amount, totalPrice) });
    toast.success(`İndirim uygulandı: -${Math.min(amount, totalPrice).toFixed(0)}₺`);
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Giriş yap");
      if (!shopId || serviceIds.length === 0) throw new Error("Eksik bilgi");

      // Fitness / Yoga & Pilates → üyelik satışı (tarih/saat yok)
      if (skipDateTime) {
        const { error } = await supabase.from("memberships").insert({
          user_id: userId,
          shop_id: shopId,
          service_id: serviceIds[0],
          service_ids: serviceIds,
          amount: finalTotal,
          notes: customerNote.trim() || null,
          payment_ref: "SIM-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
        });
        if (error) throw error;
        try {
          const { data: shop } = await supabase.from("barbershops").select("owner_id, name").eq("id", shopId).maybeSingle();
          if (shop?.owner_id) {
            await supabase.from("notifications").insert({
              user_id: shop.owner_id,
              title: "Yeni üyelik satışı",
              body: `${shop.name} · ${finalTotal.toFixed(0)}₺ üyelik satın alındı.`,
            });
          }
        } catch { /* sessiz */ }
        return "membership" as const;
      }

      if (!date || !time) throw new Error("Tarih ve saat seç");
      const [hh, mm] = time.split(":").map(Number);
      const starts = new Date(date);
      starts.setHours(hh, mm, 0, 0);
      const deposit = paymentMethod === "deposit" ? Math.round(finalTotal * depPct / 100) : finalTotal;
      const remaining = Math.max(0, finalTotal - deposit);
      const { error } = await supabase.from("appointments").insert({
        user_id: userId,
        shop_id: shopId,
        service_id: serviceIds[0],
        service_ids: serviceIds,
        staff_id: staffId,
        starts_at: starts.toISOString(),
        status: "confirmed",
        payment_amount: deposit,
        deposit_amount: deposit,
        remaining_amount: remaining,
        payment_method: paymentMethod,
        discount_code: appliedDiscount?.code ?? null,
        discount_amount: appliedDiscount?.amount ?? 0,
        points_used: pointsToUse,
        notes: customerNote.trim() || null,
        payment_ref: "SIM-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
      });
      if (error) throw error;

      try {
        const { data: shop } = await supabase.from("barbershops").select("owner_id, name").eq("id", shopId).maybeSingle();
        if (shop?.owner_id) {
          const dt = starts.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
          const note = customerNote.trim() ? ` · Not: ${customerNote.trim().slice(0, 120)}` : "";
          const body = paymentMethod === "deposit"
            ? `${dt} · Yeni randevu — Sistemden ${deposit}₺ alındı, salonda ${remaining}₺ tahsil edilecek.${note}`
            : `${dt} · Yeni randevu — Tamamı sistemden ödendi (${deposit}₺).${note}`;
          await supabase.from("notifications").insert({
            user_id: shop.owner_id,
            title: paymentMethod === "deposit" ? "Yeni randevu (Kapora)" : "Yeni randevu",
            body,
          });
        }
      } catch { /* sessiz */ }
      return "appointment" as const;
    },

    onSuccess: (kind) => {
      if (kind === "membership") {
        toast.success("Üyelik satın alındı!");
        navigate({ to: "/randevularim", search: { tab: "memberships" } as never });
      } else {
        toast.success(paymentMethod === "deposit" ? "Kapora alındı, randevu onaylandı!" : "Ödeme alındı, randevu onaylandı!");
        navigate({ to: "/randevularim", search: { tab: "mine" } as never });
      }
    },
    onError: (e: Error) => toast.error(e.message),

  });


  if (authChecked && !userId) {
    return (
      <AppShell>
        <BackButton to="/" />
        <header className="px-4 pt-4 pb-3">
          <h1 className="font-display text-3xl">Randevu Al</h1>
          <p className="text-sm text-muted-foreground mt-1">Giriş sayfasına yönlendiriliyorsun…</p>
        </header>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <BackButton to="/" />
      <header className="px-4 pt-4 pb-3">
        <h1 className="font-display text-3xl">{pageTitle}</h1>
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
              {visibleCategories.map((c) => (
                <button key={c.key} onClick={() => { setCategory(c.key); setStep(2); }}
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
            <h2 className="font-display text-xl">Salon Seç {category && `· ${findUiCategory(category)?.label ?? ""}`}</h2>
            {coords && sortedShops.length > 0 && sortedShops[0]._km !== Infinity && (
              <p className="text-xs text-muted-foreground">En yakın: <span className="text-primary font-semibold">{sortedShops[0].name}</span> · {formatKm(sortedShops[0]._km)}</p>
            )}
            <div className="space-y-2">
              {sortedShops.map((s, i) => (
                <button key={s.id} onClick={() => { setShopId(s.id); setStep(3); }}
                  className={cn("w-full text-left rounded-xl border p-3 active:scale-[0.98] transition", shopId === s.id ? "border-primary" : (i === 0 && coords && s._km !== Infinity ? "border-primary/60 bg-primary/5" : "border-border bg-card"))}>
                  <div className="flex justify-between gap-2">
                    <p className="font-medium">{s.name}{i === 0 && coords && s._km !== Infinity && <span className="ml-2 text-[10px] rounded-full bg-primary/20 text-primary px-2 py-0.5">En yakın</span>}</p>
                    {s._km !== Infinity && <span className="text-xs text-primary shrink-0 flex items-center gap-0.5"><MapPin className="h-3 w-3" />{formatKm(s._km)}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.address}</p>
                </button>
              ))}
              {sortedShops.length === 0 && <p className="text-sm text-muted-foreground">Salon yok.</p>}
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
            <Button onClick={() => {
              if (serviceIds.length === 0) return;
              setStep(skipDateTime ? 5 : 4);
            }} disabled={serviceIds.length === 0} className="w-full h-12">
              Devam · {totalPrice.toFixed(0)}₺ {skipDateTime ? "" : `(${totalMin} dk)`}
            </Button>

          </>
        )}

        {step === 4 && !skipDateTime && (
          <>
            <button onClick={() => setStep(3)} className="text-xs text-primary">← Hizmet</button>
            <h2 className="font-display text-xl">Tarih & Saat</h2>
            <p className="text-xs text-muted-foreground">En erken yarın için randevu alabilirsin. Gün ve saatler salon çalışma düzenine göre açılır. Dolan saatler pasif gözükür.</p>
            <div className="rounded-xl border border-border bg-card p-2">
              <Calendar mode="single" selected={date} onSelect={setDate} locale={tr}
                disabled={isDateDisabled}
                className="pointer-events-auto"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {availableSlots.map((s) => (
                <button key={s} onClick={() => setTime(s)}
                  className={cn("rounded-lg border py-2 text-sm active:scale-95 transition", time === s ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card")}>
                  {s}
                </button>
              ))}
              {availableSlots.length === 0 && <p className="col-span-4 text-sm text-muted-foreground text-center py-3">Bu gün için uygun saat yok.</p>}
            </div>
            <Button onClick={() => time && setStep(5)} disabled={!time} className="w-full h-12">Devam Et</Button>
          </>
        )}

        {step === 5 && (
          <>
            <button onClick={() => setStep(skipDateTime ? 3 : 4)} className="text-xs text-primary">← {skipDateTime ? "Hizmet" : "Tarih"}</button>
            <h2 className="font-display text-xl">Ödeme & Onay</h2>

            <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
              <p className="text-muted-foreground text-xs uppercase tracking-wider">Hizmetler</p>
              {selectedServices.map((s) => (
                <p key={s.id} className="flex justify-between"><span>{s.name}</span><span className="font-semibold">{Number(s.price).toFixed(0)}₺</span></p>
              ))}
              <hr className="border-border" />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Varsa İndirim Kodu</p>
                <div className="flex gap-2">
                  <input
                    placeholder="KOD"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    className="flex-1 rounded-md bg-input border border-border p-2 text-sm uppercase"
                  />
                  <Button type="button" variant="outline" onClick={applyDiscount}>Uygula</Button>
                </div>
                {appliedDiscount && (
                  <p className="text-xs text-primary">✓ {appliedDiscount.code} → -{appliedDiscount.amount.toFixed(0)}₺</p>
                )}
              </div>
              {balance > 0 && (
                <>
                  <hr className="border-border" />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Puanlarım</p>
                    <button type="button" onClick={() => setUsePoints((v) => !v)}
                      className={cn("w-full text-left rounded-lg border p-2.5 transition active:scale-[0.99]", usePoints ? "border-primary bg-primary/5" : "border-border")}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">{usePoints ? "✓ Puanı kullan" : "Puanı kullan"} · <span className="text-primary font-semibold">{balance}P</span></span>
                        {usePoints && <span className="text-primary font-display">-{pointsToUse}₺</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">1 Puan = 1₺ indirim. Toplam ödenebilecek kadarı düşülür.</p>
                    </button>
                  </div>
                </>
              )}
              <hr className="border-border" />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Salona Not (opsiyonel)</p>
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value.slice(0, 300))}
                  placeholder="Tercih ettiğiniz model, alerji vb."
                  rows={2}
                  className="w-full rounded-md bg-input border border-border p-2 text-sm"
                />
                <p className="text-[10px] text-muted-foreground text-right">{customerNote.length}/300</p>
              </div>
              <hr className="border-border" />
              {!skipDateTime && <p><span className="text-muted-foreground">Tarih:</span> {date && format(date, "d MMMM yyyy", { locale: tr })} · {time}</p>}
              {(appliedDiscount || pointsToUse > 0) && (
                <>
                  <p className="flex justify-between text-xs"><span className="text-muted-foreground">Ara Toplam:</span> <span>{totalPrice.toFixed(0)}₺</span></p>
                  {appliedDiscount && <p className="flex justify-between text-xs text-primary"><span>Kupon ({appliedDiscount.code}):</span><span>-{appliedDiscount.amount.toFixed(0)}₺</span></p>}
                  {pointsToUse > 0 && <p className="flex justify-between text-xs text-primary"><span>Puan ({pointsToUse}P):</span><span>-{pointsToUse}₺</span></p>}
                </>
              )}
              <p className="flex justify-between items-center"><span className="text-muted-foreground">Toplam:</span> <span className="font-display text-2xl text-primary">{finalTotal.toFixed(0)}₺</span></p>
              <p className="text-[10px] text-muted-foreground">Bu randevudan <span className="text-primary font-semibold">+{Math.floor((paymentMethod === "deposit" ? Math.round(finalTotal * depPct / 100) : finalTotal) * 0.01)}P</span> kazanacaksın (sistemden çekilen tutarın %1'i).</p>
            </div>

            {!skipDateTime && (
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Ödeme Şekli</p>
                {allowFull && (
                  <button type="button" onClick={() => setPaymentMethod("full")}
                    className={cn("w-full text-left rounded-lg border p-3 active:scale-[0.99] transition", paymentMethod === "full" ? "border-primary bg-primary/5" : "border-border")}>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm">Tamamını şimdi kart ile öde</span>
                      <span className="font-display text-primary">{finalTotal.toFixed(0)}₺</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Hızlı ve sorunsuz, salonda ek ödeme yok.</p>
                  </button>
                )}
                {allowDeposit && (
                  <button type="button" onClick={() => setPaymentMethod("deposit")}
                    className={cn("w-full text-left rounded-lg border p-3 active:scale-[0.99] transition", paymentMethod === "deposit" ? "border-primary bg-primary/5" : "border-border")}>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm">%{depPct} kapora · kalanını salonda nakit öde</span>
                      <span className="font-display text-primary">{Math.round(finalTotal * depPct / 100)}₺</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Salonda nakit kalan {Math.max(0, finalTotal - Math.round(finalTotal * depPct / 100))}₺ tahsil edilecek.</p>
                  </button>
                )}
              </div>
            )}



            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Kart Bilgileri (Demo)</p>
              <input placeholder="Kart Numarası" className="w-full rounded-md bg-input border border-border p-2 text-sm" defaultValue="4242 4242 4242 4242" />
              <div className="flex gap-2">
                <input placeholder="AA/YY" className="w-1/2 rounded-md bg-input border border-border p-2 text-sm" defaultValue="12/30" />
                <input placeholder="CVC" className="w-1/2 rounded-md bg-input border border-border p-2 text-sm" defaultValue="123" />
              </div>
            </div>
            <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full h-12 font-semibold bg-gradient-to-r from-primary to-primary/80">
              {create.isPending ? "İşleniyor..." : skipDateTime
                ? `Üyeliği Satın Al · ${finalTotal.toFixed(0)}₺`
                : paymentMethod === "deposit"
                  ? `Kaporayı Öde · ${Math.round(finalTotal * depPct / 100)}₺`
                  : `Öde ve Onayla · ${finalTotal.toFixed(0)}₺`}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">Gerçek kart çekimi Stripe entegrasyonu gerektirir.</p>

          </>
        )}
      </div>
    </AppShell>
  );
}
