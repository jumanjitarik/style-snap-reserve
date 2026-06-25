import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Scissors, Plus, CalendarDays, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Ana Sayfa", icon: Home },
  { to: "/kuaforler", label: "Kuaförler", icon: Scissors },
  { to: "/randevu-al", label: "Randevu Al", icon: Plus, fab: true },
  { to: "/randevularim", label: "Randevular", icon: CalendarDays },
  { to: "/favoriler", label: "Favoriler", icon: Heart },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md items-end justify-between px-2 pt-2">
        {items.map(({ to, label, icon: Icon, fab }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          if (fab) {
            return (
              <li key={to} className="-mt-7">
                <Link
                  to={to}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95"
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
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
