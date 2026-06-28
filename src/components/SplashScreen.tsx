import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SafeImg } from "./SafeImg";

const SHOWN_KEY = "splash_shown_v1";

export function SplashScreen() {
  const alreadyShown = typeof window !== "undefined" && sessionStorage.getItem(SHOWN_KEY) === "1";
  const [visible, setVisible] = useState(!alreadyShown);
  const { data, isLoading } = useQuery({
    enabled: !alreadyShown,
    queryKey: ["splash-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("key, value").in("key", ["splash_url", "splash_duration_ms", "app_name", "logo_url"]);
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? ""])) as Record<string, string>;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (alreadyShown || isLoading) return;
    const ms = Math.max(0, Math.min(15000, Number(data?.splash_duration_ms ?? "1500") || 1500));
    const finish = () => { try { sessionStorage.setItem(SHOWN_KEY, "1"); } catch {} setVisible(false); };
    if (ms === 0) { finish(); return; }
    const t = setTimeout(finish, ms);
    return () => clearTimeout(t);
  }, [isLoading, data, alreadyShown]);

  if (!visible) return null;
  const splash = data?.splash_url?.trim();
  const logo = data?.logo_url?.trim();
  const name = data?.app_name?.trim() || "BarberApp";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background animate-in fade-in" style={{ animation: "splashFade 300ms ease" }}>
      {splash ? (
        <SafeImg src={splash} alt="splash" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/10" />
      )}
      <div className="relative flex flex-col items-center gap-3">
        {logo && <SafeImg src={logo} alt="logo" className="h-20 w-20 rounded-2xl object-cover shadow-2xl" />}
        <span className="font-display text-3xl tracking-wider text-primary drop-shadow">{name}</span>
      </div>
    </div>
  );
}
