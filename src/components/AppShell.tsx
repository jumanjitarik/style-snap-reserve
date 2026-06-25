import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { startPushNotifications } from "@/lib/push";

export function AppShell({ children }: { children: ReactNode }) {
  const [showStaffBtn, setShowStaffBtn] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: u } = await supabase.auth.getUser();
      if (!active || !u.user) { setShowStaffBtn(false); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      if (!active) return;
      setShowStaffBtn(!!roles?.some((r) => r.role === "owner" || r.role === "staff"));
      startPushNotifications(u.user.id);
    }
    load();
    const sub = supabase.auth.onAuthStateChange(() => load());
    return () => { active = false; sub.data.subscription.unsubscribe(); };
  }, []);

  return (
    <div className="min-h-screen pb-28">
      <div className="mx-auto max-w-md">{children}</div>
      {showStaffBtn && (
        <Link
          to="/musteriler"
          aria-label="Müşteriler"
          className="fixed right-3 z-40 flex items-center gap-2 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-4 h-12 font-semibold shadow-[0_8px_24px_rgba(212,175,55,0.45)] active:scale-95 transition"
          style={{ bottom: `calc(env(safe-area-inset-bottom) + 90px)` }}
        >
          <Users className="h-5 w-5" /> Müşteri
        </Link>
      )}
      <BottomNav />
    </div>
  );
}
