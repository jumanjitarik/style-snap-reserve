import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import { Calendar, MapPin, Users as UsersIcon, Phone, Calendar as CalIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/randevularim")({
  component: MyAppts,
});

function MyAppts() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [isStaffOrOwner, setIsStaffOrOwner] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      setIsStaffOrOwner(!!roles?.some((r) => r.role === "owner" || r.role === "staff" || r.role === "admin"));
    });
  }, []);

  const { data } = useQuery({
    queryKey: ["my-appts"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("appointments")
        .select("id, starts_at, status, payment_amount, shop:barbershops(id,name,address), service:services(name)")
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

  return (
    <AppShell>
      <BackButton to="/" />
      <header className="px-4 pt-16 pb-3">
        <h1 className="font-display text-3xl">Randevularım</h1>
        <p className="text-xs text-muted-foreground">İptal en geç randevudan 24 saat önce yapılabilir.</p>
      </header>
      <div className="px-4 space-y-3">
        {(data ?? []).map((a) => {
          const startsAt = new Date(a.starts_at);
          const hoursLeft = (startsAt.getTime() - Date.now()) / 3_600_000;
          const canCancel = hoursLeft > 24 && a.status === "confirmed";
          const upcoming = startsAt > new Date() && a.status === "confirmed";
          return (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{a.shop?.name}</p>
                  <p className="text-sm text-muted-foreground">{a.service?.name}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  a.status === "confirmed" ? "bg-primary/20 text-primary" :
                  a.status === "cancelled" ? "bg-destructive/20 text-destructive" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {a.status === "confirmed" ? "Onaylı" : a.status === "cancelled" ? "İptal" : a.status === "completed" ? "Tamamlandı" : "Bekliyor"}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{format(startsAt, "d MMMM yyyy · HH:mm", { locale: tr })}</p>
                {a.shop?.address && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{a.shop.address}</p>}
              </div>
              {upcoming && (
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
        {(data ?? []).length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Henüz randevu yok.</p>
        )}

        {userId && isStaffOrOwner && <CustomerAppointmentsSection userId={userId} />}
      </div>
    </AppShell>
  );
}

function CustomerAppointmentsSection({ userId }: { userId: string }) {
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
        .select("id, starts_at, status, payment_amount, user_id, guest_name, guest_phone, shop_id, service_id")
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

  if (!shopIds || shopIds.length === 0) return null;

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <UsersIcon className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl mt-2">Müşteri Randevuları</h2>
      </div>
      <p className="text-xs text-muted-foreground">Salonunuza/işinize gelen randevular</p>
      {(!appts || appts.length === 0) ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Henüz randevu yok.
        </div>
      ) : (
        appts.map((a) => {
          const p = a.user_id ? profiles?.get(a.user_id) : null;
          const name = p?.full_name ?? a.guest_name ?? "Müşteri";
          const phone = p?.phone ?? a.guest_phone ?? null;
          return (
            <div key={a.id} className="rounded-xl border border-border bg-card p-3">
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
                <span className={`shrink-0 rounded-full text-[10px] uppercase tracking-wider px-2 py-0.5 font-bold ${a.status === "confirmed" ? "bg-primary/20 text-primary" : a.status === "cancelled" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>
                  {a.status}
                </span>
              </div>
              {phone && (
                <a href={`tel:${phone}`} className="mt-2 flex items-center gap-2 text-xs text-primary active:opacity-60">
                  <Phone className="h-3.5 w-3.5" /> {phone}
                </a>
              )}
              {a.payment_amount && <p className="mt-1 text-xs">Ücret: <span className="font-bold text-primary">{Number(a.payment_amount).toFixed(0)}₺</span></p>}
            </div>
          );
        })
      )}
    </div>
  );
}
