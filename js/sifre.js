/* =====================================================================
   UÇTAN UCA ŞİFRELEME (sifre.js)
   Her cihaz kendi anahtar çiftini üretir. Gizli anahtar sadece bu
   cihazda (IndexedDB) durur, sunucuya hiç gitmez. Sunucu sadece
   şifreli veriyi görür; yöneticiler dahil kimse okuyamaz.
   Mesaj: AES-GCM 256 · Anahtar paylaşımı: ECDH P-256
   ===================================================================== */
const Sifre = (() => {
  const C = crypto.subtle, enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = buf => { let s = ""; new Uint8Array(buf).forEach(b => s += String.fromCharCode(b)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  let ozel = null, acikJwk = null; const ortakOnbellek = new Map(), acikOnbellek = new Map();

  function db() {
    return new Promise((ok, no) => { const r = indexedDB.open("ar-anahtar", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("k"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  }
  async function idb(islem, anahtar, deger) {
    const d = await db();
    return new Promise((ok, no) => { const t = d.transaction("k", islem === "al" ? "readonly" : "readwrite").objectStore("k");
      const r = islem === "al" ? t.get(anahtar) : t.put(deger, anahtar); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  }
  const jwkStr = j => JSON.stringify({ x: j.x, y: j.y });

  async function acikAl(jwk) {
    const k = jwkStr(jwk); if (acikOnbellek.has(k)) return acikOnbellek.get(k);
    const key = await C.importKey("jwk", { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true }, { name: "ECDH", namedCurve: "P-256" }, false, []);
    acikOnbellek.set(k, key); return key;
  }
  async function ortak(jwk) {
    const k = jwkStr(jwk); if (ortakOnbellek.has(k)) return ortakOnbellek.get(k);
    const key = await C.deriveKey({ name: "ECDH", public: await acikAl(jwk) }, ozel, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    ortakOnbellek.set(k, key); return key;
  }

  return {
    /* Bu cihazın anahtarını yükler, yoksa üretir. Sunucuya gidecek açık anahtarı döner. */
    async hazirla(uid) {
      let kayit = await idb("al", uid);
      if (!kayit) {
        const cift = await C.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
        const jwk = await C.exportKey("jwk", cift.publicKey);
        kayit = { ozel: cift.privateKey, acik: { x: jwk.x, y: jwk.y } };
        await idb("koy", uid, kayit);
      }
      ozel = kayit.ozel; acikJwk = kayit.acik; ortakOnbellek.clear();
      return acikJwk;
    },
    benimAcik: () => acikJwk,
    ayni: (a, b) => !!a && !!b && a.x === b.x && a.y === b.y,

    /* icerik: JS nesnesi · alicilar: {uid: acikJwk} */
    async sifrele(icerik, alicilar, mesajAnahtari) {
      const anahtar = mesajAnahtari || await C.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await C.encrypt({ name: "AES-GCM", iv }, anahtar, enc.encode(JSON.stringify(icerik)));
      const ham = await C.exportKey("raw", anahtar), keys = {};
      for (const [uid, jwk] of Object.entries(alicilar)) {
        if (!jwk) continue;
        const iv2 = crypto.getRandomValues(new Uint8Array(12));
        keys[uid] = b64(iv2) + "." + b64(await C.encrypt({ name: "AES-GCM", iv: iv2 }, await ortak(jwk), ham));
      }
      return { paket: { v: 1, iv: b64(iv), ct: b64(ct), spk: acikJwk, keys }, anahtar };
    },

    /* Başarılıysa {icerik, anahtar}, okunamıyorsa null */
    async coz(paket, uid) {
      try {
        const k = paket.keys[uid]; if (!k) return null;
        const [iv2, sar] = k.split(".");
        const ham = await C.decrypt({ name: "AES-GCM", iv: unb64(iv2) }, await ortak(paket.spk), unb64(sar));
        const anahtar = await C.importKey("raw", ham, "AES-GCM", true, ["encrypt", "decrypt"]);
        const duz = await C.decrypt({ name: "AES-GCM", iv: unb64(paket.iv) }, anahtar, unb64(paket.ct));
        return { icerik: JSON.parse(dec.decode(duz)), anahtar };
      } catch (_) { return null; }
    },

    /* Fotoğraf / ses dosyaları */
    async dosyaSifrele(blob, anahtar) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await C.encrypt({ name: "AES-GCM", iv }, anahtar, await blob.arrayBuffer());
      return { blob: new Blob([ct], { type: "application/octet-stream" }), iv: b64(iv) };
    },
    async dosyaCoz(blob, anahtar, iv, tip) {
      const duz = await C.decrypt({ name: "AES-GCM", iv: unb64(iv) }, anahtar, await blob.arrayBuffer());
      return new Blob([duz], { type: tip });
    },
    async yeniAnahtar() { return C.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]); }
  };
})();
