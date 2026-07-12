import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { SafeImg } from "@/components/SafeImg";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowUpDown, Download, Store, Plus, Trash2, Save, Upload, X, Clock, CreditCard, CalendarClock } from "lucide-react";

import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/salon-yonetimi")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const ok = roles?.some((r) => r.role === "owner" || r.role === "admin");
    if (!ok) throw redirect({ to: "/" });
  },
  component: SalonYonetimi,
});

function SalonYonetimi() {
  const [tab, setTab] = useState<"shop" | "hours" | "plan" | "services" | "staff" | "pos">(() => {
    if (typeof window === "undefined") return "shop";
    const saved = window.localStorage.getItem("salon.mgmt.tab");
    return ["shop", "hours", "plan", "services", "staff", "pos"].includes(saved ?? "") ? saved as any : "shop";
  });
  const { data: shops } = useQuery({
    queryKey: ["owner-shops"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user!.id);
      const isAdmin = !!roles?.some((r) => r.role === "admin");
      let q = supabase
        .from("barbershops")
        .select("id, name, description, address, phone, lat, lng, category, cover_image_url, city, owner_id, slot_capacity")
        .order("name");
      if (!isAdmin) q = q.eq("owner_id", u.user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
  const [shopId, setShopId] = useState<string>("");
  const activeShop = useMemo(() => shops?.find((s) => s.id === shopId) ?? shops?.[0], [shops, shopId]);
  const activeId = activeShop?.id ?? "";

  return (
    <AppShell>
      <BackButton to="/hesap" />
      <header className="px-4 pt-4 pb-3">
        <h1 className="font-display text-3xl">Salon Yönetimi</h1>
        <p className="text-xs text-muted-foreground">Randevular, salon bilgileri, hizmetler ve çalışanlar</p>
      </header>

      <div className="px-4 pb-6 space-y-3">
        {(shops?.length ?? 0) > 1 && (
          <div>
            <Label className="text-xs">Salon Seç</Label>
            <Select value={activeId} onValueChange={setShopId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(shops ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); window.localStorage.setItem("salon.mgmt.tab", v); }} className="w-full">
          <TabsList className="grid grid-cols-3 h-auto w-full gap-1 p-1">
            <TabsTrigger value="shop">Salon</TabsTrigger>
            <TabsTrigger value="hours">Saatler</TabsTrigger>
            <TabsTrigger value="plan">Rezervasyon Planı</TabsTrigger>
            <TabsTrigger value="services">Hizmet</TabsTrigger>
            <TabsTrigger value="staff">Çalışan</TabsTrigger>
            <TabsTrigger value="pos">Sanal POS</TabsTrigger>
          </TabsList>

          <TabsContent value="shop" className="mt-3">
            {activeShop ? <ShopInfoTab shop={activeShop} /> : <p className="text-sm text-muted-foreground">Salon yok.</p>}
          </TabsContent>
          <TabsContent value="hours" className="mt-3">
            {activeId ? <WorkingHoursTab shopId={activeId} /> : <p className="text-sm text-muted-foreground">Salon yok.</p>}
          </TabsContent>
          <TabsContent value="plan" className="mt-3">
            {activeId ? <ReservationPlanTab shopId={activeId} /> : <p className="text-sm text-muted-foreground">Salon yok.</p>}
          </TabsContent>
          <TabsContent value="services" className="mt-3">
            {activeId ? <ServicesTab shopId={activeId} /> : <p className="text-sm text-muted-foreground">Salon yok.</p>}
          </TabsContent>
          <TabsContent value="staff" className="mt-3">
            {activeId ? <StaffTab shopId={activeId} /> : <p className="text-sm text-muted-foreground">Salon yok.</p>}
          </TabsContent>
          <TabsContent value="pos" className="mt-3">
            {activeId ? <VirtualPosTab shopId={activeId} /> : <p className="text-sm text-muted-foreground">Salon yok.</p>}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

/* ============ APPOINTMENTS ============ */
type SortKey = "date" | "service" | "amount";

function AppointmentsTab({ shops }: { shops: { id: string; name: string }[] }) {
  const [shopFilter, setShopFilter] = useState<string>("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [asc, setAsc] = useState(false);

  const { data: serviceMap } = useQuery({
    queryKey: ["owner-services-all"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("id, name, price");
      const m = new Map<string, { name: string; price: number }>();
      (data ?? []).forEach((s) => m.set(s.id, { name: s.name, price: Number(s.price ?? 0) }));
      return m;
    },
  });

  const ownedIds = useMemo(() => shops.map((s) => s.id), [shops]);

  const { data: rows } = useQuery({
    queryKey: ["owner-appts", shopFilter, ownedIds.join(",")],
    enabled: ownedIds.length > 0,
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("id, starts_at, status, payment_amount, deposit_amount, remaining_amount, payment_method, service_ids, user_id, shop_id, notes, barbershops:shop_id(name), profiles:user_id(full_name, phone)")
        .order("starts_at", { ascending: false });
      if (shopFilter === "ALL") q = q.in("shop_id", ownedIds);
      else q = q.eq("shop_id", shopFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    let list = [...(rows ?? [])];
    if (from) list = list.filter((r) => new Date(r.starts_at) >= new Date(from));
    if (to) list = list.filter((r) => new Date(r.starts_at) <= new Date(to + "T23:59:59"));
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((r: any) => {
        const name = (r.profiles?.full_name ?? "").toLowerCase();
        const services = ((r.service_ids ?? []).map((id: string) => serviceMap?.get(id)?.name ?? "").join(" ")).toLowerCase();
        return name.includes(s) || services.includes(s);
      });
    }
    list.sort((a: any, b: any) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortBy === "date") { av = new Date(a.starts_at).getTime(); bv = new Date(b.starts_at).getTime(); }
      else if (sortBy === "amount") { av = Number(a.payment_amount ?? 0) + Number(a.remaining_amount ?? 0); bv = Number(b.payment_amount ?? 0) + Number(b.remaining_amount ?? 0); }
      else { av = ((a.service_ids ?? []).map((id: string) => serviceMap?.get(id)?.name ?? "").join(",")); bv = ((b.service_ids ?? []).map((id: string) => serviceMap?.get(id)?.name ?? "").join(",")); }
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    });
    return list;
  }, [rows, from, to, search, sortBy, asc, serviceMap]);

  const totalCollected = filtered.reduce((s, r: any) => s + Number(r.payment_amount ?? 0), 0);
  const totalRemaining = filtered.reduce((s, r: any) => s + Number(r.remaining_amount ?? 0), 0);

  async function exportXlsx() {
    const data = filtered.map((r: any) => ({
      Tarih: new Date(r.starts_at).toLocaleString("tr-TR"),
      Salon: r.barbershops?.name ?? "—",
      Müşteri: r.profiles?.full_name ?? "—",
      Telefon: r.profiles?.phone ?? "—",
      Hizmetler: (r.service_ids ?? []).map((id: string) => serviceMap?.get(id)?.name ?? "—").join(", "),
      Ödeme_Şekli: r.payment_method === "deposit" ? "%25 Kapora" : "Tamamı",
      Sistemden_Ödenen: Number(r.payment_amount ?? 0),
      Salonda_Ödenecek: Number(r.remaining_amount ?? 0),
      Durum: r.status,
      Not: r.notes ?? "",
    }));
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Salon");
    XLSX.writeFile(wb, `salon-randevu-${Date.now()}.xlsx`);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <div>
          <Label className="text-xs">Salon</Label>
          <Select value={shopFilter} onValueChange={setShopFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL"><Store className="inline h-3.5 w-3.5 mr-1" /> Tüm Salonlar</SelectItem>
              {shops.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Başlangıç</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Bitiş</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div><Label className="text-xs">Müşteri / Hizmet ara</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad veya hizmet" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Sırala</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Tarihe göre</SelectItem>
                <SelectItem value="service">Hizmete göre</SelectItem>
                <SelectItem value="amount">Tutara göre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Yön</Label>
            <Button variant="outline" className="w-full" onClick={() => setAsc((v) => !v)}>
              <ArrowUpDown className="h-4 w-4 mr-1" /> {asc ? "Artan" : "Azalan"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Randevu</p>
          <p className="font-display text-xl">{filtered.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Sistemden</p>
          <p className="font-display text-xl text-primary">{totalCollected.toFixed(0)}₺</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-2 text-center">
          <p className="text-[10px] text-muted-foreground">Salonda</p>
          <p className="font-display text-xl">{totalRemaining.toFixed(0)}₺</p>
        </div>
      </div>

      <Button onClick={exportXlsx} variant="outline" className="w-full" disabled={filtered.length === 0}>
        <Download className="h-4 w-4 mr-1" /> Excel olarak indir
      </Button>

      <div className="space-y-2">
        {filtered.map((r: any) => {
          const d = new Date(r.starts_at);
          const names = (r.service_ids ?? []).map((id: string) => serviceMap?.get(id)?.name ?? "—").join(", ");
          const total = Number(r.payment_amount ?? 0) + Number(r.remaining_amount ?? 0);
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3 text-xs space-y-1">
              <div className="flex justify-between gap-2">
                <p className="font-semibold text-sm truncate">{r.profiles?.full_name ?? "—"}</p>
                <p className="font-display text-primary text-base">{total.toFixed(0)}₺</p>
              </div>
              <p className="text-muted-foreground">📞 {r.profiles?.phone ?? "—"}</p>
              <p>🗓 {d.toLocaleDateString("tr-TR")} · {d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</p>
              <p>✂️ {names || "—"}</p>
              <p className="text-[11px]">🏪 {r.barbershops?.name ?? "—"}</p>
              {r.notes && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-2 mt-1">
                  <p className="text-[10px] uppercase tracking-wider text-primary mb-0.5">Müşteri Notu</p>
                  <p className="text-[12px] whitespace-pre-wrap">{r.notes}</p>
                </div>
              )}
              <div className="flex gap-2 pt-1 flex-wrap">
                <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-bold">
                  Sistemden: {Number(r.payment_amount ?? 0).toFixed(0)}₺
                </span>
                {Number(r.remaining_amount ?? 0) > 0 && (
                  <span className="rounded-full bg-amber-500/15 text-amber-500 px-2 py-0.5 text-[10px] font-bold">
                    Salonda: {Number(r.remaining_amount ?? 0).toFixed(0)}₺
                  </span>
                )}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider">{r.status}</span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Kayıt bulunamadı.</p>}
      </div>
    </div>
  );
}

/* ============ WORKING HOURS ============ */
const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

type HourRow = { id?: string; weekday: number; is_open: boolean; open_time: string; close_time: string };

function defaultHours(): HourRow[] {
  return DAYS.map((_, weekday) => ({ weekday, is_open: weekday !== 0, open_time: "09:00", close_time: "19:00" }));
}

function WorkingHoursTab({ shopId }: { shopId: string }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<HourRow[]>(defaultHours());

  const { data } = useQuery({
    queryKey: ["shop-hours", shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_working_hours")
        .select("id, weekday, is_open, open_time, close_time")
        .eq("shop_id", shopId)
        .order("weekday");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const byDay = new Map((data ?? []).map((r: any) => [r.weekday, r]));
    setRows(defaultHours().map((d) => ({ ...d, ...(byDay.get(d.weekday) ?? {}) })));
  }, [data, shopId]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = rows.map((r) => ({
        shop_id: shopId,
        weekday: r.weekday,
        is_open: r.is_open,
        open_time: r.open_time,
        close_time: r.close_time,
      }));
      const { error } = await supabase.from("shop_working_hours").upsert(payload, { onConflict: "shop_id,weekday" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Çalışma saatleri kaydedildi"); qc.invalidateQueries({ queryKey: ["shop-hours", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function update(day: number, patch: Partial<HourRow>) {
    setRows((arr) => arr.map((r) => r.weekday === day ? { ...r, ...patch } : r));
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      <p className="font-display text-sm flex items-center gap-1"><Clock className="h-4 w-4 text-primary" /> Çalışma Günleri ve Saatleri</p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.weekday} className="rounded-lg border border-border p-2 space-y-2">
            <label className="flex items-center justify-between gap-2 text-sm font-medium">
              <span>{DAYS[r.weekday]}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                Açık
                <input type="checkbox" checked={r.is_open} onChange={(e) => update(r.weekday, { is_open: e.target.checked })} />
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="time" value={r.open_time.slice(0, 5)} disabled={!r.is_open} onChange={(e) => update(r.weekday, { open_time: e.target.value })} />
              <Input type="time" value={r.close_time.slice(0, 5)} disabled={!r.is_open} onChange={(e) => update(r.weekday, { close_time: e.target.value })} />
            </div>
          </div>
        ))}
      </div>
      <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
        <Save className="h-4 w-4 mr-1" /> Saatleri Kaydet
      </Button>
    </div>
  );
}

/* ============ SHOP INFO ============ */
type ShopRow = {
  id: string; name: string; description: string | null; address: string | null;
  phone: string | null; lat: number | null; lng: number | null;
  category: string | null; cover_image_url: string | null;
  city: string | null; slot_capacity?: number | null;
};


async function uploadImage(file: File, folder: string): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user!.id;
  const path = `${userId}/${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from("barbershop-photos").upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data: pub } = supabase.storage.from("barbershop-photos").getPublicUrl(path);
  return pub.publicUrl;
}

/* ============ VIRTUAL POS ============ */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { createPaytrIframeToken, createPaytrLink } from "@/lib/paytr.functions";
import { Link as LinkIcon, ExternalLink, Copy } from "lucide-react";

function VirtualPosTab({ shopId }: { shopId: string }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [description, setDescription] = useState("");
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"iframe" | "link" | null>(null);
  const createIframe = useServerFn(createPaytrIframeToken);
  const createLink = useServerFn(createPaytrLink);

  const { data: services } = useQuery({
    queryKey: ["pos-services", shopId],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name, price").eq("shop_id", shopId).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: charges } = useQuery({
    queryKey: ["pos-charges", shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("virtual_pos_charges")
        .select("id, amount, customer_name, customer_phone, description, status, created_at, service_ids")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });


  function toggle(id: string, price: number) {
    setSelected((arr) => {
      const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
      if (!amount) {
        const total = (services ?? []).filter((s) => next.includes(s.id)).reduce((sum, s) => sum + Number(s.price ?? 0), 0);
        if (total > 0) setAmount(String(total));
      } else if (!arr.includes(id) && Number(amount) === 0) setAmount(String(price));
      return next;
    });
  }

  const serviceNames = new Map((services ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/30 bg-card p-3 space-y-3">
        <p className="font-display text-sm flex items-center gap-1"><CreditCard className="h-4 w-4 text-primary" /> Sanal POS Çekimi</p>
        <div className="space-y-2">
          <Label className="text-xs">Hizmet Seç</Label>
          {(services ?? []).map((s) => (
            <button key={s.id} type="button" onClick={() => toggle(s.id, Number(s.price ?? 0))}
              className={cn("w-full rounded-lg border p-2 text-left text-sm flex justify-between gap-2", selected.includes(s.id) ? "border-primary bg-primary/5" : "border-border")}> 
              <span>{selected.includes(s.id) ? "✓ " : ""}{s.name}</span>
              <span className="font-semibold text-primary">{Number(s.price ?? 0).toFixed(0)}₺</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Müşteri Adı</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
          <div><Label className="text-xs">Telefon</Label><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
        </div>
        <div><Label className="text-xs">E-posta (PayTR fişi için önerilir)</Label><Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="opsiyonel" /></div>
        <div><Label className="text-xs">Manuel Tutar (₺)</Label><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9,.]/g, ""))} /></div>
        <div><Label className="text-xs">Açıklama</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="grid grid-cols-1 gap-2">
          <Button
            className="w-full"
            disabled={busy !== null}
            onClick={async () => {
              const value = Number(amount.replace(",", "."));
              if (!value || value <= 0) { toast.error("Tutar gir"); return; }
              setBusy("iframe");
              try {
                const res = await createIframe({ data: {
                  shopId, amount: value, serviceIds: selected,
                  customerName: customerName.trim() || null,
                  customerPhone: customerPhone.trim() || null,
                  customerEmail: customerEmail.trim() || null,
                  description: description.trim() || null,
                } });
                setIframeUrl(res.iframeUrl);
                qc.invalidateQueries({ queryKey: ["pos-charges", shopId] });
              } catch (e) { toast.error((e as Error).message); }
              finally { setBusy(null); }
            }}
          >
            <CreditCard className="h-4 w-4 mr-1" /> {busy === "iframe" ? "PayTR açılıyor..." : "PayTR ile Kartla Öde (iFrame)"}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            disabled={busy !== null}
            onClick={async () => {
              const value = Number(amount.replace(",", "."));
              if (!value || value <= 0) { toast.error("Tutar gir"); return; }
              setBusy("link");
              try {
                const res = await createLink({ data: {
                  shopId, amount: value, serviceIds: selected,
                  customerName: customerName.trim() || null,
                  customerPhone: customerPhone.trim() || null,
                  customerEmail: customerEmail.trim() || null,
                  description: description.trim() || null,
                } });
                setLinkUrl(res.url);
                qc.invalidateQueries({ queryKey: ["pos-charges", shopId] });
              } catch (e) { toast.error((e as Error).message); }
              finally { setBusy(null); }
            }}
          >
            <LinkIcon className="h-4 w-4 mr-1" /> {busy === "link" ? "Link oluşturuluyor..." : "PayTR Ödeme Linki Oluştur"}
          </Button>
        </div>
      </div>

      <Dialog open={!!iframeUrl} onOpenChange={(v) => !v && setIframeUrl(null)}>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="p-3">
            <DialogTitle>PayTR Ödeme</DialogTitle>
            <DialogDescription>Kart bilgisini güvenli PayTR formunda gir. Ödeme tamamlandığında kayıt otomatik "paid" olur.</DialogDescription>
          </DialogHeader>
          {iframeUrl && (
            <iframe src={iframeUrl} className="w-full" style={{ height: "70vh", border: 0 }} allow="payment" />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkUrl} onOpenChange={(v) => !v && setLinkUrl(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ödeme Linki Hazır</DialogTitle>
            <DialogDescription>Bu linki müşteriye WhatsApp / SMS ile gönder. Ödeme yapıldığında kayıt otomatik güncellenir.</DialogDescription>
          </DialogHeader>
          {linkUrl && (
            <div className="space-y-2">
              <Input readOnly value={linkUrl} onFocus={(e) => e.currentTarget.select()} />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(linkUrl); toast.success("Kopyalandı"); }}>
                  <Copy className="h-4 w-4 mr-1" /> Kopyala
                </Button>
                <Button asChild>
                  <a href={linkUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" /> Aç</a>
                </Button>
              </div>
              {customerPhone.trim() && (
                <Button variant="secondary" className="w-full" asChild>
                  <a href={`https://wa.me/${customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent("Ödeme linki: " + linkUrl)}`} target="_blank" rel="noreferrer">
                    WhatsApp ile Gönder
                  </a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        {(charges ?? []).map((c: any) => (
          <div key={c.id} className="rounded-xl border border-border bg-card p-3 text-xs space-y-1">
            <div className="flex justify-between gap-2">
              <p className="font-semibold text-sm truncate">{c.customer_name || "Müşteri"}</p>
              <p className="font-display text-primary text-base">{Number(c.amount ?? 0).toFixed(0)}₺</p>
            </div>
            {c.customer_phone && <p className="text-muted-foreground">📞 {c.customer_phone}</p>}
            <p>{(c.service_ids ?? []).map((id: string) => serviceNames.get(id) ?? "Hizmet").join(", ") || "Manuel çekim"}</p>
            {c.description && <p className="text-muted-foreground">{c.description}</p>}
            <p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString("tr-TR")} · {c.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShopInfoTab({ shop }: { shop: ShopRow }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: shop.name, description: shop.description ?? "", address: shop.address ?? "",
    phone: shop.phone ?? "", lat: shop.lat ?? "" as number | string, lng: shop.lng ?? "" as number | string,
    city: shop.city ?? "", cover_image_url: shop.cover_image_url ?? "",
    slot_capacity: shop.slot_capacity ?? 1,
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("barbershops").update({
        name: form.name, description: form.description || undefined, address: form.address || undefined,
        phone: form.phone || undefined,
        lat: form.lat === "" ? null : Number(form.lat),
        lng: form.lng === "" ? null : Number(form.lng),
        city: form.city || null,
        cover_image_url: form.cover_image_url || null,
        slot_capacity: Math.max(1, Number(form.slot_capacity) || 1),
      }).eq("id", shop.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Salon güncellendi"); qc.invalidateQueries({ queryKey: ["owner-shops"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try { const url = await uploadImage(file, "covers"); setForm((f) => ({ ...f, cover_image_url: url })); toast.success("Kapak yüklendi"); }
    catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <div>
          <Label className="text-xs">Kapak Fotoğrafı</Label>
          <div className="flex gap-2 items-center mt-1">
            {form.cover_image_url && <SafeImg src={form.cover_image_url} alt="" className="h-16 w-16 rounded-lg object-cover" />}
            <label className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border border-dashed border-primary/40 cursor-pointer text-sm">
              <Upload className="h-4 w-4" /> Yükle
              <input type="file" accept="image/*" className="hidden" onChange={onCoverChange} />
            </label>
          </div>
        </div>
        <div><Label className="text-xs">Salon Adı</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label className="text-xs">Açıklama</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
        <div><Label className="text-xs">Adres</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div>
          <Label className="text-xs">Şehir</Label>
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div><Label className="text-xs">Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Enlem</Label><Input value={String(form.lat)} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></div>
          <div><Label className="text-xs">Boylam</Label><Input value={String(form.lng)} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></div>
        </div>
        <div>
          <Label className="text-xs">Aynı Saat Diliminde Maks. Randevu Sayısı</Label>
          <Input type="number" min={1} value={String(form.slot_capacity)} onChange={(e) => setForm({ ...form, slot_capacity: Number(e.target.value) || 1 })} />
          <p className="text-[10px] text-muted-foreground mt-1">Örn. "1" yazarsan aynı saate sadece 1 müşteri randevu alabilir; dolduğunda o saat pasif gözükür.</p>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
          <Save className="h-4 w-4 mr-1" /> Kaydet
        </Button>
      </div>
    </div>
  );
}


/* ============ SERVICES ============ */
type ServiceForm = { id?: string; name: string; description: string; duration_min: number; price: number };

function ServicesTab({ shopId }: { shopId: string }) {
  const qc = useQueryClient();
  const { data: services } = useQuery({
    queryKey: ["mgmt-services", shopId],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("shop_id", shopId).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [draft, setDraft] = useState<ServiceForm>({ name: "", description: "", duration_min: 30, price: 0 });

  const save = useMutation({
    mutationFn: async (s: ServiceForm) => {
      if (s.id) {
        const { error } = await supabase.from("services").update({
          name: s.name, description: s.description || null, duration_min: s.duration_min, price: s.price,
        }).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert({
          shop_id: shopId, name: s.name, description: s.description || null, duration_min: s.duration_min, price: s.price,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Kaydedildi"); setDraft({ name: "", description: "", duration_min: 30, price: 0 }); qc.invalidateQueries({ queryKey: ["mgmt-services", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Silindi"); qc.invalidateQueries({ queryKey: ["mgmt-services", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/30 bg-card p-3 space-y-2">
        <p className="font-display text-sm flex items-center gap-1"><Plus className="h-4 w-4" /> Yeni Hizmet</p>
        <Input placeholder="Hizmet adı" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <Textarea placeholder="Açıklama" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} />
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Süre (dk)</Label><Input type="number" value={draft.duration_min} onChange={(e) => setDraft({ ...draft, duration_min: Number(e.target.value) })} /></div>
          <div><Label className="text-xs">Fiyat (₺)</Label><Input type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></div>
        </div>
        <Button onClick={() => save.mutate(draft)} disabled={!draft.name || save.isPending} className="w-full">Ekle</Button>
      </div>

      <div className="space-y-2">
        {(services ?? []).map((s) => (
          <ServiceRow key={s.id} initial={s} onSave={(d) => save.mutate({ ...d, id: s.id })} onDelete={() => del.mutate(s.id)} />
        ))}
        {(services?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground text-center py-4">Hizmet yok.</p>}
      </div>
    </div>
  );
}

function ServiceRow({ initial, onSave, onDelete }: { initial: any; onSave: (d: ServiceForm) => void; onDelete: () => void }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<ServiceForm>({
    name: initial.name, description: initial.description ?? "",
    duration_min: Number(initial.duration_min ?? 30), price: Number(initial.price ?? 0),
  });
  if (!edit) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{initial.name}</p>
          <p className="text-xs text-muted-foreground">{initial.duration_min} dk · {Number(initial.price).toFixed(0)}₺</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEdit(true)}>Düzenle</Button>
        <Button size="sm" variant="destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-primary/30 bg-card p-3 space-y-2">
      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })} />
        <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { onSave(form); setEdit(false); }} className="flex-1"><Save className="h-3.5 w-3.5 mr-1" /> Kaydet</Button>
        <Button size="sm" variant="outline" onClick={() => setEdit(false)}><X className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

/* ============ STAFF ============ */
type StaffForm = { id?: string; name: string; title: string; photo_url: string };

function StaffTab({ shopId }: { shopId: string }) {
  const qc = useQueryClient();
  const { data: staff } = useQuery({
    queryKey: ["mgmt-staff", shopId],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").eq("shop_id", shopId).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [draft, setDraft] = useState<StaffForm>({ name: "", title: "", photo_url: "" });

  const save = useMutation({
    mutationFn: async (s: StaffForm) => {
      if (s.id) {
        const { error } = await supabase.from("staff").update({ name: s.name, title: s.title || null, photo_url: s.photo_url || null }).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("staff").insert({ shop_id: shopId, name: s.name, title: s.title || null, photo_url: s.photo_url || null });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Kaydedildi"); setDraft({ name: "", title: "", photo_url: "" }); qc.invalidateQueries({ queryKey: ["mgmt-staff", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("staff").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Silindi"); qc.invalidateQueries({ queryKey: ["mgmt-staff", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try { const url = await uploadImage(file, "staff"); setDraft((d) => ({ ...d, photo_url: url })); toast.success("Foto yüklendi"); }
    catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/30 bg-card p-3 space-y-2">
        <p className="font-display text-sm flex items-center gap-1"><Plus className="h-4 w-4" /> Yeni Çalışan</p>
        <div className="flex gap-2 items-center">
          {draft.photo_url && <SafeImg src={draft.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" />}
          <label className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border border-dashed border-primary/40 cursor-pointer text-sm">
            <Upload className="h-4 w-4" /> Foto
            <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
          </label>
        </div>
        <Input placeholder="Ad Soyad" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <Input placeholder="Unvan (ör. Berber)" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <Button onClick={() => save.mutate(draft)} disabled={!draft.name || save.isPending} className="w-full">Ekle</Button>
      </div>

      <div className="space-y-2">
        {(staff ?? []).map((s) => (
          <StaffRow key={s.id} initial={s} onSave={(d) => save.mutate({ ...d, id: s.id })} onDelete={() => del.mutate(s.id)} />
        ))}
        {(staff?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground text-center py-4">Çalışan yok.</p>}
      </div>
    </div>
  );
}

function StaffRow({ initial, onSave, onDelete }: { initial: any; onSave: (d: StaffForm) => void; onDelete: () => void }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<StaffForm>({ name: initial.name, title: initial.title ?? "", photo_url: initial.photo_url ?? "" });

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try { const url = await uploadImage(file, "staff"); setForm((f) => ({ ...f, photo_url: url })); toast.success("Foto yüklendi"); }
    catch (err: any) { toast.error(err.message); }
  }

  if (!edit) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
        {initial.photo_url
          ? <SafeImg src={initial.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
          : <div className="h-12 w-12 rounded-full bg-primary/15" />}
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{initial.name}</p>
          <p className="text-xs text-muted-foreground truncate">{initial.title ?? ""}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEdit(true)}>Düzenle</Button>
        <Button size="sm" variant="destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-primary/30 bg-card p-3 space-y-2">
      <div className="flex gap-2 items-center">
        {form.photo_url && <SafeImg src={form.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" />}
        <label className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border border-dashed border-primary/40 cursor-pointer text-sm">
          <Upload className="h-4 w-4" /> Foto değiştir
          <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
        </label>
      </div>
      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { onSave(form); setEdit(false); }} className="flex-1"><Save className="h-3.5 w-3.5 mr-1" /> Kaydet</Button>
        <Button size="sm" variant="outline" onClick={() => setEdit(false)}><X className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

const PLAN_SLOTS = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"];

function ReservationPlanTab({ shopId }: { shopId: string }) {
  const qc = useQueryClient();
  const today = new Date();
  const [date, setDate] = useState<string>(() => {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });

  const { data: overrides } = useQuery({
    queryKey: ["slot-overrides", shopId, date],
    queryFn: async () => {
      const { data } = await supabase.from("slot_overrides" as never)
        .select("slot_time, is_active")
        .eq("shop_id", shopId)
        .eq("date", date);
      return (data as { slot_time: string; is_active: boolean }[] | null) ?? [];
    },
  });

  const map = useMemo(() => {
    const m = new Map<string, boolean>();
    (overrides ?? []).forEach((o) => m.set(o.slot_time.slice(0, 5), o.is_active));
    return m;
  }, [overrides]);

  const toggle = useMutation({
    mutationFn: async (slot: string) => {
      const current = map.has(slot) ? map.get(slot)! : true;
      const next = !current;
      const { error } = await supabase.from("slot_overrides" as never).upsert({
        shop_id: shopId, date, slot_time: slot + ":00", is_active: next,
      } as never, { onConflict: "shop_id,date,slot_time" });
      if (error) throw error;
      return next;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["slot-overrides", shopId, date] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <WeeklyCalendarView shopId={shopId} />

      <div className="pt-3 border-t border-border space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <Label className="text-xs mb-0">Slot açma/kapama · Tarih</Label>
          <Input type="date" className="flex-1" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">
          Seçili tarihte saatlere tıklayarak açık/kapalı yapabilirsin. Kapalı saatler müşterilere seçim ekranında gizlenir.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {PLAN_SLOTS.map((s) => {
            const isActive = map.has(s) ? map.get(s)! : true;
            return (
              <button
                key={s}
                onClick={() => toggle.mutate(s)}
                className={cn(
                  "rounded-lg border py-2.5 text-sm font-medium active:scale-95 transition",
                  isActive
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground line-through opacity-70",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeeklyCalendarView({ shopId }: { shopId: string }) {
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=Sun, 1=Mon
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  }), [weekStart]);
  const rangeStart = weekStart.toISOString();
  const rangeEnd = new Date(weekStart.getTime() + 7 * 86400000).toISOString();

  const { data: appts } = useQuery({
    queryKey: ["weekly-appts", shopId, rangeStart],
    queryFn: async () => {
      const { data } = await supabase.from("appointments")
        .select("id, starts_at, status")
        .eq("shop_id", shopId)
        .neq("status", "cancelled")
        .gte("starts_at", rangeStart)
        .lt("starts_at", rangeEnd);
      return data ?? [];
    },
  });

  const bookedMap = useMemo(() => {
    const m = new Map<string, number>();
    (appts ?? []).forEach((a) => {
      const d = new Date(a.starts_at);
      const key = `${d.toISOString().slice(0, 10)}_${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    });
    return m;
  }, [appts]);

  const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">Haftalık Takvim</h3>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}>‹</Button>
          <span className="text-xs px-2 min-w-[110px] text-center">
            {weekStart.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} – {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
          </span>
          <Button size="sm" variant="outline" onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}>›</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr>
              <th className="p-1 border border-border bg-muted/40 sticky left-0"></th>
              {days.map((d, i) => {
                const key = d.toISOString().slice(0, 10);
                const isToday = key === todayKey;
                return (
                  <th key={i} className={cn("p-1 border border-border font-semibold", isToday ? "bg-primary/20 text-primary" : "bg-muted/40")}>
                    <div>{DAY_NAMES[i]}</div>
                    <div className="text-[9px] font-normal opacity-70">{d.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((h) => (
              <tr key={h}>
                <td className="p-1 border border-border bg-muted/40 font-mono text-center sticky left-0">{h}</td>
                {days.map((d, i) => {
                  const dayKey = d.toISOString().slice(0, 10);
                  const key = `${dayKey}_${h}`;
                  const key30 = `${dayKey}_${h.slice(0, 3)}30`;
                  const count = (bookedMap.get(key) ?? 0) + (bookedMap.get(key30) ?? 0);
                  return (
                    <td key={i} className={cn(
                      "p-1 border border-border text-center h-8",
                      count === 0 && "bg-transparent",
                      count === 1 && "bg-amber-500/20 text-amber-600 font-semibold",
                      count >= 2 && "bg-primary/30 text-primary font-bold",
                    )}>
                      {count > 0 ? count : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-500/20 border border-border" /> 1 randevu</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-primary/30 border border-border" /> 2+ randevu</span>
      </div>
    </div>
  );
}


