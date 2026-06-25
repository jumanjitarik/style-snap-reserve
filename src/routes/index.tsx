import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Scissors, Star, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BarberApp — Berber & Güzellik Randevusu" },
      { name: "description", content: "Yakınındaki en iyi berberleri keşfet, online randevu al." },
    ],
  }),
  component: Index,
});

function Index() {
  const [q, setQ] = useState("");
  const { data: shops } = useQuery({
    queryKey: ["shops", "featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbershops")
        .select("id, name, category, address, cover_image_url")
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const filtered = (shops ?? []).filter((s) =>
    !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.address?.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell>
      <header className="px-4 pt-8 pb-4">
        <p className="text-xs uppercase tracking-widest text-primary">Hoş geldin</p>
        <h1 className="mt-1 text-4xl font-display">Bugün nasıl şıklaşıyoruz?</h1>
      </header>

      <div className="px-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Berber, salon, hizmet ara..."
            className="pl-9 bg-card border-border h-12"
          />
        </div>
      </div>

      <section className="px-4 pt-6">
        <h2 className="mb-3 text-lg font-display tracking-wider">Kategoriler</h2>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <Link
              key={c.value}
              to="/kuaforler"
              search={{ cat: c.value } as never}
              className="flex flex-col items-center gap-2 rounded-xl bg-card border border-border p-3 hover:border-primary/50 transition"
            >
              <c.icon className="h-6 w-6 text-primary" />
              <span className="text-[11px] text-center leading-tight">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-4 pt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-display tracking-wider">Öne Çıkanlar</h2>
          <Link to="/kuaforler" className="text-xs text-primary">Tümü →</Link>
        </div>
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <Scissors className="mx-auto mb-2 h-8 w-8 opacity-50" />
              Henüz salon eklenmemiş.
            </div>
          )}
          {filtered.map((s) => (
            <Link
              key={s.id}
              to="/kuafor/$id"
              params={{ id: s.id }}
              className="block overflow-hidden rounded-xl bg-card border border-border hover:border-primary/50 transition"
            >
              <div className="relative aspect-[16/9] bg-muted">
                {s.cover_image_url && (
                  <img src={s.cover_image_url} alt={s.name} className="h-full w-full object-cover" />
                )}
                <span className="absolute top-2 left-2 rounded-full bg-background/80 backdrop-blur px-2 py-0.5 text-[10px] font-medium">
                  {categoryLabel(s.category)}
                </span>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{s.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <Star className="h-3 w-3 fill-primary" />
                    <span>—</span>
                  </div>
                </div>
                {s.address && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{s.address}</span>
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
