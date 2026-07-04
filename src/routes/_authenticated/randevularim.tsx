import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import { Calendar, MapPin, Phone, Calendar as CalIcon, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/randevularim")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (s.tab as Tab | undefined),
  }),
  component: MyAppts,
});


type Tab = "customers" | "mine" | "customer_memberships" | "memberships";

type StatusLabel = { text: string; tone: "open" | "past" | "cancelled" };
function labelFor(starts_at: string, status: string): StatusLabel {
  if (status === "cancelled") return { text: "İptal Randevu", tone: "cancelled" };
  if (new Date(starts_at).getTime() < Date.now() || status === "completed") return { text: "Geçmiş Randevu", tone: "past" };
  return { text: "Açık Randevu", tone: "open" };
}
function toneClass(tone: StatusLabel["tone"]) {
  if (tone === "open") return "bg-primary/20 text-primary";
  if (tone === "cancelled") return "bg-destructive/20 text-destructive";
  return "bg-muted text-muted-foreground";
}

type Period = "day" | "week" | "month" | "year" | "all";
const PERIODS: { id: Period; label: string }[] = [
  { id: "day", label: "Günlük" },
  { id: "week", label: "Haftalık" },
  { id: "month", label: "Aylık" },
  { id: "year", label: "Senelik" },
  { id: "all", label: "Toplam" },
];
function periodStart(p: Period): number {
  const d = new Date();
  if (p === "all") return 0;
  if (p === "day") { d.setHours(0, 0, 0, 0); return d.getTime(); }
  if (p === "week") { const dd = new Date(); dd.setHours(0, 0, 0, 0); dd.setDate(dd.getDate() - dd.getDay()); return dd.getTime(); }
  if (p === "month") return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  return new Date(d.getFullYear(), 0, 1).getTime();
}
function RevenueSummary({ items, dateField, title = "Toplam Gelir" }: {
  items: Array<{ payment_amount?: number | null; remaining_amount?: number | null; [k: string]: unknown }>;
  dateField: string;
  title?: string;
}) {
  const [period, setPeriod] = useState<Period>("all");
  const sum = useMemo(() => {
    const since = periodStart(period);
    let card = 0, cash = 0, count = 0;
    for (const it of items) {
      const t = new Date(String(it[dateField])).getTime();
      if (t < since) continue;
      card += Number(it.payment_amount ?? 0);
      cash += Number(it.remaining_amount ?? 0);
      count += 1;
    }
    return { card, cash, total: card + cash, count };
  }, [items, dateField, period]);
  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="text-[10px] text-muted-foreground">{sum.count} kayıt</p>
      </div>
      <p className="font-display text-3xl text-primary">{sum.total.toFixed(0)}₺</p>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 font-semibold">Kart: {sum.card.toFixed(0)}₺</span>
        <span className="rounded-full bg-amber-500/15 text-amber-500 px-2 py-0.5 font-semibold">Salonda: {sum.cash.toFixed(0)}₺</span>
      </div>
      <div className="grid grid-cols-5 gap-1 pt-1">
        {PERIODS.map((p) => (
          <button key={p.id} onClick={() => setPeriod(p.id)}
            className={cn("rounded-md py-1.5 text-[10px] font-medium transition", period === p.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}


function MyAppts() {
  const { tab: initialTab } = Route.useSearch();
  const [userId, setUserId] = useState<string | null>(null);
  const [isStaffOrOwner, setIsStaffOrOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTab ?? "mine");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const admin = !!roles?.some((r) => r.role === "admin");
      const so = admin || !!roles?.some((r) => r.role === "owner" || r.role === "staff");
      setIsAdmin(admin);
      setIsStaffOrOwner(so);
      if (!initialTab && so) setTab("customers");
    });
  }, [initialTab]);


  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={cn(
        "rounded-lg py-2 text-xs font-medium transition",
        tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
      )}
    >
      {label}
    </button>
  );

  return (
    <AppShell>
      <BackButton to="/" />
      <header className="px-4 pt-4 pb-3">
        <h1 className="font-display text-3xl flex items-center gap-2">
          <CalIcon className="h-8 w-8 text-primary" />
          Alınan
        </h1>
        <p className="text-xs text-muted-foreground">İptal en geç randevudan 24 saat önce yapılabilir.</p>
      </header>

      <div className="px-4 pb-3 space-y-2">
        {isStaffOrOwner ? (
          <>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
              <TabBtn id="customers" label="Müşteri Randevuları" />
              <TabBtn id="customer_memberships" label="Müşteri Üyelikleri" />
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
              <TabBtn id="mine" label="Randevularım" />
              <TabBtn id="memberships" label="Üyeliklerim" />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
            <TabBtn id="mine" label="Randevularım" />
            <TabBtn id="memberships" label="Üyeliklerim" />
          </div>
        )}
      </div>

      <div className="px-4 pb-6">
        {tab === "mine" && <MyOwnList />}
        {tab === "customers" && userId && isStaffOrOwner && <CustomerList userId={userId} isAdmin={isAdmin} />}
        {tab === "memberships" && <MyMembershipsList />}
        {tab === "customer_memberships" && userId && isStaffOrOwner && <CustomerMembershipsList userId={userId} isAdmin={isAdmin} />}
      </div>
    </AppShell>
  );
}

