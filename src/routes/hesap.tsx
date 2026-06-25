import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { User, LogOut, Heart, Bell, CalendarDays, Shield, LogIn } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/hesap")({
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle()).data,
  });
  const { data: roles } = useQuery({
    queryKey: ["roles", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("user_roles").select("role").eq("user_id", userId!)).data ?? [],
  });

  const isAdmin = roles?.some((r) => r.role === "admin" || r.role === "owner");

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Çıkış yapıldı");
    navigate({ to: "/" });
  }

  if (!userId) {
    return (
      <AppShell>
        <header className="px-4 pt-8 pb-3"><h1 className="font-display text-3xl">Hesap</h1></header>
        <div className="px-4">
          <Link to="/auth" className="flex items-center justify-center gap-2 h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 font-semibold text-primary-foreground active:scale-95 transition">
            <LogIn className="h-5 w-5" /> Giriş Yap / Kayıt Ol
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="px-4 pt-8 pb-3">
        <h1 className="font-display text-3xl">Hesap</h1>
      </header>
      <div className="px-4 space-y-3">
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center"><User className="h-6 w-6 text-primary" /></div>
            <div className="min-w-0">
              <p className="font-display text-xl truncate">{profile?.full_name ?? "Kullanıcı"}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              {profile?.phone && <p className="text-xs text-muted-foreground">{profile.phone}</p>}
            </div>
          </div>
          {roles && roles.length > 0 && (
            <div className="mt-3 flex gap-1 flex-wrap">
              {roles.map((r) => (
                <span key={r.role} className="rounded-full bg-primary/20 text-primary text-[10px] uppercase tracking-wider px-2 py-0.5 font-bold">
                  {r.role}
                </span>
              ))}
            </div>
          )}
        </div>

        <Link to="/randevularim" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 active:scale-[0.98] transition">
          <CalendarDays className="h-5 w-5 text-primary" /><span>Randevularım</span>
        </Link>
        <Link to="/bildirimler" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 active:scale-[0.98] transition">
          <Bell className="h-5 w-5 text-primary" /><span>Bildirimler</span>
        </Link>
        <Link to="/favoriler" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 active:scale-[0.98] transition">
          <Heart className="h-5 w-5 text-primary" /><span>Favoriler</span>
        </Link>
        {isAdmin && (
          <Link to="/admin" className="flex items-center gap-3 rounded-xl border border-primary/40 bg-card p-4 active:scale-[0.98] transition">
            <Shield className="h-5 w-5 text-primary" /><span className="font-semibold">Yönetici Paneli</span>
          </Link>
        )}
        <Button variant="outline" onClick={signOut} className="w-full h-12 mt-4">
          <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
        </Button>
      </div>
    </AppShell>
  );
}
