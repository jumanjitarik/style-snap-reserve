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
      const { data } = await supabase.from("app_settings").select("key, value").in("key", ["splash_url", "splash_duration_ms"]);
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? ""])) as Record<string, string>;
    },
    staleTime: 60_000,
  });

  const splash = data?.splash_url?.trim();

  useEffect(() => {
    if (alreadyShown || isLoading) return;
    // Only show splash if admin has uploaded one
    if (!splash) {
      try { sessionStorage.setItem(SHOWN_KEY, "1"); } catch {}
      setVisible(false);
      return;
    }
    const ms = Math.max(0, Math.min(15000, Number(data?.splash_duration_ms ?? "1500") || 1500));
    const finish = () => { try { sessionStorage.setItem(SHOWN_KEY, "1"); } catch {} setVisible(false); };
    if (ms === 0) { finish(); return; }
    const t = setTimeout(finish, ms);
    return () => clearTimeout(t);
  }, [isLoading, data, alreadyShown, splash]);

  if (!visible || !splash) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background animate-in fade-in">
      <SafeImg src={splash} alt="splash" className="absolute inset-0 h-full w-full object-cover" />
    </div>
  );
}
