import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Download, Store } from "lucide-react";
import * as XLSX from "xlsx";

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

type SortKey = "date" | "service" | "amount";

function SalonYonetimi() {
  const { data: shops } = useQuery({
    queryKey: ["owner-shops"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("barbershops").select("id, name").eq("owner_id", u.user!.id).order("name");
      return data ?? [];
    },
  });
  const [shopId, setShopId] = useState<string>("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [asc, setAsc] = useState(false);

  const { data: serviceMap } = useQuery({
    queryKey: ["owner-services"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("id, name, price");
      const m = new Map<string, { name: string; price: number }>();
      (data ?? []).forEach((s) => m.set(s.id, { name: s.name, price: Number(s.price ?? 0) }));
      return m;
    },
  });

  const ownedIds = useMemo(() => (shops ?? []).map((s) => s.id), [shops]);

  const { data: rows } = useQuery({
    queryKey: ["owner-appts", shopId, ownedIds.join(",")],
    enabled: ownedIds.length > 0,
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("id, starts_at, status, payment_amount, deposit_amount, remaining_amount, payment_method, service_ids, user_id, shop_id, barbershops:shop_id(name), profiles:user_id(full_name, phone)")
        .order("starts_at", { ascending: false });
      if (shopId === "ALL") q = q.in("shop_id", ownedIds);
      else q = q.eq("shop_id", shopId);
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
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Salon");
    XLSX.writeFile(wb, `salon-yonetimi-${Date.now()}.xlsx`);
  }

  return (
    <AppShell>
      <BackButton to="/hesap" />
      <header className="px-4 pt-16 pb-3">
        <h1 className="font-display text-3xl">Salon Yönetimi</h1>
        <p className="text-xs text-muted-foreground">Müşterilerin, randevuların ve ödemeler</p>
      </header>

      <div className="px-4 space-y-3">
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div>
            <Label className="text-xs">Salon</Label>
            <Select value={shopId} onValueChange={setShopId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL"><Store className="inline h-3.5 w-3.5 mr-1" /> Tüm Salonlarım</SelectItem>
                {(shops ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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

        <div className="space-y-2 pb-6">
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
                <div className="flex gap-2 pt-1">
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
    </AppShell>
  );
}
