import { SafeImg } from "@/components/SafeImg";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { DB_CATEGORIES, type ShopCategory } from "@/lib/categories";
import { toast } from "sonner";
import { Trash2, Plus, Upload, Star, TrendingUp, CalendarDays, XCircle, Download, Megaphone, Settings, Activity, Send, Receipt, Ticket } from "lucide-react";
import { adminUpdateUser } from "@/lib/admin-users.functions";
import { adminBroadcast } from "@/lib/admin-broadcast.functions";
import { MiniMap } from "@/components/MiniMap";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isAdminOrOwner = roles?.some((r) => r.role === "admin" || r.role === "owner");
    if (!isAdminOrOwner) throw redirect({ to: "/" });
  },
  component: AdminPanel,
});

function AdminPanel() {
  return (
    <AppShell>
      <BackButton to="/" />
      <header className="px-4 pt-4 pb-3">
        <h1 className="font-display text-3xl">Yönetici Paneli</h1>
        <p className="text-xs text-muted-foreground">Salonlar, hizmetler, üyeler, duyurular ve istatistikler</p>
      </header>
      <Tabs defaultValue="stats" className="px-4">
        <TabsList className="grid grid-cols-4 w-full mb-2">
          <TabsTrigger value="stats">📊</TabsTrigger>
          <TabsTrigger value="shops">Salon</TabsTrigger>
          <TabsTrigger value="services">Hizmet</TabsTrigger>
          <TabsTrigger value="staff">Çalışan</TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="users">Üye</TabsTrigger>
          <TabsTrigger value="ann"><Megaphone className="h-3.5 w-3.5" /></TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-3.5 w-3.5" /></TabsTrigger>
          <TabsTrigger value="activity"><Activity className="h-3.5 w-3.5" /></TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-3 w-full mt-2">
          <TabsTrigger value="broadcast"><Send className="h-3.5 w-3.5 mr-1" /> Push</TabsTrigger>
          <TabsTrigger value="acct"><Receipt className="h-3.5 w-3.5 mr-1" /> Muhasebe</TabsTrigger>
          <TabsTrigger value="discounts"><Ticket className="h-3.5 w-3.5 mr-1" /> Kupon</TabsTrigger>
        </TabsList>
        <TabsContent value="stats"><StatsTab /></TabsContent>
        <TabsContent value="shops"><ShopsTab /></TabsContent>
        <TabsContent value="services"><ServicesTab /></TabsContent>
        <TabsContent value="staff"><StaffTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="ann"><AnnouncementsTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="activity"><ActivityTab /></TabsContent>
        <TabsContent value="broadcast"><BroadcastTab /></TabsContent>
        <TabsContent value="acct"><AccountingTab /></TabsContent>
        <TabsContent value="discounts"><DiscountsTab /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

const PERIODS = [
  { key: "1d", label: "Günlük", days: 1 },
  { key: "7d", label: "Haftalık", days: 7 },
  { key: "30d", label: "Aylık", days: 30 },
  { key: "90d", label: "3 Aylık", days: 90 },
  { key: "180d", label: "6 Aylık", days: 180 },
  { key: "365d", label: "Yıllık", days: 365 },
] as const;

function StatsTab() {
  const [period, setPeriod] = useState<typeof PERIODS[number]>(PERIODS[2]);
  const since = new Date(Date.now() - period.days * 86400_000).toISOString();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats", period.key],
    queryFn: async () => {
      const { data: appts } = await supabase
        .from("appointments")
        .select("id, status, payment_amount, created_at")
        .gte("created_at", since);
      const list = appts ?? [];
      const total = list.length;
      const cancelled = list.filter((a) => a.status === "cancelled").length;
      const confirmed = list.filter((a) => a.status === "confirmed" || a.status === "completed").length;
      const revenue = list
        .filter((a) => a.status === "confirmed" || a.status === "completed")
        .reduce((s, a) => s + Number(a.payment_amount ?? 0), 0);
      return { total, cancelled, confirmed, revenue };
    },
  });

  return (
    <div className="py-4 space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setPeriod(p)}
            className={`rounded-full border px-3 py-1.5 text-xs active:scale-95 transition ${period.key === p.key ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card"}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={TrendingUp} label="Ciro" value={`${(stats?.revenue ?? 0).toFixed(0)}₺`} accent />
        <StatCard icon={CalendarDays} label="Randevu" value={stats?.total ?? 0} />
        <StatCard icon={Star} label="Onaylı" value={stats?.confirmed ?? 0} />
        <StatCard icon={XCircle} label="İptal" value={stats?.cancelled ?? 0} />
      </div>
      <p className="text-[11px] text-muted-foreground text-center pt-2">{period.label} • son {period.days} gün</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Star; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-primary/40 bg-gradient-to-br from-primary/15 to-transparent" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div>
      <p className="font-display text-3xl mt-1">{value}</p>
    </div>
  );
}

async function uploadPhoto(file: File, prefix: string): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const ext = file.name.split(".").pop();
  const path = `${u.user!.id}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("barbershop-photos").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("barbershop-photos").getPublicUrl(path);
  return data.publicUrl;
}

function ShopsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ id?: string; name: string; category: ShopCategory; description: string; address: string; city: string; phone: string; lat: string; lng: string; cover_image_url: string; is_featured: boolean; allow_full_payment: boolean; allow_deposit_payment: boolean } | null>(null);

  const [search, setSearch] = useState("");
  const [filterCity, setFilterCity] = useState<string>("ALL");
  const { data: shops } = useQuery({
    queryKey: ["admin-shops"],
    queryFn: async () => (await supabase.from("barbershops").select("*").order("name", { ascending: true })).data ?? [],
  });
  const cities = Array.from(new Set((shops ?? []).map((s) => (s.city ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr"));
  const norm = (x: string) => x.toLocaleLowerCase("tr-TR");
  const filteredShops = (shops ?? []).filter((s) => {
    if (filterCity !== "ALL" && (s.city ?? "") !== filterCity) return false;
    if (!search.trim()) return true;
    const q = norm(search);
    return norm(s.name).includes(q) || norm(s.address ?? "").includes(q) || norm(s.city ?? "").includes(q);
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { data: u } = await supabase.auth.getUser();
      const lat = editing.lat ? parseFloat(editing.lat) : null;
      const lng = editing.lng ? parseFloat(editing.lng) : null;
      const payload = {
        name: editing.name,
        category: editing.category,
        description: editing.description || null,
        address: editing.address,
        city: editing.city || null,
        phone: editing.phone || null,
        lat: lat != null && !isNaN(lat) ? lat : null,
        lng: lng != null && !isNaN(lng) ? lng : null,
        cover_image_url: editing.cover_image_url || null,
        is_featured: editing.is_featured,
        allow_full_payment: editing.allow_full_payment,
        allow_deposit_payment: editing.allow_deposit_payment,
      };
      if (editing.id) {
        const { error } = await supabase.from("barbershops").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("barbershops").insert({ ...payload, owner_id: u.user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Kaydedildi"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-shops"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleFeatured = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase.from("barbershops").update({ is_featured: val }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-shops"] }); toast.success("Güncellendi"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("barbershops").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Silindi"); qc.invalidateQueries({ queryKey: ["admin-shops"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (editing) {
    return (
      <div className="space-y-3 py-4">
        <div><Label>Salon Adı</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
        <div><Label>Kategori</Label>
          <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v as ShopCategory })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DB_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Açıklama</Label><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
        <div><Label>Adres</Label><Input value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
        <div><Label>İl</Label><Input value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} placeholder="Alanya / Antalya / İstanbul..." /></div>
        <div><Label>Telefon</Label><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Enlem (lat)</Label><Input type="text" inputMode="text" value={editing.lat} onChange={(e) => setEditing({ ...editing, lat: e.target.value.replace(",", ".").replace(/[^0-9.\-]/g, "") })} placeholder="36.5444" /></div>
          <div><Label>Boylam (lng)</Label><Input type="text" inputMode="text" value={editing.lng} onChange={(e) => setEditing({ ...editing, lng: e.target.value.replace(",", ".").replace(/[^0-9.\-]/g, "") })} placeholder="31.9968" /></div>
        </div>
        {(() => {
          const la = parseFloat(editing.lat), ln = parseFloat(editing.lng);
          if (isNaN(la) || isNaN(ln)) return <p className="text-[10px] text-muted-foreground">Enlem/boylam girince harita önizlemesi burada görünür.</p>;
          return <MiniMap lat={la} lng={ln} name={editing.name || "Konum"} />;
        })()}
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <Label className="!m-0">⭐ Öne Çıkan</Label>
          <Switch checked={editing.is_featured} onCheckedChange={(v) => setEditing({ ...editing, is_featured: v })} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <Label className="!m-0 text-sm">💳 Tamamı kartla ödeme aktif</Label>
          <Switch checked={editing.allow_full_payment} onCheckedChange={(v) => setEditing({ ...editing, allow_full_payment: v })} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <Label className="!m-0 text-sm">💵 Kapora + salonda nakit aktif</Label>
          <Switch checked={editing.allow_deposit_payment} onCheckedChange={(v) => setEditing({ ...editing, allow_deposit_payment: v })} />
        </div>
        <div>
          <Label>Kapak Fotoğrafı</Label>
          <div className="flex gap-2 items-center">
            {editing.cover_image_url && <SafeImg src={editing.cover_image_url} className="h-16 w-16 rounded object-cover" alt="" />}
            <label className="flex-1 cursor-pointer rounded-md border border-dashed border-border p-3 text-center text-xs">
              <Upload className="mx-auto h-4 w-4 mb-1" /> {editing.cover_image_url ? "Değiştir" : "Fotoğraf yükle"}
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                try { const url = await uploadPhoto(f, "shop-cover"); setEditing({ ...editing, cover_image_url: url }); toast.success("Yüklendi"); }
                catch (err) { toast.error((err as Error).message); }
              }} />
            </label>
            {editing.cover_image_url && (
              <Button size="icon" variant="destructive" onClick={() => setEditing({ ...editing, cover_image_url: "" })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {editing.id && <GalleryEditor shopId={editing.id} />}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => setEditing(null)} className="flex-1">İptal</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">Kaydet</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-3">
      <Button onClick={() => setEditing({ name: "", category: "male_barber", description: "", address: "", city: "Alanya", phone: "", lat: "", lng: "", cover_image_url: "", is_featured: false, allow_full_payment: true, allow_deposit_payment: true })} className="w-full">
        <Plus className="h-4 w-4 mr-1" /> Yeni Salon
      </Button>
      <div className="flex gap-2">
        <Input placeholder="Salon / adres ara…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={filterCity} onValueChange={setFilterCity}>
          <SelectTrigger className="w-36"><SelectValue placeholder="İl" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tüm iller</SelectItem>
            {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {filteredShops.map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-card p-3">
          <div className="flex justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold truncate">{s.name}</p>
                {s.is_featured && <Star className="h-3.5 w-3.5 fill-primary text-primary shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground truncate">{s.city ? `${s.city} · ` : ""}{s.address}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleFeatured.mutate({ id: s.id, val: !s.is_featured })}
                className={`text-[10px] rounded-full px-2 py-1 border active:scale-95 transition ${s.is_featured ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground"}`}>
                {s.is_featured ? "★ Öne Çıkan" : "Öne Çıkar"}
              </button>
              <Button size="sm" variant="ghost" onClick={() => setEditing({
                id: s.id, name: s.name, category: s.category, description: s.description ?? "",
                address: s.address, city: s.city ?? "", phone: s.phone ?? "",
                lat: s.lat != null ? String(s.lat) : "", lng: s.lng != null ? String(s.lng) : "",
                cover_image_url: s.cover_image_url ?? "", is_featured: s.is_featured ?? false,
                allow_full_payment: (s as any).allow_full_payment ?? true, allow_deposit_payment: (s as any).allow_deposit_payment ?? true,
              })}>Düzenle</Button>
              <Button size="icon" variant="ghost" onClick={() => confirm("Silinsin mi?") && del.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GalleryEditor({ shopId }: { shopId: string }) {
  const qc = useQueryClient();
  const { data: imgs } = useQuery({
    queryKey: ["shop-gallery", shopId],
    queryFn: async () => (await supabase.from("barbershop_images").select("id, url, sort_order").eq("shop_id", shopId).order("sort_order", { ascending: true })).data ?? [],
  });
  const [busy, setBusy] = useState(false);

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const startOrder = (imgs?.length ?? 0);
      const uploads = await Promise.all(Array.from(files).map(async (f, i) => {
        const url = await uploadPhoto(f, "shop-gallery");
        return { shop_id: shopId, url, sort_order: startOrder + i };
      }));
      const { error } = await supabase.from("barbershop_images").insert(uploads);
      if (error) throw error;
      toast.success(`${uploads.length} fotoğraf eklendi`);
      qc.invalidateQueries({ queryKey: ["shop-gallery", shopId] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("barbershop_images").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["shop-gallery", shopId] });
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <Label className="text-xs">📸 Galeri Fotoğrafları ({imgs?.length ?? 0})</Label>
      <p className="text-[10px] text-muted-foreground">Dükkan kapağında otomatik kayar. Birden çok dosya seçebilirsin.</p>
      <label className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 text-xs text-primary ${busy ? "opacity-50" : ""}`}>
        <Upload className="h-4 w-4" /> {busy ? "Yükleniyor…" : "Çoklu fotoğraf yükle"}
        <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }} />
      </label>
      {(imgs?.length ?? 0) > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {(imgs ?? []).map((g) => (
            <div key={g.id} className="relative aspect-square overflow-hidden rounded-md bg-muted">
              <SafeImg src={g.url} className="h-full w-full object-cover" alt="" />
              <button onClick={() => remove(g.id)} className="absolute top-0.5 right-0.5 rounded-full bg-destructive/90 text-white p-0.5 active:scale-90"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ServicesTab() {
  const qc = useQueryClient();
  const [shopId, setShopId] = useState<string>("");
  const [form, setForm] = useState({ name: "", description: "", duration_min: "30", price: "" });
  const [drafts, setDrafts] = useState<Record<string, { name: string; duration_min: string; price: string }>>({});
  const [search, setSearch] = useState("");

  const { data: shops } = useQuery({ queryKey: ["admin-shops-min"], queryFn: async () => (await supabase.from("barbershops").select("id, name").order("name")).data ?? [] });
  const { data: services } = useQuery({
    queryKey: ["admin-services", shopId], enabled: !!shopId,
    queryFn: async () => (await supabase.from("services").select("*").eq("shop_id", shopId).order("name")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("services").insert({
        shop_id: shopId, name: form.name, description: form.description || null,
        duration_min: parseInt(form.duration_min) || 30, price: parseFloat(form.price),
      });
      if (error) throw error;
    },
    onSuccess: () => { setForm({ name: "", description: "", duration_min: "30", price: "" }); qc.invalidateQueries({ queryKey: ["admin-services"] }); toast.success("Eklendi"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateRow = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { name?: string; duration_min?: number; price?: number } }) => {
      const { error } = await supabase.from("services").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-services"] }); toast.success("Güncellendi"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("services").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-services"] }),
  });

  const filteredServices = (services ?? []).filter((s) => !search.trim() || s.name.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR")));

  return (
    <div className="py-4 space-y-3">
      <Label>Salon Seç</Label>
      <Select value={shopId} onValueChange={setShopId}>
        <SelectTrigger><SelectValue placeholder="Salon seç..." /></SelectTrigger>
        <SelectContent>{(shops ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>
      {shopId && (
        <>
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <Input placeholder="Hizmet adı" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Textarea placeholder="Açıklama" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            <div className="flex gap-2">
              <Input placeholder="Süre (dk)" type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
              <Input placeholder="Fiyat (₺)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <Button onClick={() => add.mutate()} disabled={!form.name || !form.price} className="w-full">Ekle</Button>
          </div>
          <Input placeholder="Hizmet ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="space-y-2">
            {filteredServices.map((s) => {
              const d = drafts[s.id] ?? { name: s.name, duration_min: String(s.duration_min ?? ""), price: String(s.price ?? "") };
              const dirty = d.name !== s.name || parseFloat(d.price) !== Number(s.price) || parseInt(d.duration_min) !== Number(s.duration_min);
              const update = (patch: Partial<typeof d>) => setDrafts((m) => ({ ...m, [s.id]: { ...d, ...patch } }));
              return (
                <div key={s.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <Input value={d.name} onChange={(e) => update({ name: e.target.value })} placeholder="Hizmet adı" />
                  <div className="flex items-center gap-2">
                    <Label className="text-xs !m-0 text-muted-foreground w-12">Süre</Label>
                    <Input type="number" className="h-9 w-24" value={d.duration_min} onChange={(e) => update({ duration_min: e.target.value })} />
                    <Label className="text-xs !m-0 text-muted-foreground ml-2">Fiyat</Label>
                    <Input type="number" className="h-9 w-24" value={d.price} onChange={(e) => update({ price: e.target.value })} />
                    <span className="text-xs text-muted-foreground">₺</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" disabled={!dirty} onClick={() => updateRow.mutate({ id: s.id, patch: { name: d.name.trim(), duration_min: parseInt(d.duration_min) || 30, price: parseFloat(d.price) || 0 } })}>
                      Kaydet
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm("Silinsin mi?") && del.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
            {filteredServices.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">Hizmet bulunamadı.</p>}
          </div>
        </>
      )}
    </div>
  );
}

function StaffTab() {
  const qc = useQueryClient();
  const [shopId, setShopId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", title: "", photo_url: "" });

  const { data: shops } = useQuery({ queryKey: ["admin-shops-min2"], queryFn: async () => (await supabase.from("barbershops").select("id, name").order("name")).data ?? [] });
  const { data: staff } = useQuery({
    queryKey: ["admin-staff", shopId], enabled: !!shopId,
    queryFn: async () => (await supabase.from("staff").select("*").eq("shop_id", shopId).order("name")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff").insert({ shop_id: shopId, name: form.name, title: form.title || null, photo_url: form.photo_url || null });
      if (error) throw error;
    },
    onSuccess: () => { setForm({ name: "", title: "", photo_url: "" }); qc.invalidateQueries({ queryKey: ["admin-staff"] }); toast.success("Eklendi"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("staff").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-staff"] }),
  });

  return (
    <div className="py-4 space-y-3">
      <Label>Salon Seç</Label>
      <Select value={shopId} onValueChange={setShopId}>
        <SelectTrigger><SelectValue placeholder="Salon seç..." /></SelectTrigger>
        <SelectContent>{(shops ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>
      {shopId && (
        <>
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <Input placeholder="İsim" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Ünvan (örn. Usta Berber)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="flex gap-2 items-center">
              {form.photo_url && <SafeImg src={form.photo_url} className="h-12 w-12 rounded-full object-cover" alt="" />}
              <label className="flex-1 cursor-pointer rounded-md border border-dashed border-border p-2 text-center text-xs">
                <Upload className="mx-auto h-4 w-4 mb-1" /> Fotoğraf yükle
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  try { const url = await uploadPhoto(f, "staff"); setForm({ ...form, photo_url: url }); }
                  catch (err) { toast.error((err as Error).message); }
                }} />
              </label>
            </div>
            <Button onClick={() => add.mutate()} disabled={!form.name} className="w-full">Ekle</Button>
          </div>
          <Input placeholder="Çalışan ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="space-y-2">
            {(staff ?? []).filter((p) => !search.trim() || p.name.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR"))).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0">
                  {p.photo_url && <SafeImg src={p.photo_url} className="h-full w-full object-cover" alt="" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.name}</p>
                  {p.title && <p className="text-xs text-muted-foreground truncate">{p.title}</p>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const [shopId, setShopId] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: shops } = useQuery({
    queryKey: ["admin-shops-min3"],
    queryFn: async () => (await supabase.from("barbershops").select("id, name, owner_id")).data ?? [],
  });
  const shop = shops?.find((s) => s.id === shopId);

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles", search],
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, full_name, email, phone, is_blocked, last_ip, last_city, last_country, last_seen_at, points").order("full_name", { ascending: true, nullsFirst: false }).limit(200);
      if (search.trim()) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      return (await q).data ?? [];
    },
  });

  const { data: staffList } = useQuery({
    queryKey: ["admin-staff-users", shopId],
    enabled: !!shopId,
    queryFn: async () => (await supabase.from("staff").select("id, name, title, user_id").eq("shop_id", shopId)).data ?? [],
  });

  const ownerProfile = profiles?.find((p) => p.id === shop?.owner_id);

  const setOwner = useMutation({
    mutationFn: async (userId: string) => {
      const { error: e1 } = await supabase.from("barbershops").update({ owner_id: userId }).eq("id", shopId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("user_roles").upsert({ user_id: userId, role: "owner" }, { onConflict: "user_id,role" });
      if (e2) throw e2;
    },
    onSuccess: () => { toast.success("Salon sahibi atandı"); qc.invalidateQueries({ queryKey: ["admin-shops-min3"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkStaff = useMutation({
    mutationFn: async ({ staffId, userId }: { staffId: string; userId: string | null }) => {
      const { error: e1 } = await supabase.from("staff").update({ user_id: userId }).eq("id", staffId);
      if (e1) throw e1;
      if (userId) {
        const { error: e2 } = await supabase.from("user_roles").upsert({ user_id: userId, role: "staff" }, { onConflict: "user_id,role" });
        if (e2) throw e2;
      }
    },
    onSuccess: () => { toast.success("Çalışan eşleştirildi"); qc.invalidateQueries({ queryKey: ["admin-staff-users", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="py-4 space-y-3">
      <Label>Salon Seç</Label>
      <Select value={shopId} onValueChange={setShopId}>
        <SelectTrigger><SelectValue placeholder="Salon seç..." /></SelectTrigger>
        <SelectContent>{(shops ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>

      {shopId && (
        <>
          <div className="rounded-xl border border-primary/30 bg-card p-3">
            <p className="text-xs uppercase tracking-wider text-primary mb-1">Salon Sahibi</p>
            {ownerProfile
              ? <p className="text-sm">{ownerProfile.full_name} <span className="text-muted-foreground">· {ownerProfile.email}</span></p>
              : <p className="text-sm text-muted-foreground">Atanmamış</p>}
          </div>

          <Input placeholder="Üye ara (isim / e-posta / telefon)" value={search} onChange={(e) => setSearch(e.target.value)} />

          <p className="text-xs text-muted-foreground">Aşağıdan üye seç → Sahip / Çalışan ata veya bilgilerini düzenle</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(profiles ?? []).map((p) => (
              <UserRow key={p.id} profile={p} onAssignOwner={() => setOwner.mutate(p.id)} />
            ))}
          </div>

          {(staffList ?? []).length > 0 && (
            <>
              <p className="text-xs uppercase tracking-wider text-primary mt-4">Çalışan Eşleştirme</p>
              <div className="space-y-2">
                {(staffList ?? []).map((st) => {
                  const linked = profiles?.find((p) => p.id === st.user_id);
                  return (
                    <div key={st.id} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{st.name}</p>
                          {st.title && <p className="text-xs text-muted-foreground truncate">{st.title}</p>}
                        </div>
                        {st.user_id && <Button size="sm" variant="ghost" onClick={() => linkStaff.mutate({ staffId: st.id, userId: null })}>Bağı kaldır</Button>}
                      </div>
                      <p className="text-xs mt-1">
                        Üye: {linked ? <span className="text-primary">{linked.full_name ?? linked.email}</span> : <span className="text-muted-foreground">Yok</span>}
                      </p>
                      <Select onValueChange={(v) => linkStaff.mutate({ staffId: st.id, userId: v })}>
                        <SelectTrigger className="h-9 mt-2"><SelectValue placeholder="Üyeyi seç (aramayı kullan)" /></SelectTrigger>
                        <SelectContent>
                          {(profiles ?? []).slice(0, 20).map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

type ProfileLite = { id: string; full_name: string | null; email: string | null; phone: string | null; is_blocked?: boolean | null; last_ip?: string | null; last_city?: string | null; last_country?: string | null; last_seen_at?: string | null; points?: number | null };

function UserRow({ profile, onAssignOwner }: { profile: ProfileLite; onAssignOwner: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    password: "",
    points: String(profile.points ?? 0),
  });
  const updateFn = useServerFn(adminUpdateUser);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      await updateFn({
        data: {
          user_id: profile.id,
          full_name: form.full_name.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || null,
          password: form.password ? form.password : undefined,
        },
      });
      const newPoints = Math.max(0, parseInt(form.points || "0", 10) || 0);
      if (newPoints !== (profile.points ?? 0)) {
        const { error } = await supabase.from("profiles").update({ points: newPoints }).eq("id", profile.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Üye güncellendi");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleBlock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ is_blocked: !profile.is_blocked }).eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(profile.is_blocked ? "Engel kaldırıldı" : "Üye engellendi"); qc.invalidateQueries({ queryKey: ["admin-profiles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeUser = useMutation({
    mutationFn: async () => {
      const { adminDeleteUser } = await import("@/lib/admin-users.functions");
      await adminDeleteUser({ data: { user_id: profile.id } });
    },
    onSuccess: () => { toast.success("Üye silindi"); qc.invalidateQueries({ queryKey: ["admin-profiles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={`rounded-xl border p-3 ${profile.is_blocked ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
      <p className="font-medium text-sm">{profile.full_name ?? "—"} {profile.is_blocked && <span className="text-[10px] text-destructive">· ENGELLİ</span>}</p>
      <p className="text-xs text-muted-foreground truncate">{profile.email} {profile.phone && `· ${profile.phone}`}</p>
      <p className="text-[11px] text-primary font-semibold">🪙 {profile.points ?? 0} puan</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        IP: <span className="font-mono">{profile.last_ip ?? "-"}</span>
        {profile.last_city && ` · ${profile.last_city}`}
        {profile.last_country && ` / ${profile.last_country}`}
        {profile.last_seen_at && ` · ${new Date(profile.last_seen_at).toLocaleString("tr-TR")}`}
      </p>
      <div className="mt-2 flex gap-1.5 flex-wrap">
        <Button size="sm" variant="outline" className="flex-1" onClick={onAssignOwner}>Sahip yap</Button>
        <Button size="sm" className="flex-1" onClick={() => setOpen((o) => !o)}>{open ? "Kapat" : "Düzenle"}</Button>
        <Button size="sm" variant={profile.is_blocked ? "default" : "secondary"} onClick={() => toggleBlock.mutate()}>
          {profile.is_blocked ? "Engeli Kaldır" : "Engelle"}
        </Button>
        <Button size="icon" variant="destructive" onClick={() => confirm(`${profile.full_name ?? profile.email} silinsin mi? Geri alınamaz.`) && removeUser.mutate()}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div><Label className="text-xs">Ad Soyad</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><Label className="text-xs">E-posta</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label className="text-xs">Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label className="text-xs">Yeni Şifre (boş bırak = değişmez)</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="en az 4 karakter" /></div>
          <div><Label className="text-xs">🪙 Puan Bakiyesi</Label><Input type="number" min={0} value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} /></div>
          <Button size="sm" className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>Kaydet</Button>
        </div>
      )}
    </div>
  );
}

function AnnouncementsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", body: "" });
  const { data: list } = useQuery({
    queryKey: ["admin-anns"],
    queryFn: async () => (await supabase.from("announcements").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("announcements").insert({
        title: form.title, body: form.body, active: true, created_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setForm({ title: "", body: "" }); toast.success("Duyuru yayınlandı"); qc.invalidateQueries({ queryKey: ["admin-anns"] }); qc.invalidateQueries({ queryKey: ["latest-announcement"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("announcements").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-anns"] }); qc.invalidateQueries({ queryKey: ["latest-announcement"] }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("announcements").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-anns"] }),
  });

  return (
    <div className="py-4 space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <Input placeholder="Duyuru başlığı" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Textarea placeholder="Duyuru metni" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <Button onClick={() => create.mutate()} disabled={!form.title || !form.body} className="w-full">
          <Megaphone className="h-4 w-4 mr-1" /> Üyelere yayınla
        </Button>
      </div>
      <div className="space-y-2">
        {(list ?? []).map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex justify-between gap-2">
              <p className="font-medium truncate">{a.title}</p>
              <Switch checked={a.active} onCheckedChange={(v) => toggle.mutate({ id: a.id, active: v })} />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{a.body}</p>
            <div className="flex justify-end mt-2">
              <Button size="icon" variant="ghost" onClick={() => confirm("Silinsin mi?") && del.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("key, value");
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? ""])) as Record<string, string>;
    },
  });
  const [form, setForm] = useState({
    welcome_title: "", welcome_subtitle: "", app_name: "", logo_url: "", splash_url: "", hero_url: "",
    splash_duration_ms: "1500", search_placeholder: "", gallery_interval_ms: "5000",
    welcome_line1_text: "HOŞ GELDİN", welcome_line1_color: "#FFD400",
    welcome_line2_text: "BUGÜN GÜZEL", welcome_line2_color: "#FFFFFF",
    welcome_line3_text: "VE ŞIKSIN", welcome_line3_color: "#FFD400",
    loyalty_percent: "1",
    deposit_percent: "25",
    hero_height_px: "120",
    gap_top_px: "8",
    gap_line12_px: "2",
    gap_line23_px: "0",
    gap_search_px: "8",
  });
  const initialized = useState(false);
  if (settings && !initialized[0]) {
    setForm({
      welcome_title: settings.welcome_title ?? "",
      welcome_subtitle: settings.welcome_subtitle ?? "",
      app_name: settings.app_name ?? "BarberApp",
      logo_url: settings.logo_url ?? "",
      splash_url: settings.splash_url ?? "",
      hero_url: settings.hero_url ?? "",
      splash_duration_ms: settings.splash_duration_ms ?? "1500",
      search_placeholder: settings.search_placeholder ?? "Berber, salon, hizmet ara…",
      gallery_interval_ms: settings.gallery_interval_ms ?? "5000",
      welcome_line1_text: settings.welcome_line1_text ?? "HOŞ GELDİN",
      welcome_line1_color: settings.welcome_line1_color ?? "#FFD400",
      welcome_line2_text: settings.welcome_line2_text ?? "BUGÜN GÜZEL",
      welcome_line2_color: settings.welcome_line2_color ?? "#FFFFFF",
      welcome_line3_text: settings.welcome_line3_text ?? "VE ŞIKSIN",
      welcome_line3_color: settings.welcome_line3_color ?? "#FFD400",
      loyalty_percent: settings.loyalty_percent ?? "1",
      hero_height_px: settings.hero_height_px ?? "120",
      gap_top_px: settings.gap_top_px ?? "8",
      gap_line12_px: settings.gap_line12_px ?? "2",
      gap_line23_px: settings.gap_line23_px ?? "0",
      gap_search_px: settings.gap_search_px ?? "8",
    });
    initialized[1](true);
  }


  async function uploadAsset(file: File, key: "logo_url" | "splash_url" | "hero_url") {
    try {
      const { data: u } = await supabase.auth.getUser();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${u.user!.id}/${key}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("barbershop-photos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("barbershop-photos").getPublicUrl(path);
      setForm((f) => ({ ...f, [key]: data.publicUrl }));
      toast.success("Yüklendi, kaydet'e bas");
    } catch (e) { toast.error((e as Error).message); }
  }

  const save = useMutation({
    mutationFn: async () => {
      const rows = [
        { key: "welcome_title", value: form.welcome_title },
        { key: "welcome_subtitle", value: form.welcome_subtitle },
        { key: "app_name", value: form.app_name },
        { key: "logo_url", value: form.logo_url },
        { key: "splash_url", value: form.splash_url },
        { key: "hero_url", value: form.hero_url },
        { key: "splash_duration_ms", value: String(Number(form.splash_duration_ms) || 1500) },
        { key: "search_placeholder", value: form.search_placeholder },
        { key: "gallery_interval_ms", value: String(Number(form.gallery_interval_ms) || 5000) },
        { key: "welcome_line1_text", value: form.welcome_line1_text },
        { key: "welcome_line1_color", value: form.welcome_line1_color },
        { key: "welcome_line2_text", value: form.welcome_line2_text },
        { key: "welcome_line2_color", value: form.welcome_line2_color },
        { key: "welcome_line3_text", value: form.welcome_line3_text },
        { key: "welcome_line3_color", value: form.welcome_line3_color },
        { key: "loyalty_percent", value: String(Number(form.loyalty_percent) || 0) },
        { key: "hero_height_px", value: String(Number(form.hero_height_px) || 120) },
        { key: "gap_top_px", value: String(Number(form.gap_top_px) || 0) },
        { key: "gap_line12_px", value: String(Number(form.gap_line12_px) || 0) },
        { key: "gap_line23_px", value: String(Number(form.gap_line23_px) || 0) },
        { key: "gap_search_px", value: String(Number(form.gap_search_px) || 0) },
      ];
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kaydedildi");
      qc.invalidateQueries({ queryKey: ["welcome-text"] });
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["app-branding"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="py-4 space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <p className="text-xs uppercase tracking-wider text-primary">Uygulama Markası</p>
        <div><Label>Uygulama Adı (üst bar)</Label><Input value={form.app_name} onChange={(e) => setForm({ ...form, app_name: e.target.value })} placeholder="BarberApp" /></div>
        <div>
          <Label>Logo</Label>
          <div className="flex items-center gap-2">
            {form.logo_url && <SafeImg src={form.logo_url} alt="logo" className="h-10 w-10 rounded object-cover" />}
            <label className="flex-1 cursor-pointer rounded-md border border-dashed border-border p-2 text-center text-xs">
              <Upload className="mx-auto h-4 w-4 mb-1" /> Logo yükle
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAsset(f, "logo_url"); }} />
            </label>
            {form.logo_url && <Button size="icon" variant="destructive" onClick={() => setForm({ ...form, logo_url: "" })}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>
        <div>
          <Label>Splash (açılış) Görseli</Label>
          <div className="flex items-center gap-2">
            {form.splash_url && <SafeImg src={form.splash_url} alt="splash" className="h-14 w-14 rounded object-cover" />}
            <label className="flex-1 cursor-pointer rounded-md border border-dashed border-border p-2 text-center text-xs">
              <Upload className="mx-auto h-4 w-4 mb-1" /> Splash yükle
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAsset(f, "splash_url"); }} />
            </label>
            {form.splash_url && <Button size="icon" variant="destructive" onClick={() => setForm({ ...form, splash_url: "" })}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>
        <div>
          <Label>Splash Bekleme Süresi (ms)</Label>
          <Input type="number" min="0" max="10000" step="100" value={form.splash_duration_ms} onChange={(e) => setForm({ ...form, splash_duration_ms: e.target.value })} placeholder="1500" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <p className="text-xs uppercase tracking-wider text-primary">Anasayfa Hoş Geldin (3 Satır)</p>
        {([
          ["welcome_line1_text", "welcome_line1_color", "1. Satır (üst küçük)"],
          ["welcome_line2_text", "welcome_line2_color", "2. Satır (büyük)"],
          ["welcome_line3_text", "welcome_line3_color", "3. Satır (büyük)"],
        ] as const).map(([tk, ck, label]) => (
          <div key={tk} className="grid grid-cols-[1fr_64px] gap-2 items-end">
            <div>
              <Label className="text-xs">{label}</Label>
              <Input value={(form as any)[tk]} onChange={(e) => setForm({ ...form, [tk]: e.target.value } as any)} />
            </div>
            <div>
              <Label className="text-xs">Renk</Label>
              <Input type="color" value={(form as any)[ck]} onChange={(e) => setForm({ ...form, [ck]: e.target.value } as any)} className="h-10 p-1" />
            </div>
          </div>
        ))}
        <div>
          <Label>Anasayfa Kapak Fotoğrafı</Label>
          <div className="flex items-center gap-2">
            {form.hero_url && <SafeImg src={form.hero_url} alt="hero" className="h-14 w-24 rounded object-cover" />}
            <label className="flex-1 cursor-pointer rounded-md border border-dashed border-border p-2 text-center text-xs">
              <Upload className="mx-auto h-4 w-4 mb-1" /> Kapak yükle
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAsset(f, "hero_url"); }} />
            </label>
            {form.hero_url && <Button size="icon" variant="destructive" onClick={() => setForm({ ...form, hero_url: "" })}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>
        <div><Label>Arama Kutusu Yazısı</Label><Input value={form.search_placeholder} onChange={(e) => setForm({ ...form, search_placeholder: e.target.value })} placeholder="Berber, salon, hizmet ara…" /></div>
        <div><Label>Salon Foto Galeri Geçiş Süresi (ms)</Label><Input type="number" min="1000" step="500" value={form.gallery_interval_ms} onChange={(e) => setForm({ ...form, gallery_interval_ms: e.target.value })} placeholder="5000" /></div>
        <div><Label>Anasayfa Kapak Yüksekliği (px)</Label><Input type="number" min="0" max="400" value={form.hero_height_px} onChange={(e) => setForm({ ...form, hero_height_px: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Üst bar ↔ Hoş geldin (px)</Label><Input type="number" min="0" max="100" value={form.gap_top_px} onChange={(e) => setForm({ ...form, gap_top_px: e.target.value })} /></div>
          <div><Label className="text-xs">1. ↔ 2. satır (px)</Label><Input type="number" min="0" max="60" value={form.gap_line12_px} onChange={(e) => setForm({ ...form, gap_line12_px: e.target.value })} /></div>
          <div><Label className="text-xs">2. ↔ 3. satır (px)</Label><Input type="number" min="0" max="60" value={form.gap_line23_px} onChange={(e) => setForm({ ...form, gap_line23_px: e.target.value })} /></div>
          <div><Label className="text-xs">Yazılar ↔ Arama (px)</Label><Input type="number" min="0" max="80" value={form.gap_search_px} onChange={(e) => setForm({ ...form, gap_search_px: e.target.value })} /></div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <p className="text-xs uppercase tracking-wider text-primary">Sadakat Puanı</p>
        <div>
          <Label>Kart Çekiminden Kazanılacak Puan (%)</Label>
          <Input type="number" min="0" max="100" step="0.1" value={form.loyalty_percent} onChange={(e) => setForm({ ...form, loyalty_percent: e.target.value })} />
          <p className="text-[11px] text-muted-foreground mt-1">Örn: %1 → 100₺ ödemeden 1 puan</p>
        </div>
      </div>
      <Button className="w-full h-12" onClick={() => save.mutate()} disabled={save.isPending}>Tüm Ayarları Kaydet</Button>

    </div>
  );
}


function ActivityTab() {
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-all"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, phone, gender, created_at, last_seen_at, last_ip, last_city, last_country").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const { data: activity } = useQuery({
    queryKey: ["admin-activity"],
    queryFn: async () => (await supabase.from("user_activity").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });

  function exportMembers() {
    const rows = (profiles ?? []).map((p) => ({
      "Ad Soyad": p.full_name ?? "",
      "E-posta": p.email ?? "",
      "Telefon": p.phone ?? "",
      "Cinsiyet": p.gender ?? "",
      "Kayıt Tarihi": p.created_at ? new Date(p.created_at).toLocaleString("tr-TR") : "",
      "Son Giriş": p.last_seen_at ? new Date(p.last_seen_at).toLocaleString("tr-TR") : "",
      "IP": p.last_ip ?? "",
      "İl": p.last_city ?? "",
      "Ülke": p.last_country ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Üyeler");
    XLSX.writeFile(wb, `uyeler-${Date.now()}.xlsx`);
  }
  function exportActivity() {
    const rows = (activity ?? []).map((a) => ({
      "Tarih": new Date(a.created_at).toLocaleString("tr-TR"),
      "Üye ID": a.user_id ?? "",
      "Aksiyon": a.action,
      "IP": a.ip ?? "",
      "İl": a.city ?? "",
      "Bölge": a.region ?? "",
      "Ülke": a.country ?? "",
      "Tarayıcı": a.user_agent ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aktivite");
    XLSX.writeFile(wb, `aktivite-${Date.now()}.xlsx`);
  }

  return (
    <div className="py-4 space-y-3">
      <div className="flex gap-2">
        <Button onClick={exportMembers} className="flex-1"><Download className="h-4 w-4 mr-1" /> Üyeler Excel</Button>
        <Button onClick={exportActivity} variant="outline" className="flex-1"><Download className="h-4 w-4 mr-1" /> Aktivite Excel</Button>
      </div>
      <p className="text-xs uppercase tracking-wider text-primary mt-2">Son Aktiviteler ({(activity ?? []).length})</p>
      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
        {(activity ?? []).slice(0, 100).map((a) => {
          const u = (profiles ?? []).find((p) => p.id === a.user_id);
          return (
            <div key={a.id} className="rounded-lg border border-border bg-card p-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{u?.full_name ?? u?.email ?? a.user_id?.slice(0, 8)}</span>
                <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString("tr-TR")}</span>
              </div>
              <div className="text-muted-foreground">
                {a.action} · {a.ip ?? "-"} · {a.city ?? "-"}, {a.country ?? "-"}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs uppercase tracking-wider text-primary mt-4">Üye Listesi ({(profiles ?? []).length})</p>
      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
        {(profiles ?? []).slice(0, 100).map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-card p-2 text-xs">
            <p className="font-medium">{p.full_name ?? "—"}</p>
            <p className="text-muted-foreground truncate">{p.email} · {p.phone ?? "-"}</p>
            <p className="text-muted-foreground">
              Kayıt: {p.created_at ? new Date(p.created_at).toLocaleDateString("tr-TR") : "-"} · Son: {p.last_seen_at ? new Date(p.last_seen_at).toLocaleDateString("tr-TR") : "-"} · {p.last_city ?? "-"}/{p.last_country ?? "-"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BroadcastTab() {
  const [form, setForm] = useState({ title: "", body: "", image_url: "", link_url: "", audience: "all" as "all"|"customers"|"owners"|"staff"|"others" });

  async function uploadImg(file: File) {
    try {
      const { data: u } = await supabase.auth.getUser();
      const ext = file.name.split(".").pop();
      const path = `${u.user!.id}/broadcast-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("barbershop-photos").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("barbershop-photos").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("Görsel yüklendi");
    } catch (e) { toast.error((e as Error).message); }
  }

  const send = useMutation({
    mutationFn: async () => {
      const n = await adminBroadcast({
        data: {
          title: form.title,
          body: form.body,
          image_url: form.image_url || "",
          link_url: form.link_url || "",
          audience: form.audience,
        },
      });
      return n as number;
    },
    onSuccess: (n) => toast.success(`${n} kişiye gönderildi`),
    onError: (e: Error) => toast.error(e.message),
  });

  const AUDS: { v: typeof form.audience; label: string }[] = [
    { v: "all", label: "Herkes" },
    { v: "customers", label: "Müşteriler" },
    { v: "owners", label: "Salon Sahipleri" },
    { v: "staff", label: "Çalışanlar" },
    { v: "others", label: "Sahip & Çalışan dışındakiler" },
  ];

  return (
    <div className="py-4 space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
        <div>
          <Label className="text-xs">Hedef Kitle</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {AUDS.map((a) => (
              <button key={a.v} onClick={() => setForm({ ...form, audience: a.v })}
                className={`rounded-full border px-3 py-1 text-xs active:scale-95 transition ${form.audience === a.v ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div><Label className="text-xs">Başlık</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label className="text-xs">Mesaj</Label><Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        <div>
          <Label className="text-xs">Görsel (opsiyonel)</Label>
          <div className="flex gap-2 items-center mt-1">
            {form.image_url && <SafeImg src={form.image_url} alt="" className="h-14 w-14 rounded object-cover" />}
            <label className="flex-1 cursor-pointer rounded-md border border-dashed border-border p-2 text-center text-xs">
              <Upload className="mx-auto h-4 w-4 mb-1" /> Görsel yükle
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImg(f); }} />
            </label>
            {form.image_url && <Button size="icon" variant="destructive" onClick={() => setForm({ ...form, image_url: "" })}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>
        <div>
          <Label className="text-xs">Tıklayınca Açılacak Link (opsiyonel)</Label>
          <Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://... veya /kuafor/abc" />
        </div>
        <Button className="w-full h-11" disabled={!form.title || !form.body || send.isPending} onClick={() => send.mutate()}>
          <Send className="h-4 w-4 mr-1" /> {send.isPending ? "Gönderiliyor..." : "Bildirimi Gönder"}
        </Button>
      </div>
    </div>
  );
}

function AccountingTab() {
  const { data: shops } = useQuery({
    queryKey: ["acct-shops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("barbershops").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [shopId, setShopId] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: rows } = useQuery({
    queryKey: ["acct-rows", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("id, starts_at, status, payment_amount, deposit_amount, remaining_amount, payment_method, points_earned, points_used, discount_amount, service_ids, user_id, shop_id, barbershops:shop_id(name), profiles:user_id(full_name, phone)")
        .order("starts_at", { ascending: false });
      if (shopId !== "ALL") q = q.eq("shop_id", shopId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: serviceMap } = useQuery({
    queryKey: ["acct-services-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name, price");
      if (error) throw error;
      const m = new Map<string, { name: string; price: number }>();
      (data ?? []).forEach((s) => m.set(s.id, { name: s.name, price: Number(s.price ?? 0) }));
      return m;
    },
  });

  const filtered = useMemo(() => {
    let list = [...(rows ?? [])];
    if (statusFilter !== "ALL") list = list.filter((r: any) => r.status === statusFilter);
    if (from) list = list.filter((r: any) => new Date(r.starts_at) >= new Date(from));
    if (to) list = list.filter((r: any) => new Date(r.starts_at) <= new Date(to + "T23:59:59"));
    if (search.trim()) {
      const s = search.toLocaleLowerCase("tr");
      list = list.filter((r: any) => {
        const name = (r.profiles?.full_name ?? "").toLocaleLowerCase("tr");
        const phone = (r.profiles?.phone ?? "").toLocaleLowerCase("tr");
        const shop = (r.barbershops?.name ?? "").toLocaleLowerCase("tr");
        const services = ((r.service_ids ?? []).map((id: string) => serviceMap?.get(id)?.name ?? "").join(" ")).toLocaleLowerCase("tr");
        return name.includes(s) || phone.includes(s) || shop.includes(s) || services.includes(s);
      });
    }
    return list;
  }, [rows, statusFilter, from, to, search, serviceMap]);

  const totalRevenue = filtered.filter((r: any) => r.status !== "cancelled").reduce((s: number, r: any) => s + Number(r.payment_amount ?? 0), 0);
  const totalRemaining = filtered.reduce((s: number, r: any) => s + Number(r.remaining_amount ?? 0), 0);
  const totalCount = filtered.length;

  const exportXlsx = () => {
    const data = filtered.map((r: any) => ({
      Tarih: new Date(r.starts_at).toLocaleString("tr-TR"),
      Müşteri: r.profiles?.full_name ?? "—",
      Telefon: r.profiles?.phone ?? "—",
      Salon: r.barbershops?.name ?? "—",
      Hizmetler: (r.service_ids ?? []).map((id: string) => serviceMap?.get(id)?.name ?? "—").join(", "),
      Ödeme_Şekli: r.payment_method === "deposit" ? "%25 Kapora" : "Tamamı",
      Sistemden_Ödenen: Number(r.payment_amount ?? 0),
      Salonda_Ödenecek: Number(r.remaining_amount ?? 0),
      İndirim: Number(r.discount_amount ?? 0),
      Puan_Kullanılan: Number(r.points_used ?? 0),
      Puan_Kazanılan: Number(r.points_earned ?? 0),
      Durum: r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Muhasebe");
    XLSX.writeFile(wb, `muhasebe-${shopId === "ALL" ? "tum-salonlar" : (shops?.find((s) => s.id === shopId)?.name ?? "salon")}.xlsx`);
  };

  return (
    <div className="py-4 space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <div>
          <Label className="text-xs">Salon</Label>
          <Select value={shopId} onValueChange={setShopId}>
            <SelectTrigger><SelectValue placeholder="Salon seç" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">🏪 Bütün Salonlar</SelectItem>
              {(shops ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Ara (müşteri / telefon / hizmet / salon)</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ada, telefona, hizmete veya salona göre ara…" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Durum</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tümü</SelectItem>
                <SelectItem value="confirmed">Onaylı</SelectItem>
                <SelectItem value="completed">Tamamlandı</SelectItem>
                <SelectItem value="paid">Ödendi</SelectItem>
                <SelectItem value="cancelled">İptal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Başlangıç</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Bitiş</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground">Sistemden</p>
          <p className="font-display text-xl text-primary">{totalRevenue.toFixed(0)}₺</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground">Salonda</p>
          <p className="font-display text-xl">{totalRemaining.toFixed(0)}₺</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[10px] text-muted-foreground">İşlem</p>
          <p className="font-display text-xl">{totalCount}</p>
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
            <div key={r.id} className="rounded-xl border border-border bg-card p-3 text-xs space-y-0.5">
              <div className="flex justify-between gap-2">
                <p className="font-semibold text-sm truncate">{r.profiles?.full_name ?? "—"}</p>
                <p className="font-display text-primary text-base">{total.toFixed(0)}₺</p>
              </div>
              <p className="text-muted-foreground">📞 {r.profiles?.phone ?? "—"}</p>
              <p>🗓 {d.toLocaleDateString("tr-TR")} · {d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</p>
              <p>✂️ {names || "—"}</p>
              <p>🏪 {r.barbershops?.name ?? "—"}</p>
              <div className="flex flex-wrap gap-1 pt-0.5">
                <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-bold">Sistemden: {Number(r.payment_amount ?? 0).toFixed(0)}₺</span>
                {Number(r.remaining_amount ?? 0) > 0 && (
                  <span className="rounded-full bg-amber-500/15 text-amber-500 px-2 py-0.5 text-[10px] font-bold">Salonda: {Number(r.remaining_amount ?? 0).toFixed(0)}₺</span>
                )}
                {Number(r.discount_amount ?? 0) > 0 && (
                  <span className="rounded-full bg-emerald-500/15 text-emerald-500 px-2 py-0.5 text-[10px] font-bold">İndirim: {Number(r.discount_amount).toFixed(0)}₺</span>
                )}
                {Number(r.points_used ?? 0) > 0 && (
                  <span className="rounded-full bg-amber-500/15 text-amber-500 px-2 py-0.5 text-[10px] font-bold">−{r.points_used} puan</span>
                )}
                {Number(r.points_earned ?? 0) > 0 && (
                  <span className="rounded-full bg-emerald-500/15 text-emerald-500 px-2 py-0.5 text-[10px] font-bold">+{r.points_earned} puan</span>
                )}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider">{r.status}</span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Eşleşen işlem yok.</p>}
      </div>
    </div>
  );
}


function DiscountsTab() {
  const qc = useQueryClient();
  const { data: codes } = useQuery({
    queryKey: ["disc-codes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("discount_codes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [active, setActive] = useState(true);
  const [maxUses, setMaxUses] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!code.trim() || !value) throw new Error("Eksik bilgi");
      const { error } = await supabase.from("discount_codes").insert({
        code: code.trim().toUpperCase(),
        discount_type: type,
        discount_value: Number(value),
        active,
        max_uses: maxUses ? Number(maxUses) : null,
        per_user_limit: perUserLimit ? Number(perUserLimit) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kupon eklendi");
      setCode(""); setValue(""); setMaxUses(""); setPerUserLimit("");
      qc.invalidateQueries({ queryKey: ["disc-codes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("discount_codes").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disc-codes"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discount_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disc-codes"] }),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-display text-lg">Yeni İndirim Kuponu</h3>
        <div>
          <Label>Kod</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ÖRN: HOSGELDIN10" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Tip</Label>
            <Select value={type} onValueChange={(v) => setType(v as "percent" | "amount")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">% Yüzde</SelectItem>
                <SelectItem value="amount">₺ Tutar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Değer</Label>
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === "percent" ? "10" : "50"} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Toplam Kullanım Limiti</Label>
            <Input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Sınırsız" />
          </div>
          <div>
            <Label className="text-xs">Kişi Başı Limit</Label>
            <Input type="number" min="1" value={perUserLimit} onChange={(e) => setPerUserLimit(e.target.value)} placeholder="Sınırsız" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={setActive} />
          <Label className="!mt-0">Aktif</Label>
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Kupon Ekle
        </Button>
      </div>
      <div className="space-y-2">
        {(codes ?? []).map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
            <div>
              <p className="font-display text-lg">{c.code}</p>
              <p className="text-xs text-muted-foreground">
                {c.discount_type === "percent" ? `% ${c.discount_value} indirim` : `${c.discount_value}₺ indirim`}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Toplam: {c.max_uses ?? "∞"} · Kişi başı: {c.per_user_limit ?? "∞"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={c.active} onCheckedChange={(v) => toggle.mutate({ id: c.id, active: v })} />
              <Button size="icon" variant="ghost" onClick={() => del.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {(codes ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Henüz kupon yok.</p>}
      </div>
    </div>
  );
}
