/* ASPHALT RIDERS · Bildirim servisi · Made By : İbrahim Boz */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data.json(); } catch (_) { d = { title: "ASPHALT RIDERS", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "ASPHALT RIDERS", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: d.tag || "ar", renotify: true, data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const pencereler = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const p of pencereler) if (p.url.includes("/asphalt-riders/")) return p.focus();
    return self.clients.openWindow(e.notification.data.url);
  })());
});
