import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { CATEGORIES, categoryLabel, type ShopCategory } from "@/lib/categories";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ cat: z.string().optional() });

export const Route = createFileRoute("/kuaforler")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Kuaförler — BarberApp" }] }),
  component: ShopList,
});

function ShopList() {
  const { cat } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useQuery({
    queryKey: ["shops", cat ?? "all"],
    queryFn: async () => {
      let q = supabase.from("barbershops").select("id, name, category, address, cover_image_url");
      if (cat) q = q.eq("category", cat as ShopCategory);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell>
      <BackButton to="/" />
      <header className="px-4 pt-16 pb-3">
        <h1 className="text-3xl font-display">Kuaförler</h1>
      </header>
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
        <button
          onClick={() => navigate({ search: {} })}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition",
            !cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground",
          )}
        >
          Tümü
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => navigate({ search: { cat: c.value } })}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition",
              cat === c.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4 pb-4">
        {(data ?? []).map((s) => (
          <Link
            key={s.id}
            to="/kuafor/$id"
            params={{ id: s.id }}
            className="flex gap-3 overflow-hidden rounded-xl bg-card border border-border hover:border-primary/50 transition p-3"
          >
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
              {s.cover_image_url && <img src={s.cover_image_url} alt={s.name} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-primary">{categoryLabel(s.category)}</p>
              <h3 className="font-semibold leading-tight truncate">{s.name}</h3>
              {s.address && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{s.address}</span>
                </p>
              )}
            </div>
          </Link>
        ))}
        {(data ?? []).length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Bu kategoride salon yok.</p>
        )}
      </div>
    </AppShell>
  );
}
