// Lightweight foreground "push": uses the Notification API to display
// system-level notifications when the app receives realtime notifications.
import { supabase } from "@/integrations/supabase/client";

let started = false;
export async function startPushNotifications(userId: string) {
  if (started) return;
  started = true;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch { /* noop */ }
  }
  if (Notification.permission !== "granted") return;

  const channel = supabase
    .channel("notifications:" + userId)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as { title?: string; body?: string };
        try {
          new Notification(row.title ?? "Bildirim", { body: row.body ?? "", icon: "/favicon.ico" });
        } catch { /* noop */ }
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
