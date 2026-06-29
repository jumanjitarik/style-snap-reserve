// Foreground "push": Notification API + audio ping + service worker showNotification
// so notifications also appear in the OS notification tray when tab is backgrounded.
import { supabase } from "@/integrations/supabase/client";

let started = false;
let audioCtx: AudioContext | null = null;
let swReg: ServiceWorkerRegistration | null = null;

function playPing() {
  if (typeof window === "undefined") return;
  try {
    audioCtx = audioCtx ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
    osc.start(); osc.stop(audioCtx.currentTime + 0.42);
  } catch { /* noop */ }
}

async function ensureSW() {
  if (swReg || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return swReg;
  try {
    swReg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  } catch { /* noop */ }
  return swReg;
}

function safeLink(link?: string | null): string | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed) return null;
  // Allow only same-origin relative paths or explicit http(s) URLs
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch { /* noop */ }
  return null;
}

function safeImage(image?: string | null): string | null {
  if (!image) return null;
  const trimmed = image.trim();
  try {
    const u = new URL(trimmed, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch { /* noop */ }
  return null;
}

async function showNotif(title: string, body: string, image?: string | null, link?: string | null) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const safeImg = safeImage(image);
  const safeUrl = safeLink(link) ?? "/";
  const opts: NotificationOptions = {
    body,
    icon: safeImg || "/favicon.ico",
    badge: "/favicon.ico",
    tag: "barber-app",
    data: { url: safeUrl },
  };
  // @ts-expect-error mobile-only fields
  opts.vibrate = [200, 100, 200];
  // @ts-expect-error mobile-only fields
  if (safeImg) opts.image = safeImg;
  try {
    const reg = await ensureSW();
    if (reg) {
      await reg.showNotification(title, opts);
    } else {
      const n = new Notification(title, opts);
      n.onclick = () => { window.focus(); window.open(safeUrl, "_self"); };
    }
  } catch { /* noop */ }
}

export async function startPushNotifications(userId: string) {
  if (started) return;
  started = true;
  if (typeof window === "undefined") return;
  await ensureSW();
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
        showNotif(row.title ?? "Bildirim", row.body ?? "", row.image_url, row.link_url);
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
