/* ASPHALT RIDERS · Bildirim servisi · Made By : İbrahim Boz
   Mesaj bildirimleri telefona şifreli gelir, şifresi burada (cihazda) açılır. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
function anahtarAl(uid) {
  return new Promise(ok => {
    const r = indexedDB.open("ar-anahtar", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("k");
    r.onerror = () => ok(null);
    r.onsuccess = () => { try { const g = r.result.transaction("k").objectStore("k").get(uid); g.onsuccess = () => ok(g.result || null); g.onerror = () => ok(null); } catch (_) { ok(null); } };
  });
}
async function coz(p, uid) {
  try {
    const kayit = await anahtarAl(uid); if (!kayit) return null;
    const C = crypto.subtle;
    const acik = await C.importKey("jwk", { kty: "EC", crv: "P-256", x: p.spk.x, y: p.spk.y, ext: true }, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const ortak = await C.deriveKey({ name: "ECDH", public: acik }, kayit.ozel, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const [iv2, sar] = p.k.split(".");
    const ham = await C.decrypt({ name: "AES-GCM", iv: unb64(iv2) }, ortak, unb64(sar));
    const anahtar = await C.importKey("raw", ham, "AES-GCM", false, ["decrypt"]);
    return JSON.parse(new TextDecoder().decode(await C.decrypt({ name: "AES-GCM", iv: unb64(p.iv) }, anahtar, unb64(p.ct))));
  } catch (_) { return null; }
}
function ozet(m) {
  if (m.tur === "foto") return "📷 Fotoğraf";
  if (m.tur === "ses") return "🎤 Sesli mesaj";
  if (m.konum) return m.konum.dk ? "📍 Canlı konum paylaştı" : "📍 Konum paylaştı";
  return (m.hikayeYaniti ? "↩ Hikayene yanıt: " : "") + (m.text || "");
}

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data.json(); } catch (_) { d = { title: "ASPHALT RIDERS", body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    let govde = d.body || "";
    if (d.sifreli && d.uid) { const m = await coz(d.sifreli, d.uid); if (m) govde = (d.on || "") + ozet(m); }
    // Aynı sohbetten gelen önceki bildirimleri tek bildirimde birleştir (son 5 mesaj)
    const tag = d.tag || "ar";
    if (tag.startsWith("sohbet-")) {
      const once = await self.registration.getNotifications({ tag });
      const satirlar = once.length ? (once[0].data?.satirlar || []) : [];
      satirlar.push(govde); while (satirlar.length > 5) satirlar.shift();
      return self.registration.showNotification(d.title || "ASPHALT RIDERS", {
        body: satirlar.join("\n"), icon: "icon-192.png", badge: "icon-192.png", tag, renotify: !d.sessiz, silent: !!d.sessiz,
        data: { url: d.url || "./", satirlar }
      });
    }
    return self.registration.showNotification(d.title || "ASPHALT RIDERS", {
      body: govde, icon: "icon-192.png", badge: "icon-192.png", tag, renotify: !d.sessiz, silent: !!d.sessiz, data: { url: d.url || "./" }
    });
  })());
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const pencereler = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const p of pencereler) if (p.url.includes("/asphalt-riders/")) return p.focus();
    return self.clients.openWindow(e.notification.data.url);
  })());
});
