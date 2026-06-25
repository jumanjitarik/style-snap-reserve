import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import { Calendar, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/randevularim")({
  component: MyAppts,
});

function MyAppts() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["my-appts"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("appointments")
        .select("id, starts_at, status, payment_amount, shop:barbershops(id,name,address), service:services(name)")
        .eq("user_id", u.user.id)
        .order("starts_at", { ascending: false });
      return data ?? [];
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("İptal edildi"); qc.invalidateQueries({ queryKey: ["my-appts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <header className="px-4 pt-8 pb-3">
        <h1 className="font-display text-3xl">Randevularım</h1>
      </header>
      <div className="px-4 space-y-3">
        {(data ?? []).map((a) => {
          const upcoming = new Date(a.starts_at) > new Date() && a.status === "confirmed";
          return (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{a.shop?.name}</p>
                  <p className="text-sm text-muted-foreground">{a.service?.name}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  a.status === "confirmed" ? "bg-primary/20 text-primary" :
                  a.status === "cancelled" ? "bg-destructive/20 text-destructive" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {a.status === "confirmed" ? "Onaylı" : a.status === "cancelled" ? "İptal" : a.status === "completed" ? "Tamamlandı" : "Bekliyor"}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{format(new Date(a.starts_at), "d MMMM yyyy · HH:mm", { locale: tr })}</p>
                {a.shop?.address && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{a.shop.address}</p>}
              </div>
              {upcoming && (
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => cancel.mutate(a.id)}>
                  İptal Et
                </Button>
              )}
            </div>
          );
        })}
        {(data ?? []).length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Henüz randevu yok.</p>
        )}
      </div>
    </AppShell>
  );
}
