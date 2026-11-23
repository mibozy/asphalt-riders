/* =====================================================================
   BİLDİRİMLER (bildirim.js) · OneSignal web push
   Gönderimi sunucu yapar (veritabanı tetikleyicileri). Bu dosya sadece
   cihazı bildirime kaydeder. Mesaj içeriği bildirimde görünmez.
   ===================================================================== */
const ONESIGNAL_APP_ID = "";
const Bildirim = (() => {
  let hazir = false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent), standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  function yukle() {
    if (!ONESIGNAL_APP_ID || hazir) return; hazir = true;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    const s = document.createElement("script"); s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"; s.defer = true; document.head.appendChild(s);
    OneSignalDeferred.push(async OS => { await OS.init({ appId: ONESIGNAL_APP_ID, serviceWorkerPath: "OneSignalSDKWorker.js", notifyButton: { enable: false } }); });
  }
  return {
    giris(uid) { yukle(); if (ONESIGNAL_APP_ID) OneSignalDeferred.push(async OS => { await OS.login(uid); }); },
    ac() {
      if (!ONESIGNAL_APP_ID) return toast("Bildirim altyapısı yakında açılacak.");
      if (ios && !standalone) return toast("iPhone'da önce Safari → Paylaş → Ana Ekrana Ekle, sonra uygulamadan aç.");
      OneSignalDeferred.push(async OS => { await OS.Notifications.requestPermission(); const el = document.getElementById("bildirimDurum"); if (el) el.textContent = Bildirim.durumYazi(); });
    },
    durumYazi() {
      if (!("Notification" in window)) return ios ? "iPhone'da bildirim için uygulamayı Ana Ekrana ekleyip oradan aç." : "Bu tarayıcı bildirimi desteklemiyor.";
      return Notification.permission === "granted" ? "✅ Bildirimler açık" : Notification.permission === "denied" ? "❌ Bildirimler engelli. Telefon ayarlarından bu siteye izin ver." : "Duyuru, etkinlik, anket ve mesaj bildirimleri için aç.";
    },
    herkese() {}, mesaj() {}
  };
})();
