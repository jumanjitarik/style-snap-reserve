import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Users as UsersIcon, Phone, Calendar as CalIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/musteriler")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const ok = roles?.some((r) => r.role === "owner" || r.role === "staff" || r.role === "admin");
    if (!ok) throw redirect({ to: "/" });
  },
  component: StaffCustomersPage,
});

function StaffCustomersPage() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const { data: shopIds } = useQuery({
    queryKey: ["my-shop-ids", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [owned, asStaff] = await Promise.all([
        supabase.from("barbershops").select("id, name").eq("owner_id", userId!),
        supabase.from("staff").select("shop_id").eq("user_id", userId!),
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
        .select("id, starts_at, status, payment_amount, user_id, guest_name, guest_phone, shop_id, service_id, staff_id")
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

  return (
    <AppShell>
      <BackButton to="/" />
      <header className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <UsersIcon className="h-6 w-6 text-primary" />
          <h1 className="font-display text-3xl">Müşterilerim</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Salonuna/işine gelen tüm randevular</p>
      </header>

      <div className="px-4 space-y-3 pb-4">
        {(!appts || appts.length === 0) && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Henüz randevu yok.
          </div>
        )}
        {(appts ?? []).map((a) => {
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
        })}
        <Link to="/" className="block text-center text-xs text-muted-foreground mt-4">← Ana sayfa</Link>
      </div>
    </AppShell>
  );
}
