import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SafeImg } from "./SafeImg";
import { cn } from "@/lib/utils";

export function TopBar() {
  const [hidden, setHidden] = useState(false);
  const [unread, setUnread] = useState(0);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: branding } = useQuery({
    queryKey: ["app-branding"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("key, value").in("key", ["app_name", "logo_url"]);
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? ""])) as { app_name?: string; logo_url?: string };
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      if (y < 12) setHidden(false);
      else if (dy > 4) setHidden(true);
      else if (dy < -4) setHidden(false);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadUnread() {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id ?? null;
      if (!userId) { setUnread(0); return; }
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("read", false);
      if (!active) return;
      setUnread(count ?? 0);
    }
    loadUnread();
    const ch = supabase
      .channel("topbar-notif")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => loadUnread())
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  const name = branding?.app_name?.trim() || "BarberApp";
  const logo = branding?.logo_url?.trim();

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ${hidden ? "-translate-y-full" : "translate-y-0"}`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-md px-4 py-2.5 flex items-center gap-3 bg-background/80 backdrop-blur-xl border-b border-primary/15">
        <Link to="/favoriler" className="relative p-0.5 shrink-0" aria-label="Favoriler">
          <Heart className={cn("h-5 w-5", pathname.startsWith("/favoriler") ? "text-primary" : "text-muted-foreground")} />
        </Link>
        <Link to="/bildirimler" className="relative p-0.5 shrink-0" aria-label="Bildirimler">
          <Bell className={cn("h-5 w-5", pathname.startsWith("/bildirimler") ? "text-primary" : "text-muted-foreground")} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        {logo ? (
          <SafeImg src={logo} alt="logo" className="h-7 w-7 rounded-md object-cover shrink-0" />
        ) : (
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-primary/40 shrink-0" />
        )}
        <span className="font-display text-lg tracking-wide text-primary">{name}</span>
      </div>
    </div>
  );
}
