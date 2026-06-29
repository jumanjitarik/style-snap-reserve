import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { Heart, Bell, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SafeImg } from "./SafeImg";
import defaultLogo from "@/assets/barber-logo.png.asset.json";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function TopBar() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hidden, setHidden] = useState(false);
  const [unread, setUnread] = useState(0);
  const [signedIn, setSignedIn] = useState(false);

  const { data: branding } = useQuery({
    queryKey: ["app-branding"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("key, value").in("key", ["app_name", "logo_url"]);
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? ""])) as { app_name?: string; logo_url?: string };
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    let active = true;
    let userId: string | null = null;
    async function loadUnread() {
      const { data: u } = await supabase.auth.getUser();
      if (!active) return;
      userId = u.user?.id ?? null;
      setSignedIn(!!userId);
      if (!userId) { setUnread(0); return; }
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("read", false);
      if (active) setUnread(count ?? 0);
    }
    loadUnread();
    const sub = supabase.auth.onAuthStateChange(() => loadUnread());
    const ch = supabase.channel("topbar-notif").on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => loadUnread()).subscribe();
    return () => { active = false; sub.data.subscription.unsubscribe(); supabase.removeChannel(ch); };
  }, []);

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

  const name = branding?.app_name?.trim() || "BarberApp";
  const logo = branding?.logo_url?.trim() || defaultLogo.url;
  const isHome = pathname === "/";

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ${hidden ? "-translate-y-full" : "translate-y-0"}`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-md px-3 py-2 flex items-center gap-2 bg-background/85 backdrop-blur-xl border-b border-primary/15">
        {!isHome && (
          <button
            onClick={() => router.history.back()}
            aria-label="Geri"
            className="shrink-0 rounded-full p-2 text-primary active:scale-90 transition hover:bg-primary/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <Link to="/" className="flex items-center gap-2 flex-1 min-w-0 active:opacity-70">
          {logo ? (
            <SafeImg src={logo} alt="logo" className="h-7 w-7 rounded-md object-cover" />
          ) : (
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-primary/40" />
          )}
          <span className="font-display text-lg tracking-wide text-primary truncate">{name}</span>
        </Link>
        {signedIn ? (
          <div className="flex items-center gap-1">
            <Link to="/favoriler" aria-label="Favoriler" className="rounded-full p-2 text-primary active:scale-90 transition hover:bg-primary/10">
              <Heart className="h-5 w-5" />
            </Link>
            <Link to="/bildirimler" aria-label="Bildirimler" className="relative rounded-full p-2 text-primary active:scale-90 transition hover:bg-primary/10">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          </div>
        ) : (
          <LanguageSwitcher />
        )}
      </div>
    </div>
  );
}
