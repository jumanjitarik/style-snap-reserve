import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES, type ShopCategory } from "@/lib/categories";
import { toast } from "sonner";
import { Trash2, Plus, Upload } from "lucide-react";

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
      <header className="px-4 pt-8 pb-3">
        <h1 className="font-display text-3xl">Yönetici Paneli</h1>
        <p className="text-xs text-muted-foreground">Salonlar, hizmetler ve çalışanlar</p>
      </header>
      <Tabs defaultValue="shops" className="px-4">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="shops">Salonlar</TabsTrigger>
          <TabsTrigger value="services">Hizmetler</TabsTrigger>
          <TabsTrigger value="staff">Çalışan</TabsTrigger>
        </TabsList>
        <TabsContent value="shops"><ShopsTab /></TabsContent>
        <TabsContent value="services"><ServicesTab /></TabsContent>
        <TabsContent value="staff"><StaffTab /></TabsContent>
      </Tabs>
    </AppShell>
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
  const [editing, setEditing] = useState<{ id?: string; name: string; category: ShopCategory; description: string; address: string; phone: string; lat: string; lng: string; cover_image_url: string } | null>(null);

  const { data: shops } = useQuery({
    queryKey: ["admin-shops"],
    queryFn: async () => (await supabase.from("barbershops").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        name: editing.name,
        category: editing.category,
        description: editing.description || null,
        address: editing.address,
        phone: editing.phone || null,
        lat: editing.lat ? parseFloat(editing.lat) : null,
        lng: editing.lng ? parseFloat(editing.lng) : null,
        cover_image_url: editing.cover_image_url || null,
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
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Açıklama</Label><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
        <div><Label>Adres</Label><Input value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
        <div><Label>Telefon</Label><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
        <div className="flex gap-2">
          <div className="flex-1"><Label>Enlem (lat)</Label><Input value={editing.lat} onChange={(e) => setEditing({ ...editing, lat: e.target.value })} placeholder="41.0082" /></div>
          <div className="flex-1"><Label>Boylam (lng)</Label><Input value={editing.lng} onChange={(e) => setEditing({ ...editing, lng: e.target.value })} placeholder="28.9784" /></div>
        </div>
        <div>
          <Label>Kapak Fotoğrafı</Label>
          <div className="flex gap-2 items-center">
            {editing.cover_image_url && <img src={editing.cover_image_url} className="h-16 w-16 rounded object-cover" alt="" />}
            <label className="flex-1 cursor-pointer rounded-md border border-dashed border-border p-3 text-center text-xs">
              <Upload className="mx-auto h-4 w-4 mb-1" /> Fotoğraf yükle
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                try { const url = await uploadPhoto(f, "shop-cover"); setEditing({ ...editing, cover_image_url: url }); toast.success("Yüklendi"); }
                catch (err) { toast.error((err as Error).message); }
              }} />
            </label>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => setEditing(null)} className="flex-1">İptal</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">Kaydet</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-3">
      <Button onClick={() => setEditing({ name: "", category: "male_barber", description: "", address: "", phone: "", lat: "", lng: "", cover_image_url: "" })} className="w-full">
        <Plus className="h-4 w-4 mr-1" /> Yeni Salon
      </Button>
      {(shops ?? []).map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-card p-3">
          <div className="flex justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground truncate">{s.address}</p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing({
                id: s.id, name: s.name, category: s.category, description: s.description ?? "",
                address: s.address, phone: s.phone ?? "", lat: s.lat?.toString() ?? "", lng: s.lng?.toString() ?? "",
                cover_image_url: s.cover_image_url ?? "",
              })}>Düzenle</Button>
              <Button size="icon" variant="ghost" onClick={() => confirm("Silinsin mi?") && del.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ServicesTab() {
  const qc = useQueryClient();
  const [shopId, setShopId] = useState<string>("");
  const [form, setForm] = useState({ name: "", description: "", duration_min: "30", price: "" });

  const { data: shops } = useQuery({ queryKey: ["admin-shops-min"], queryFn: async () => (await supabase.from("barbershops").select("id, name")).data ?? [] });
  const { data: services } = useQuery({
    queryKey: ["admin-services", shopId], enabled: !!shopId,
    queryFn: async () => (await supabase.from("services").select("*").eq("shop_id", shopId)).data ?? [],
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
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("services").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-services"] }),
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
            <Input placeholder="Hizmet adı" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Textarea placeholder="Açıklama" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            <div className="flex gap-2">
              <Input placeholder="Süre (dk)" type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
              <Input placeholder="Fiyat (₺)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <Button onClick={() => add.mutate()} disabled={!form.name || !form.price} className="w-full">Ekle</Button>
          </div>
          <div className="space-y-2">
            {(services ?? []).map((s) => (
              <div key={s.id} className="flex justify-between rounded-xl border border-border bg-card p-3">
                <div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.duration_min}dk · {s.price}₺</p></div>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StaffTab() {
  const qc = useQueryClient();
  const [shopId, setShopId] = useState<string>("");
  const [form, setForm] = useState({ name: "", title: "", photo_url: "" });

  const { data: shops } = useQuery({ queryKey: ["admin-shops-min2"], queryFn: async () => (await supabase.from("barbershops").select("id, name")).data ?? [] });
  const { data: staff } = useQuery({
    queryKey: ["admin-staff", shopId], enabled: !!shopId,
    queryFn: async () => (await supabase.from("staff").select("*").eq("shop_id", shopId)).data ?? [],
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
              {form.photo_url && <img src={form.photo_url} className="h-12 w-12 rounded-full object-cover" alt="" />}
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
          <div className="space-y-2">
            {(staff ?? []).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0">
                  {p.photo_url && <img src={p.photo_url} className="h-full w-full object-cover" alt="" />}
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
