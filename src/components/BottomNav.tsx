import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Scissors, Plus, Heart, Bell, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { to: string; label: string; icon: typeof Home; fab?: boolean };

const baseItems: NavItem[] = [
  { to: "/", label: "Ana", icon: Home },
  { to: "/kuaforler", label: "Kuaför", icon: Scissors },
  { to: "/favoriler", label: "Favori", icon: Heart },
  { to: "/randevu-al", label: "Randevu Al", icon: Plus, fab: true },
  { to: "/randevularim", label: "Randevu", icon: CalendarCheck },
  { to: "/bildirimler", label: "Bildirim", icon: Bell },
  { to: "/hesap", label: "Hesap", icon: User },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      if (active) setIsAdmin(!!data?.some((r) => r.role === "admin" || r.role === "owner"));
    })();
    const sub = supabase.auth.onAuthStateChange(() => {
      supabase.auth.getUser().then(async ({ data: u }) => {
        if (!u.user) { setIsAdmin(false); return; }
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
        setIsAdmin(!!data?.some((r) => r.role === "admin" || r.role === "owner"));
      });
    });
    return () => { active = false; sub.data.subscription.unsubscribe(); };
  }, []);

  const items: NavItem[] = isAdmin
    ? [...baseItems, { to: "/admin", label: "Admin", icon: Shield }]
    : baseItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-primary/20 bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
      <ul className="mx-auto flex max-w-md items-end justify-between px-1 pt-1.5">
        {items.map(({ to, label, icon: Icon, fab }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          if (fab) {
            return (
              <li key={to} className="-mt-7">
                <Link
                  to={to as never}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_8px_24px_rgba(212,175,55,0.45)] ring-4 ring-background transition-all duration-150 active:scale-90"
                  aria-label={label}
                >
                  <Icon className="h-7 w-7" strokeWidth={2.5} />
                </Link>
              </li>
            );
          }
          return (
            <li key={to} className="flex-1">
              <Link
                to={to as never}
                className={cn(
                  "group relative flex flex-col items-center gap-0.5 px-1 py-2 text-[9px] font-medium transition-all duration-150 active:scale-90",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn(
                  "absolute -top-0 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-primary transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )} />
                <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
