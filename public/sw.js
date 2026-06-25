// Service worker for richer notifications (system tray, sound, badge).
// True background push (when browser is fully closed) requires VAPID + push subscriptions.
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) { w.navigate ? w.navigate(url) : null; return w.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Bildirim", body: event.data?.text() ?? "" }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "Bildirim", {
      body: data.body || "",
      icon: data.icon || "/favicon.ico",
      badge: "/favicon.ico",
      image: data.image,
      data: { url: data.link || "/" },
      vibrate: [200, 100, 200],
      tag: data.tag || "barber-app",
      renotify: true,
    }),
  );
});
