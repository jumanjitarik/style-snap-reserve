import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { ArrowUpDown, Download, Store, Plus, Trash2, Save, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

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
  const { data: shops } = useQuery({
    queryKey: ["owner-shops"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("barbershops")
        .select("id, name, description, address, phone, lat, lng, category, cover_image_url, city")
        .eq("owner_id", u.user!.id)
        .order("name");
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

        <Tabs defaultValue="appts" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="appts">Randevular</TabsTrigger>
            <TabsTrigger value="shop">Salon</TabsTrigger>
            <TabsTrigger value="services">Hizmet</TabsTrigger>
            <TabsTrigger value="staff">Çalışan</TabsTrigger>
          </TabsList>

          <TabsContent value="appts" className="mt-3">
            <AppointmentsTab shops={shops ?? []} />
          </TabsContent>
          <TabsContent value="shop" className="mt-3">
            {activeShop ? <ShopInfoTab shop={activeShop} /> : <p className="text-sm text-muted-foreground">Salon yok.</p>}
          </TabsContent>
          <TabsContent value="services" className="mt-3">
            {activeId ? <ServicesTab shopId={activeId} /> : <p className="text-sm text-muted-foreground">Salon yok.</p>}
          </TabsContent>
          <TabsContent value="staff" className="mt-3">
            {activeId ? <StaffTab shopId={activeId} /> : <p className="text-sm text-muted-foreground">Salon yok.</p>}
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

  function exportXlsx() {
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
              <SelectItem value="ALL"><Store className="inline h-3.5 w-3.5 mr-1" /> Tüm Salonlarım</SelectItem>
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

/* ============ SHOP INFO ============ */
type ShopRow = {
  id: string; name: string; description: string | null; address: string | null;
  phone: string | null; lat: number | null; lng: number | null;
  category: string | null; cover_image_url: string | null;
  city: string | null;
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

function ShopInfoTab({ shop }: { shop: ShopRow }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: shop.name, description: shop.description ?? "", address: shop.address ?? "",
    phone: shop.phone ?? "", lat: shop.lat ?? "" as number | string, lng: shop.lng ?? "" as number | string,
    city: shop.city ?? "", cover_image_url: shop.cover_image_url ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("barbershops").update({
        name: form.name, description: form.description || undefined, address: form.address || null,
        phone: form.phone || null,
        lat: form.lat === "" ? null : Number(form.lat),
        lng: form.lng === "" ? null : Number(form.lng),
        city: form.city || null,
        cover_image_url: form.cover_image_url || null,
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
