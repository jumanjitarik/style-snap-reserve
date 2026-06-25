import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Store, Plus, Heart, Bell, User, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SafeImg } from "@/components/SafeImg";

type NavItem = { to: string; label: string; icon: typeof Home; fab?: boolean; profile?: boolean };

const baseItems: NavItem[] = [
  { to: "/", label: "Ana", icon: Home },
  { to: "/kuaforler", label: "Salonlar", icon: Store },
  { to: "/favoriler", label: "Favori", icon: Heart },
  { to: "/randevu-al", label: "Randevu Al", icon: Plus, fab: true },
  { to: "/randevularim", label: "Randevu", icon: CalendarCheck },
  { to: "/bildirimler", label: "Bildirim", icon: Bell },
  { to: "/hesap", label: "Hesap", icon: User, profile: true },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: u } = await supabase.auth.getUser();
      if (!active) return;
      if (!u.user) { setAvatar(null); return; }
      const { data: prof } = await supabase.from("profiles").select("avatar_url").eq("id", u.user.id).maybeSingle();
      if (!active) return;
      setAvatar(prof?.avatar_url ?? null);
    }
    load();
    const sub = supabase.auth.onAuthStateChange(() => load());
    return () => { active = false; sub.data.subscription.unsubscribe(); };
  }, []);

  // Hide on scroll down, show on scroll up.
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        if (y < 40) setHidden(false);
        else if (dy > 6) setHidden(true);
        else if (dy < -6) setHidden(false);
        lastY = y;
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const items: NavItem[] = baseItems;

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-50 border-t border-primary/20 bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-out",
      hidden ? "translate-y-full" : "translate-y-0",
    )}>
      <ul className="mx-auto flex max-w-md items-end justify-between px-1.5 pt-2">
        {items.map(({ to, label, icon: Icon, fab, profile }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          if (fab) {
            return (
              <li key={to} className="-mt-8">
                <Link
                  to={to as never}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_8px_24px_rgba(212,175,55,0.5)] ring-4 ring-background transition-all duration-150 active:scale-90"
                  aria-label={label}
                >
                  <Icon className="h-8 w-8" strokeWidth={2.5} />
                </Link>
              </li>
            );
          }
          return (
            <li key={to} className="flex-1">
              <Link
                to={to as never}
                className={cn(
                  "group relative flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium transition-all duration-150 active:scale-90",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn(
                  "absolute -top-0 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-primary transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )} />
                {profile && avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    className={cn(
                      "h-7 w-7 rounded-full object-cover ring-2 transition-transform",
                      active ? "ring-primary scale-110" : "ring-border",
                    )}
                  />
                ) : (
                  <Icon className={cn("h-6 w-6 transition-transform", active && "scale-110")} />
                )}
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
