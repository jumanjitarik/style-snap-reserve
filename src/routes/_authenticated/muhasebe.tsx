import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Download, Store, Receipt } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/muhasebe")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const ok = roles?.some((r) => r.role === "owner" || r.role === "admin");
    if (!ok) throw redirect({ to: "/hesap" });
  },
  component: MuhasebePage,
});

type SortKey = "date" | "service" | "amount";

function MuhasebePage() {
  const { data: shops } = useQuery({
    queryKey: ["muhasebe-shops"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user!.id);
      const isAdmin = !!roles?.some((r) => r.role === "admin");
      let q = supabase.from("barbershops").select("id, name, owner_id").order("name");
      if (!isAdmin) q = q.eq("owner_id", u.user!.id);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: services } = useQuery({
    queryKey: ["muhasebe-services-all"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("id, name, price, shop_id");
      return data ?? [];
    },
  });
  const serviceMap = useMemo(() => {
    const m = new Map<string, { name: string; price: number }>();
    (services ?? []).forEach((s) => m.set(s.id, { name: s.name, price: Number(s.price ?? 0) }));
    return m;
  }, [services]);

  const [shopFilter, setShopFilter] = useState("ALL");
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [asc, setAsc] = useState(false);

  const ownedIds = useMemo(() => (shops ?? []).map((s) => s.id), [shops]);

  const { data: rows } = useQuery({
    queryKey: ["muhasebe-appts", shopFilter, ownedIds.join(",")],
    enabled: ownedIds.length > 0,
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("id, starts_at, status, payment_amount, deposit_amount, remaining_amount, payment_method, service_ids, service_id, user_id, shop_id, barbershops:shop_id(name), profiles:user_id(full_name, phone)")
        .order("starts_at", { ascending: false });
      if (shopFilter === "ALL") q = q.in("shop_id", ownedIds);
      else q = q.eq("shop_id", shopFilter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    let list = [...(rows ?? [])];
    if (from) list = list.filter((r) => new Date(r.starts_at) >= new Date(from));
    if (to) list = list.filter((r) => new Date(r.starts_at) <= new Date(to + "T23:59:59"));
    if (serviceFilter !== "ALL") list = list.filter((r: any) => (r.service_ids ?? []).includes(serviceFilter) || r.service_id === serviceFilter);
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
  }, [rows, from, to, serviceFilter, sortBy, asc, serviceMap]);

  const stats = useMemo(() => {
    const now = new Date();
    const startDay = new Date(now); startDay.setHours(0, 0, 0, 0);
    const startWeek = new Date(startDay); startWeek.setDate(startDay.getDate() - startDay.getDay());
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    function agg(sinceDate: Date | null) {
      const filteredRows = sinceDate ? (rows ?? []).filter((r) => new Date(r.starts_at) >= sinceDate) : (rows ?? []);
      const card = filteredRows.reduce((s, r: any) => s + Number(r.payment_amount ?? 0), 0);
      const cash = filteredRows.reduce((s, r: any) => s + Number(r.remaining_amount ?? 0), 0);
      return { count: filteredRows.length, card, cash, total: card + cash };
    }
    return {
      daily: agg(startDay),
      weekly: agg(startWeek),
      monthly: agg(startMonth),
      all: agg(null),
    };
  }, [rows]);

  function exportXlsx() {
    const data = filtered.map((r: any) => ({
      Tarih: new Date(r.starts_at).toLocaleString("tr-TR"),
      Salon: r.barbershops?.name ?? "—",
      Müşteri: r.profiles?.full_name ?? "—",
      Telefon: r.profiles?.phone ?? "—",
      Hizmetler: (r.service_ids ?? []).map((id: string) => serviceMap?.get(id)?.name ?? "—").join(", "),
      Ödeme_Şekli: r.payment_method === "deposit" ? "Kapora + Nakit" : "Tamamı Kart",
      Kart_Çekimi: Number(r.payment_amount ?? 0),
      Salonda_Nakit: Number(r.remaining_amount ?? 0),
      Durum: r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Muhasebe");
    XLSX.writeFile(wb, `muhasebe-${Date.now()}.xlsx`);
  }

  const shopServices = useMemo(() => {
    if (shopFilter === "ALL") return services ?? [];
    return (services ?? []).filter((s) => s.shop_id === shopFilter);
  }, [services, shopFilter]);

  return (
    <AppShell>
      <BackButton to="/hesap" />
      <header className="px-4 pt-4 pb-3 flex items-center gap-2">
        <Receipt className="h-6 w-6 text-primary" />
        <h1 className="font-display text-3xl">Muhasebe</h1>
      </header>

      <div className="px-4 pb-8 space-y-3">
        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Günlük" data={stats.daily} />
          <StatCard title="Haftalık" data={stats.weekly} />
          <StatCard title="Aylık" data={stats.monthly} />
          <StatCard title="Toplam" data={stats.all} highlight />
        </div>

        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div>
            <Label className="text-xs">Salon</Label>
            <Select value={shopFilter} onValueChange={setShopFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL"><Store className="inline h-3.5 w-3.5 mr-1" /> Tüm Salonlar</SelectItem>
                {(shops ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Hizmet Türü</Label>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tümü</SelectItem>
                {shopServices.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Başlangıç</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label className="text-xs">Bitiş</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Sırala</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Tarihe göre</SelectItem>
                  <SelectItem value="amount">Tutara göre</SelectItem>
                  <SelectItem value="service">Hizmete göre</SelectItem>
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
          <Button variant="outline" className="w-full" onClick={exportXlsx}>
            <Download className="h-4 w-4 mr-1" /> Excel'e Aktar
          </Button>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Kayıt yok.</p>}
          {filtered.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3 space-y-1">
              <div className="flex justify-between items-start">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.profiles?.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.profiles?.phone ?? "—"}</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">{new Date(r.starts_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {r.barbershops?.name ?? "—"} · {(r.service_ids ?? []).map((id: string) => serviceMap.get(id)?.name ?? "—").join(", ")}
              </p>
              <div className="flex gap-2 text-xs pt-1">
                <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5">Kart: {Number(r.payment_amount ?? 0).toFixed(0)}₺</span>
                <span className="rounded-full bg-muted px-2 py-0.5">Nakit: {Number(r.remaining_amount ?? 0).toFixed(0)}₺</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ title, data, highlight }: { title: string; data: { count: number; card: number; cash: number; total: number }; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-primary/50 bg-primary/10" : "border-border bg-card"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="font-display text-xl text-primary">{data.total.toFixed(0)}₺</p>
      <div className="mt-1 text-[10px] text-muted-foreground space-y-0.5">
        <p>Randevu: <span className="text-foreground font-semibold">{data.count}</span></p>
        <p>Kart: <span className="text-foreground">{data.card.toFixed(0)}₺</span></p>
        <p>Nakit: <span className="text-foreground">{data.cash.toFixed(0)}₺</span></p>
      </div>
    </div>
  );
}
