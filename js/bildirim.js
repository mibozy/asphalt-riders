/* =====================================================================
   BİLDİRİMLER (bildirim.js) · Standart Web Push (ek servis yok, ücretsiz)
   Gönderimi sunucu yapar (Supabase fonksiyonu "asphalt"). Bu dosya cihazı
   bildirime kaydeder. Mesaj içerikleri bildirimde görünmez (şifreli).
   ===================================================================== */
const VAPID_PUBLIC = "BGQFN5x_bm-1PK9Ib9oXbG7aNOViXQ6sM9RwjAfX-XFU8oTqvfIUg4zvHf-WeKuNetqy-5dQH__C4GTV04ssolE";
const Bildirim = (() => {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const ekranda = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const destek = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const u8 = s => { const p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); };
  let kayit = null;
  async function sw() { if (!kayit) kayit = await navigator.serviceWorker.register("sw.js"); return navigator.serviceWorker.ready; }
  async function abone() {
    const reg = await sw();
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(VAPID_PUBLIC) }));
    const j = sub.toJSON(); await API.pushKaydet(j.endpoint, j.keys.p256dh, j.keys.auth);
  }
  return {
    acik: () => destek() && Notification.permission === "granted",
    sorulmadi: () => destek() && Notification.permission === "default",
    iosEkleGerek: () => ios && !ekranda(),
    async baslat() {
      if (!("serviceWorker" in navigator) || location.protocol !== "https:") return;
      (await navigator.serviceWorker.getRegistrations()).forEach(r => { if ((r.active?.scriptURL || "").includes("OneSignal")) r.unregister(); });
      await sw().catch(() => {});
    },
    async giris() { if (this.acik()) abone().catch(e => console.warn("push", e)); },
    async ac() {
      if (ios && !ekranda()) return toast("iPhone'da önce Safari → Paylaş → Ana Ekrana Ekle, sonra uygulamayı ana ekrandan aç.");
      if (!destek()) return toast("Bu tarayıcı bildirimi desteklemiyor. Chrome veya Safari kullan.");
      const izin = await Notification.requestPermission();
      if (izin !== "granted") { render(); return toast("Bildirim izni verilmedi."); }
      try { await abone(); toast("🔔 Bildirimler açıldı"); } catch (e) { toast("⚠️ Bildirim açılamadı: " + e.message); }
      render();
    },
    async cikis() {
      try { const reg = await navigator.serviceWorker.getRegistration("sw.js"); const sub = await reg?.pushManager.getSubscription();
        if (sub) { await API.pushSil(sub.endpoint); await sub.unsubscribe(); } } catch (_) {}
    },
    durumYazi() {
      if (ios && !ekranda()) return "iPhone'da bildirim için: Safari → Paylaş → Ana Ekrana Ekle, sonra uygulamayı ana ekrandaki ikondan aç.";
      if (!destek()) return "Bu tarayıcı bildirimi desteklemiyor.";
      return Notification.permission === "granted" ? "✅ Bildirimler bu cihazda açık" : Notification.permission === "denied" ? "❌ Bildirimler engelli. Telefon ayarlarından bu siteye bildirim izni ver." : "Duyuru, etkinlik, anket, bahsedilme ve mesaj bildirimleri için aç.";
    }
  };
})();
