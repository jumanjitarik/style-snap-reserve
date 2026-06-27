import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SafeImg } from "./SafeImg";

export function TopBar() {
  const [hidden, setHidden] = useState(false);
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

  const name = branding?.app_name?.trim() || "BarberApp";
  const logo = branding?.logo_url?.trim();

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ${hidden ? "-translate-y-full" : "translate-y-0"}`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-md px-4 py-2.5 flex items-center gap-2 bg-background/80 backdrop-blur-xl border-b border-primary/15">
        {logo ? (
          <SafeImg src={logo} alt="logo" className="h-7 w-7 rounded-md object-cover" />
        ) : (
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-primary/40" />
        )}
        <span className="font-display text-lg tracking-wide text-primary">{name}</span>
      </div>
    </div>
  );
}
