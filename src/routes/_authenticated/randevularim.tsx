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
import { Calendar, MapPin, Phone, Calendar as CalIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/randevularim")({
  component: MyAppts,
});

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

function MyAppts() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isStaffOrOwner, setIsStaffOrOwner] = useState(false);
  const [tab, setTab] = useState<"customers" | "mine">("customers");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const so = !!roles?.some((r) => r.role === "owner" || r.role === "staff" || r.role === "admin");
      setIsStaffOrOwner(so);
      if (!so) setTab("mine");
    });
  }, []);

  return (
    <AppShell>
      <BackButton to="/" />
      <header className="px-4 pt-4 pb-3">
        <h1 className="font-display text-3xl">Randevular</h1>
        <p className="text-xs text-muted-foreground">İptal en geç randevudan 24 saat önce yapılabilir.</p>
      </header>

      {isStaffOrOwner && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
            <button
              onClick={() => setTab("customers")}
              className={cn("rounded-lg py-2 text-sm font-medium transition", tab === "customers" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >Müşteri Randevuları</button>
            <button
              onClick={() => setTab("mine")}
              className={cn("rounded-lg py-2 text-sm font-medium transition", tab === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >Randevularım</button>
          </div>
        </div>
      )}

      <div className="px-4 pb-6">
        {tab === "mine" && <MyOwnList />}
        {tab === "customers" && userId && <CustomerList userId={userId} />}
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
  // open first (sorted ascending nearest), then past/cancelled
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

function CustomerList({ userId }: { userId: string }) {
  const { data: shopIds } = useQuery({
    queryKey: ["my-shop-ids", userId],
    queryFn: async () => {
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
    queryKey: ["staff-appts", shopIds],
    enabled: !!shopIds && shopIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, starts_at, status, payment_amount, deposit_amount, remaining_amount, discount_amount, points_used, user_id, guest_name, guest_phone, shop_id, service_id, notes")
        .in("shop_id", shopIds!)
        .order("starts_at", { ascending: true });
      return data ?? [];
    },
  });

  const userIds = Array.from(new Set((appts ?? []).map((a) => a.user_id).filter(Boolean) as string[]));
  const { data: profiles } = useQuery({
    queryKey: ["appt-profiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_customer_basics", { _ids: userIds });
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

  if (!shopIds || shopIds.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Salonunuz/işiniz bulunamadı.</p>;
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
