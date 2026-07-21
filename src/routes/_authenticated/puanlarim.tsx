import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Coins, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/puanlarim")({
  ssr: false,
  component: PuanlarimPage,
});

function PuanlarimPage() {
  const { data: loyaltyPct } = useQuery({
    queryKey: ["loyalty-percent"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "loyalty_percent").maybeSingle();
      const v: any = data?.value;
      const n = typeof v === "number" ? v : Number(v ?? 1);
      return Number.isFinite(n) ? n : 1;
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
  const pct = loyaltyPct ?? 1;

  const { data: profile } = useQuery({
    queryKey: ["my-points-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("points, full_name").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const { data: welcomeBonus } = useQuery({
    queryKey: ["my-points-welcome"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("app_settings").select("value").eq("key", "welcome_points").maybeSingle();
      const n = Number((data?.value ?? "0") as string);
      const amount = Number.isFinite(n) && n > 0 ? n : 0;
      return { amount, at: u.user.created_at ?? null };
    },
  });

  const { data: appts } = useQuery({
    queryKey: ["my-points-appts"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("appointments")
        .select("id, starts_at, created_at, status, payment_amount, points_earned, points_used, service_ids, shop_id, barbershops:shop_id(name)")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: serviceMap } = useQuery({
    queryKey: ["my-points-services"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("id, name");
      const m = new Map<string, string>();
      (data ?? []).forEach((s) => m.set(s.id, s.name));
      return m;
    },
  });

  const stats = useMemo(() => {
    let earned = 0, used = 0;
    (appts ?? []).forEach((a: any) => {
      earned += Number(a.points_earned ?? 0);
      used += Number(a.points_used ?? 0);
    });
    if (welcomeBonus?.amount) earned += welcomeBonus.amount;
    return { earned, used };
  }, [appts, welcomeBonus]);


  return (
    <AppShell>
      <header className="px-4 pt-4 pb-3">
        <h1 className="font-display text-3xl flex items-center gap-2"><Coins className="h-7 w-7 text-primary" /> Puanlarım</h1>
        <p className="text-xs text-muted-foreground">Her ödemenin %{pct}'i puan olarak kazanılır. 1 puan = 1₺ indirim.</p>
      </header>

      <div className="px-4 space-y-3 pb-6">
        <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5 p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Mevcut Bakiye</p>
          <p className="font-display text-5xl text-primary mt-1">{profile?.points ?? 0}</p>
          <p className="text-[11px] text-muted-foreground mt-1">≈ {profile?.points ?? 0}₺ indirim</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-emerald-500 flex items-center justify-center gap-1"><TrendingUp className="h-3 w-3" /> Toplam Kazanılan</p>
            <p className="font-display text-2xl text-emerald-500 mt-1">+{stats.earned}</p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-amber-500 flex items-center justify-center gap-1"><TrendingDown className="h-3 w-3" /> Toplam Kullanılan</p>
            <p className="font-display text-2xl text-amber-500 mt-1">−{stats.used}</p>
          </div>
        </div>

        <h2 className="font-display text-lg pt-2">İşlem Geçmişi</h2>
        <div className="space-y-2">
          {(appts ?? []).length === 0 && !welcomeBonus?.amount && (
            <p className="text-sm text-muted-foreground text-center py-6">Henüz puan hareketi yok.</p>
          )}
          {(appts ?? []).map((a: any) => {
            const earned = Number(a.points_earned ?? 0);
            const used = Number(a.points_used ?? 0);
            const names = (a.service_ids ?? []).map((id: string) => serviceMap?.get(id) ?? "—").join(", ");
            const d = new Date(a.starts_at);
            return (
              <div key={a.id} className="rounded-xl border border-border bg-card p-3 text-xs space-y-1">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold text-sm truncate">{a.barbershops?.name ?? "Salon"}</p>
                  <p className="text-muted-foreground">{Number(a.payment_amount ?? 0).toFixed(0)}₺</p>
                </div>
                <p className="text-muted-foreground">🗓 {d.toLocaleDateString("tr-TR")} · {d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</p>
                <p>✂️ {names || "—"}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {earned > 0 && (
                    <span className="rounded-full bg-emerald-500/15 text-emerald-500 px-2 py-0.5 text-[10px] font-bold">
                      +{earned} puan kazanıldı
                    </span>
                  )}
                  {used > 0 && (
                    <span className="rounded-full bg-amber-500/15 text-amber-500 px-2 py-0.5 text-[10px] font-bold">
                      −{used} puan kullanıldı
                    </span>
                  )}
                  {earned === 0 && used === 0 && (
                    <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px]">Puan hareketi yok</span>
                  )}
                </div>
              </div>
            );
          })}
          {welcomeBonus?.amount ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
              <div className="flex justify-between gap-2">
                <p className="font-semibold text-sm">🎁 Hoş Geldin Bonusu</p>
                <p className="text-muted-foreground">
                  {welcomeBonus.at ? new Date(welcomeBonus.at).toLocaleDateString("tr-TR") : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="rounded-full bg-emerald-500/15 text-emerald-500 px-2 py-0.5 text-[10px] font-bold">
                  +{welcomeBonus.amount} puan kazanıldı
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
