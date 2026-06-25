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
  const [unread, setUnread] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: u } = await supabase.auth.getUser();
      if (!active) return;
      if (!u.user) { setAvatar(null); setUnread(0); return; }
      const [{ data: prof }, { count }] = await Promise.all([
        supabase.from("profiles").select("avatar_url").eq("id", u.user.id).maybeSingle(),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", u.user.id).eq("read", false),
      ]);
      if (!active) return;
      setAvatar(prof?.avatar_url ?? null);
      setUnread(count ?? 0);
    }
    load();
    const sub = supabase.auth.onAuthStateChange(() => load());
    // realtime unread updates
    const ch = supabase
      .channel("nav-notif")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => load())
      .subscribe();
    return () => { active = false; sub.data.subscription.unsubscribe(); supabase.removeChannel(ch); };
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
    <div
      className={cn(
        "fixed left-0 right-0 z-50 flex justify-center px-3 transition-transform duration-300 ease-out pointer-events-none",
        hidden ? "translate-y-[140%]" : "translate-y-0",
      )}
      style={{ bottom: `calc(env(safe-area-inset-bottom) + 12px)` }}
    >
      <nav className="pointer-events-auto w-full max-w-md rounded-[28px] border border-primary/25 bg-card/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
        <ul className="flex items-end justify-between px-2 pt-2 pb-1.5">
          {items.map(({ to, label, icon: Icon, fab, profile }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            if (fab) {
              return (
                <li key={to} className="-mt-7">
                  <Link
                    to={to as never}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_8px_24px_rgba(212,175,55,0.5)] ring-4 ring-card transition-all duration-150 active:scale-90"
                    aria-label={label}
                  >
                    <Icon className="h-7 w-7" strokeWidth={2.5} />
                  </Link>
                </li>
              );
            }
            const showBadge = to === "/bildirimler" && unread > 0;
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to as never}
                  className={cn(
                    "group relative flex flex-col items-center gap-0.5 px-1 py-1.5 text-[10px] font-medium transition-all duration-150 active:scale-90",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className={cn(
                    "absolute top-0 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-primary transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )} />
                  <div className="relative h-7 w-7 flex items-center justify-center">
                    {profile ? (
                      avatar ? (
                        <SafeImg
                          src={avatar}
                          alt=""
                          className={cn(
                            "absolute inset-0 h-7 w-7 rounded-full object-cover ring-2",
                            active ? "ring-primary" : "ring-border",
                          )}
                        />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )
                    ) : (
                      <Icon className="h-6 w-6" />
                    )}
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-card">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                  <span className="truncate">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
