// Foreground "push": uses the Web Notification API + a short audio ping when
// a realtime notification row is inserted for the current user.
import { supabase } from "@/integrations/supabase/client";

let started = false;
let audioCtx: AudioContext | null = null;

function playPing() {
  if (typeof window === "undefined") return;
  try {
    audioCtx = audioCtx ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.42);
  } catch { /* noop */ }
}

export async function startPushNotifications(userId: string) {
  if (started) return;
  started = true;
  if (typeof window === "undefined") return;
  if ("Notification" in window && Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch { /* noop */ }
  }

  const channel = supabase
    .channel("notifications:" + userId)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as { title?: string; body?: string; image_url?: string | null; link_url?: string | null };
        playPing();
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            const n = new Notification(row.title ?? "Bildirim", {
              body: row.body ?? "",
              icon: row.image_url || "/favicon.ico",
              image: row.image_url || undefined,
            } as NotificationOptions);
            if (row.link_url) {
              n.onclick = () => {
                window.focus();
                window.open(row.link_url!, "_blank", "noopener,noreferrer");
              };
            }
          } catch { /* noop */ }
        }
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
