import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bildirimler")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: NotifPage,
});

function NotifPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase.from("notifications").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase.from("notifications").update({ read: true }).eq("user_id", u.user.id).eq("read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <AppShell>
      <header className="px-4 pt-8 pb-3 flex items-center justify-between">
        <h1 className="font-display text-3xl">Bildirimler</h1>
        <button onClick={() => markAll.mutate()} className="text-xs text-primary active:opacity-60">Tümünü okundu işaretle</button>
      </header>
      <div className="px-4 space-y-2">
        {(data ?? []).map((n) => (
          <div key={n.id} className={`rounded-xl border p-3 ${n.read ? "border-border bg-card" : "border-primary/40 bg-primary/5"}`}>
            <div className="flex items-start gap-2">
              <Bell className={`h-4 w-4 mt-0.5 shrink-0 ${n.read ? "text-muted-foreground" : "text-primary"}`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.created_at), "d MMM yyyy HH:mm", { locale: tr })}</p>
              </div>
            </div>
          </div>
        ))}
        {(data ?? []).length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Henüz bildirim yok.</p>
        )}
      </div>
    </AppShell>
  );
}