function MyOwnList() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["my-appts"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("appointments")
        .select("id, starts_at, status, payment_amount, deposit_amount, remaining_amount, discount_amount, points_used, shop:barbershops(id,name,address), service:services(name)")
        .eq("user_id", u.user.id)
        .order("starts_at", { ascending: false });
      return data ?? [];
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("İptal edildi"); qc.invalidateQueries({ queryKey: ["my-appts"] }); },
    onError: () => toast.error("24 saat kala iptal sağlanmamaktadır"),
  });

  const list = data ?? [];
  const sorted = useMemo(() => {
    const now = Date.now();
    const open = list.filter((a) => a.status !== "cancelled" && new Date(a.starts_at).getTime() >= now)
                     .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    const past = list.filter((a) => !(a.status !== "cancelled" && new Date(a.starts_at).getTime() >= now));
    return [...open, ...past];
  }, [list]);

  if (sorted.length === 0) return <p className="py-12 text-center text-sm text-muted-foreground">Henüz randevu yok.</p>;

  return (
    <div className="space-y-3">
      {sorted.map((a) => {
        const startsAt = new Date(a.starts_at);
        const hoursLeft = (startsAt.getTime() - Date.now()) / 3_600_000;
        const lbl = labelFor(a.starts_at, a.status);
        const canCancel = hoursLeft > 24 && a.status === "confirmed";
        const total = Number(a.payment_amount ?? 0) + Number(a.remaining_amount ?? 0);
        return (
          <div key={a.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold truncate">{a.shop?.name}</p>
                <p className="text-sm text-muted-foreground">{a.service?.name}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClass(lbl.tone)}`}>{lbl.text}</span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{format(startsAt, "d MMMM yyyy · HH:mm", { locale: tr })}</p>
              {a.shop?.address && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{a.shop.address}</p>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-full bg-muted px-2 py-0.5">Toplam: <b className="text-foreground">{total.toFixed(0)}₺</b></span>
              {Number(a.payment_amount ?? 0) > 0 && (
                <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 font-semibold">Kart: {Number(a.payment_amount).toFixed(0)}₺</span>
              )}
              {Number(a.remaining_amount ?? 0) > 0 && (
                <span className="rounded-full bg-amber-500/15 text-amber-500 px-2 py-0.5 font-semibold">Salonda: {Number(a.remaining_amount).toFixed(0)}₺</span>
              )}
              {Number(a.discount_amount ?? 0) > 0 && (
                <span className="rounded-full bg-emerald-500/15 text-emerald-500 px-2 py-0.5 font-semibold">İndirim: −{Number(a.discount_amount).toFixed(0)}₺</span>
              )}
              {Number(a.points_used ?? 0) > 0 && (
                <span className="rounded-full bg-emerald-500/15 text-emerald-500 px-2 py-0.5 font-semibold">−{a.points_used} puan</span>
              )}
            </div>
            {lbl.tone === "open" && (
              canCancel ? (
                <Button variant="outline" size="sm" className="mt-3 w-full active:scale-95 transition" onClick={() => cancel.mutate(a.id)}>
                  İptal Et
                </Button>
              ) : (
                <p className="mt-3 text-[11px] text-center text-muted-foreground">İptal süresi doldu (24 saatten az kaldı).</p>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

function CustomerList({ userId, isAdmin = false }: { userId: string; isAdmin?: boolean }) {
  const { data: shopIds } = useQuery({
    queryKey: ["my-shop-ids", userId, isAdmin],
    queryFn: async () => {
      if (isAdmin) return null; // admin sees all
      const [owned, asStaff] = await Promise.all([
        supabase.from("barbershops").select("id").eq("owner_id", userId),
        supabase.from("staff").select("shop_id").eq("user_id", userId),
      ]);
      const ownIds = (owned.data ?? []).map((s) => s.id);
      const staffIds = (asStaff.data ?? []).map((s) => s.shop_id);
      return Array.from(new Set([...ownIds, ...staffIds]));
    },
  });

  const { data: appts } = useQuery({
    queryKey: ["staff-appts", isAdmin ? "all" : shopIds],
    enabled: isAdmin || (!!shopIds && shopIds.length > 0),
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("id, starts_at, status, payment_amount, deposit_amount, remaining_amount, discount_amount, points_used, user_id, guest_name, guest_phone, shop_id, service_id, notes")
        .order("starts_at", { ascending: true });
      if (!isAdmin) q = q.in("shop_id", shopIds!);
      const { data } = await q;
      return data ?? [];
    },
  });


  const userIds = Array.from(new Set((appts ?? []).map((a) => a.user_id).filter(Boolean) as string[]));
  const { data: profiles } = useQuery({
    queryKey: ["appt-profiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, phone, email").in("id", userIds);
      const map = new Map<string, { full_name: string | null; phone: string | null; email: string | null }>();
      (data ?? []).forEach((p) => map.set(p.id, p));
      return map;
    },
  });

  const services = useQuery({
    queryKey: ["appt-services", appts?.map((a) => a.service_id)],
    enabled: !!appts && appts.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(appts!.map((a) => a.service_id).filter(Boolean) as string[]));
      const { data } = await supabase.from("services").select("id, name").in("id", ids);
      const m = new Map<string, string>();
      (data ?? []).forEach((s) => m.set(s.id, s.name));
      return m;
    },
  });

  if (!isAdmin && (!shopIds || shopIds.length === 0)) return <p className="py-8 text-center text-sm text-muted-foreground">Salonunuz/işiniz bulunamadı.</p>;
  if (!appts || appts.length === 0) return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Henüz müşteri randevusu yok.</div>;

  const now = Date.now();
  const open = appts.filter((a) => a.status !== "cancelled" && new Date(a.starts_at).getTime() >= now)
                    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const closed = appts.filter((a) => !(a.status !== "cancelled" && new Date(a.starts_at).getTime() >= now))
                      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  const Row = ({ a }: { a: typeof appts[number] }) => {
    const p = a.user_id ? profiles?.get(a.user_id) : null;
    const name = p?.full_name ?? a.guest_name ?? "Müşteri";
    const phone = p?.phone ?? a.guest_phone ?? null;
    const lbl = labelFor(a.starts_at, a.status);
    const total = Number(a.payment_amount ?? 0) + Number(a.remaining_amount ?? 0);
    return (
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <CalIcon className="h-3 w-3" />
              {format(new Date(a.starts_at), "d MMM yyyy · HH:mm", { locale: tr })}
            </p>
            {services.data?.get(a.service_id ?? "") && (
              <p className="text-xs text-muted-foreground mt-0.5">{services.data.get(a.service_id ?? "")}</p>
            )}
          </div>
          <span className={`shrink-0 rounded-full text-[10px] tracking-wider px-2 py-0.5 font-bold ${toneClass(lbl.tone)}`}>{lbl.text}</span>
        </div>
        {phone && (
          <a href={`tel:${phone}`} className="mt-2 flex items-center gap-2 text-xs text-primary active:opacity-60">
            <Phone className="h-3.5 w-3.5" /> {phone}
          </a>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          {total > 0 && <span className="rounded-full bg-muted px-2 py-0.5">Toplam: <b>{total.toFixed(0)}₺</b></span>}
          {Number(a.payment_amount ?? 0) > 0 && <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 font-semibold">Kart: {Number(a.payment_amount).toFixed(0)}₺</span>}
          {Number(a.remaining_amount ?? 0) > 0 && <span className="rounded-full bg-amber-500/15 text-amber-500 px-2 py-0.5 font-semibold">Salonda: {Number(a.remaining_amount).toFixed(0)}₺</span>}
          {Number(a.discount_amount ?? 0) > 0 && <span className="rounded-full bg-emerald-500/15 text-emerald-500 px-2 py-0.5 font-semibold">İndirim: −{Number(a.discount_amount).toFixed(0)}₺</span>}
        </div>
        {a.notes && (
          <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2">
            <p className="text-[10px] uppercase tracking-wider text-primary mb-0.5">Müşteri Notu</p>
            <p className="text-[12px] whitespace-pre-wrap">{a.notes}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <section>
        <h2 className="font-display text-lg mb-2 flex items-center gap-2">Açık Randevular <span className="text-xs text-muted-foreground font-sans">({open.length})</span></h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">Açık randevu yok.</p>
        ) : (
          <div className="space-y-2">{open.map((a) => <Row key={a.id} a={a} />)}</div>
        )}
      </section>
      <section>
        <h2 className="font-display text-lg mb-2 flex items-center gap-2">Biten Randevular <span className="text-xs text-muted-foreground font-sans">({closed.length})</span></h2>
        {closed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geçmiş randevu yok.</p>
        ) : (
          <div className="space-y-2">{closed.map((a) => <Row key={a.id} a={a} />)}</div>
        )}
      </section>
    </div>
  );
}

function MyMembershipsList() {
  const { data } = useQuery({
    queryKey: ["my-memberships"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("memberships")
        .select("id, amount, created_at, notes, shop:barbershops(id,name,address,category), service:services(name)")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const list = data ?? [];
  if (list.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Henüz üyeliğin yok. Fitness veya yoga-pilates salonlarından satın alabilirsin.</p>;
  }
  return (
    <div className="space-y-3">
      {list.map((m) => (
        <div key={m.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold truncate flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-primary shrink-0" />{m.shop?.name}
              </p>
              <p className="text-sm text-muted-foreground">{m.service?.name}</p>
            </div>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold bg-primary/20 text-primary">
              {m.shop?.category === "fitness" ? "FITNESS" : "YOGA/PILATES"}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{format(new Date(m.created_at), "d MMMM yyyy · HH:mm", { locale: tr })}</p>
            {m.shop?.address && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{m.shop.address}</p>}
          </div>
          <p className="mt-2 font-display text-xl text-primary">{Number(m.amount).toFixed(0)}₺</p>
        </div>
      ))}
    </div>
  );
}

function CustomerMembershipsList({ userId, isAdmin = false }: { userId: string; isAdmin?: boolean }) {
  const { data: shopIds } = useQuery({
    queryKey: ["my-shop-ids-mem", userId, isAdmin],
    queryFn: async () => {
      if (isAdmin) return null;
      const [owned, asStaff] = await Promise.all([
        supabase.from("barbershops").select("id").eq("owner_id", userId),
        supabase.from("staff").select("shop_id").eq("user_id", userId),
      ]);
      const ownIds = (owned.data ?? []).map((s) => s.id);
      const staffIds = (asStaff.data ?? []).map((s) => s.shop_id);
      return Array.from(new Set([...ownIds, ...staffIds]));
    },
  });

  const { data: memberships } = useQuery({
    queryKey: ["shop-memberships", isAdmin ? "all" : shopIds],
    enabled: isAdmin || (!!shopIds && shopIds.length > 0),
    queryFn: async () => {
      let q = supabase
        .from("memberships")
        .select("id, amount, created_at, user_id, guest_name, guest_phone, shop_id, service_id, notes")
        .order("created_at", { ascending: false });
      if (!isAdmin) q = q.in("shop_id", shopIds!);
      const { data } = await q;
      return data ?? [];
    },
  });

  const userIds = Array.from(new Set((memberships ?? []).map((m) => m.user_id).filter(Boolean) as string[]));
  const { data: profiles } = useQuery({
    queryKey: ["mem-profiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, phone, email").in("id", userIds);
      const map = new Map<string, { full_name: string | null; phone: string | null; email: string | null }>();
      (data ?? []).forEach((p) => map.set(p.id, p));
      return map;
    },
  });

  const services = useQuery({
    queryKey: ["mem-services", memberships?.map((m) => m.service_id)],
    enabled: !!memberships && memberships.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set((memberships ?? []).map((m) => m.service_id).filter(Boolean) as string[]));
      const { data } = await supabase.from("services").select("id, name").in("id", ids);
      const m = new Map<string, string>();
      (data ?? []).forEach((s) => m.set(s.id, s.name));
      return m;
    },
  });

  const memShopIds = Array.from(new Set((memberships ?? []).map((m) => m.shop_id).filter(Boolean) as string[]));
  const shopsQ = useQuery({
    queryKey: ["mem-shops", memShopIds],
    enabled: memShopIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("barbershops").select("id, name").in("id", memShopIds);
      const m = new Map<string, string>();
      (data ?? []).forEach((s) => m.set(s.id, s.name));
      return m;
    },
  });

  if (!isAdmin && (!shopIds || shopIds.length === 0)) return <p className="py-8 text-center text-sm text-muted-foreground">Salonunuz/işiniz bulunamadı.</p>;
  if (!memberships || memberships.length === 0) return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Henüz üyelik satışı yok.</div>;

  if (!memberships || memberships.length === 0) return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Henüz üyelik satışı yok.</div>;

  const total = memberships.reduce((s, m) => s + Number(m.amount ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
        <p className="text-xs text-muted-foreground">Toplam üyelik geliri</p>
        <p className="font-display text-2xl text-primary">{total.toFixed(0)}₺ <span className="text-xs font-sans text-muted-foreground">({memberships.length} satış)</span></p>
      </div>
      {memberships.map((m) => {
        const p = m.user_id ? profiles?.get(m.user_id) : null;
        const name = p?.full_name ?? m.guest_name ?? "Müşteri";
        const phone = p?.phone ?? m.guest_phone ?? null;
        return (
          <div key={m.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{shopsQ.data?.get(m.shop_id) ?? ""}</p>
                {services.data?.get(m.service_id ?? "") && (
                  <p className="text-xs text-muted-foreground mt-0.5">{services.data.get(m.service_id ?? "")}</p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <CalIcon className="h-3 w-3" />
                  {format(new Date(m.created_at), "d MMM yyyy · HH:mm", { locale: tr })}
                </p>
              </div>
              <span className="shrink-0 font-display text-lg text-primary">{Number(m.amount).toFixed(0)}₺</span>
            </div>
            {phone && (
              <a href={`tel:${phone}`} className="mt-2 flex items-center gap-2 text-xs text-primary active:opacity-60">
                <Phone className="h-3.5 w-3.5" /> {phone}
              </a>
            )}
            {m.notes && (
              <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2">
                <p className="text-[10px] uppercase tracking-wider text-primary mb-0.5">Müşteri Notu</p>
                <p className="text-[12px] whitespace-pre-wrap">{m.notes}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
