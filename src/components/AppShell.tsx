import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { SplashScreen } from "./SplashScreen";
import { AnnouncementPopup } from "./AnnouncementPopup";
import { PullToRefresh } from "./PullToRefresh";
import { supabase } from "@/integrations/supabase/client";
import { startPushNotifications } from "@/lib/push";

export function AppShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setMounted(true);
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    let active = true;
    async function load() {
      const { data: u } = await supabase.auth.getUser();
      if (!active || !u.user) return;
      startPushNotifications(u.user.id);
    }
    load();
    const sub = supabase.auth.onAuthStateChange(() => load());
    return () => { active = false; sub.data.subscription.unsubscribe(); };
  }, []);

  return (
    <div className="min-h-screen pb-24 pt-11">
      {mounted && <SplashScreen />}
      <TopBar />
      {mounted && <PullToRefresh />}
      <div key={pathname} className="mx-auto w-full max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl page-transition">{children}</div>
      <BottomNav />
      {mounted && <AnnouncementPopup />}
    </div>
  );
}


