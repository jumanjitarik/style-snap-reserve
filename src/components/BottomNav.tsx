import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Store, Plus, User, CalendarCheck, Coins, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

type NavItem = { to: string; labelKey: string; icon: typeof Home; fab?: boolean; profile?: boolean };

const items: NavItem[] = [
  { to: "/", labelKey: "nav.home", icon: Home },
  { to: "/kuaforler", labelKey: "nav.shops", icon: Store },
  { to: "/borsa", labelKey: "nav.borsa", icon: LineChart },
  { to: "/randevu-al", labelKey: "nav.book", icon: Plus, fab: true },
  { to: "/puanlarim", labelKey: "nav.points", icon: Coins },
  { to: "/randevularim", labelKey: "nav.appointments", icon: CalendarCheck },
  { to: "/hesap", labelKey: "nav.account", icon: User, profile: true },
];

const AVATAR_CACHE_KEY = "nav.avatarUrl";

function readCachedAvatar(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(AVATAR_CACHE_KEY); } catch { return null; }
}

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [avatar, setAvatar] = useState<string | null>(() => readCachedAvatar());
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      const { data: u } = await supabase.auth.getUser();
      if (!active) return;
      const userId = u.user?.id ?? null;
      if (!userId) {
        setAvatar(null);
        try { window.localStorage.removeItem(AVATAR_CACHE_KEY); } catch { /* noop */ }
        return;
      }
      const { data: prof } = await supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
      if (!active) return;
      const next = prof?.avatar_url ?? null;
      setAvatar((prev) => (prev === next ? prev : next));
      try {
        if (next) window.localStorage.setItem(AVATAR_CACHE_KEY, next);
        else window.localStorage.removeItem(AVATAR_CACHE_KEY);
      } catch { /* noop */ }
    }
    loadProfile();
    const sub = supabase.auth.onAuthStateChange(() => loadProfile());
    return () => { active = false; sub.data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        if (y < 24) setHidden(false);
        else if (dy > 4) setHidden(true);
        else if (dy < -8) setHidden(false);
        lastY = y;
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-50 flex justify-center px-2 transition-transform duration-300 ease-out pointer-events-none",
        hidden ? "translate-y-[140%]" : "translate-y-0",
      )}
      style={{ bottom: `calc(env(safe-area-inset-bottom) + 8px)` }}
    >
      <nav className="pointer-events-auto w-full max-w-[460px] rounded-[26px] border border-primary/25 bg-card/85 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <ul className="grid grid-cols-7 items-end px-1.5 pt-1.5 pb-1">
          {items.map(({ to, labelKey, icon: Icon, fab, profile }) => {
            const label = t(labelKey);
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            if (fab) {
              return (
                <li key={to} className="flex justify-center -mt-6">
                  <Link
                    to={to as never}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_6px_22px_rgba(212,175,55,0.55)] ring-[3px] ring-card transition-all duration-150 active:scale-90"
                    aria-label={label}
                  >
                    <Icon className="h-6 w-6" strokeWidth={2.5} />
                  </Link>
                </li>
              );
            }
            return (
              <li key={to}>
                <Link
                  to={to as never}
                  className={cn(
                    "group relative flex flex-col items-center gap-0.5 px-0.5 py-1 text-[10px] font-medium transition-all duration-150 active:scale-90",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className={cn(
                    "absolute top-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-primary transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )} />
                  <div className="relative h-6 w-6 flex items-center justify-center">
                    {profile && avatar ? (
                      <SafeImg
                        src={avatar}
                        alt=""
                        className={cn(
                          "absolute inset-0 h-6 w-6 rounded-full object-cover ring-2",
                          active ? "ring-primary" : "ring-border",
                        )}
                      />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className="truncate leading-none">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
