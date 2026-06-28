import { SafeImg } from "@/components/SafeImg";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { Heart, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/favoriler")({
  component: Favs,
});

function Favs() {
  const { data } = useQuery({
    queryKey: ["favs"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("favorites")
        .select("shop:barbershops(id, name, address, cover_image_url)")
        .eq("user_id", u.user.id);
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <BackButton to="/" />
      <header className="px-4 pt-4 pb-3">
        <h1 className="font-display text-3xl">Favorilerim</h1>
      </header>
      <div className="px-4 space-y-3">
        {(data ?? []).map((f) => f.shop && (
          <Link key={f.shop.id} to="/kuafor/$id" params={{ id: f.shop.id }}
            className="flex gap-3 rounded-xl bg-card border border-border p-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
              {f.shop.cover_image_url && <SafeImg src={f.shop.cover_image_url} alt={f.shop.name} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{f.shop.name}</p>
              {f.shop.address && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{f.shop.address}</span>
                </p>
              )}
            </div>
          </Link>
        ))}
        {(data ?? []).length === 0 && (
          <div className="py-16 text-center">
            <Heart className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Henüz favori salon yok.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
