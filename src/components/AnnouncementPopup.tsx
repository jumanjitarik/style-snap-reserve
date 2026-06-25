import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";

export function AnnouncementPopup() {
  const [open, setOpen] = useState(false);
  const [shownId, setShownId] = useState<string | null>(null);

  const { data: ann } = useQuery({
    queryKey: ["latest-announcement"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!ann) return;
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem("ann-seen");
    if (seen === ann.id) return;
    setShownId(ann.id);
    setOpen(true);
  }, [ann]);

  function dismiss() {
    if (shownId) localStorage.setItem("ann-seen", shownId);
    setOpen(false);
  }

  if (!ann) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Megaphone className="h-5 w-5" />
            <DialogTitle className="font-display text-xl">{ann.title}</DialogTitle>
          </div>
          <DialogDescription className="whitespace-pre-wrap text-foreground/90 pt-2">
            {ann.body}
          </DialogDescription>
        </DialogHeader>
        <Button onClick={dismiss} className="w-full">Tamam</Button>
      </DialogContent>
    </Dialog>
  );
}
