/* =====================================================================
   ALTYAPI KATMANI (api.js)
   Uygulamanın sunucuyla konuştuğu TEK yer burası.
   Supabase yerine başka bir servise geçmek için sadece bu dosyayı
   aynı fonksiyon adlarıyla yeniden yazmak yeterli.
   Made By : İbrahim Boz
   ===================================================================== */
const AYAR = {
  url: "https://tqzbdxhrocflizwzpmeg.supabase.co",
  key: "sb_publishable_oubmFqITUbOceb3WRfdggQ_fueFCoC1",
  epostaUzanti: "@asphalt-riders.app",
  genelSohbet: "00000000-0000-0000-0000-000000000001",
  fonksiyon: "https://tqzbdxhrocflizwzpmeg.supabase.co/functions/v1/asphalt"
};

/* Kullanıcı adını standartlaştır: Türkçe klavye (İ/ı/ş...), büyük harf, boşluk, baştaki @ */
const kadiDuzelt = s => String(s || "").trim().replace(/^@/, "").replace(/[İIı]/g, "i").toLowerCase()
  .replace(/ç/g, "c").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ö/g, "o").replace(/ü/g, "u")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");

const API = (() => {
  const sb = supabase.createClient(AYAR.url, AYAR.key, { auth: { persistSession: true, autoRefreshToken: true } });
  const ok = ({ data, error }) => { if (error) throw new Error(hataCevir(error.message)); return data; };
  function hataCevir(m) {
    if (/Invalid login/i.test(m)) return "Kullanıcı adı veya şifre hatalı.";
    if (/already registered|already exists|duplicate key.*username/i.test(m)) return "Bu kullanıcı adı alınmış.";
    if (/Password should be/i.test(m)) return "Şifre en az 6 karakter olmalı.";
    if (/rate limit/i.test(m)) return "Çok fazla deneme yapıldı, biraz bekle.";
    if (/iletisim_eposta_check|violates check/i.test(m)) return "Geçerli bir e-posta adresi yaz.";
    if (/row-level security|Yetki yok/i.test(m)) return "Bu işlem için yetkin yok.";
    return m;
  }
  const eposta = u => kadiDuzelt(u) + AYAR.epostaUzanti;
  let benId = null, kurtarma = false, kurtarmaCb = null;
  sb.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") { kurtarma = true; kurtarmaCb && kurtarmaCb(); } });
  async function fonksiyon(islem, veri = {}, yetkili = false) {
    const h = { "Content-Type": "application/json" };
    if (yetkili) { const { data } = await sb.auth.getSession(); h.Authorization = "Bearer " + data.session?.access_token; }
    const r = await fetch(AYAR.fonksiyon, { method: "POST", headers: h, body: JSON.stringify({ islem, ...veri }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.hata || "Sunucu hatası"); return j;
  }

  return {
    /* ---- Oturum ---- */
    async oturum() { const { data } = await sb.auth.getSession(); benId = data.session?.user.id || null; return benId; },
    async giris(kimlik, sifre) {
      let kadi = kimlik.trim();
      if (kadi.includes("@") && !kadi.startsWith("@")) {   // e-posta ile giriş
        const { data } = await sb.rpc("giris_kullanici", { kimlik: kadi.toLowerCase() });
        if (!data) throw new Error("Bu e-postayla kayıtlı üye bulunamadı. Kullanıcı adınla dene.");
        kadi = data;
      }
      const d = ok(await sb.auth.signInWithPassword({ email: eposta(kadi), password: sifre })); benId = d.user.id; return benId;
    },
    async kayit(f) {
      const d = ok(await sb.auth.signUp({ email: eposta(f.username), password: f.sifre,
        options: { data: { username: kadiDuzelt(f.username), ad: f.ad, motor: f.motor, plaka: f.plaka, tel: f.tel, eposta: f.eposta } } }));
      if (d.user && d.user.identities && d.user.identities.length === 0) throw new Error("Bu kullanıcı adı alınmış.");
      benId = d.user?.id || null; return benId;
    },
    async cikis() { await sb.auth.signOut(); benId = null; },
    async sifreDegistir(yeni) { ok(await sb.auth.updateUser({ password: yeni })); kurtarma = false; },
    async sifreSifirla(kimlik) { return fonksiyon("sifre", { kimlik }); },
    kurtarmaModu: () => kurtarma || /type=recovery/.test(location.hash),
    kurtarmaDinle(cb) { kurtarmaCb = cb; },
    async topluEposta(konu, metin) { return fonksiyon("toplu", { konu, metin }, true); },
    async sunucuDurum() { return fonksiyon("durum"); },

    /* ---- Üyeler ---- */
    async profiller() { return ok(await sb.from("profiles").select("*").order("created_at")); },
    async profilim() { return ok(await sb.from("profiles").select("*").eq("id", benId).single()); },
    async profilGuncelle(p) { ok(await sb.from("profiles").update(p).eq("id", benId)); },
    async uyeOnayla(id) { ok(await sb.rpc("uye_onayla", { uid: id })); },
    async uyeReddet(id) { ok(await sb.rpc("uye_reddet", { uid: id })); },
    async rolDegistir(id, rol) { ok(await sb.rpc("rol_degistir", { uid: id, yeni: rol })); },
    async yetkiAyarla(id, y) { ok(await sb.rpc("yetki_ayarla", { uid: id, y })); },
    async sustur(id, durum) { ok(await sb.rpc("uye_sustur", { uid: id, durum })); },
    async grupAyarla(aciklama, kapali) { ok(await sb.rpc("grup_ayarla", { yeni_aciklama: aciklama, yeni_kapali: kapali })); },
    async epostam() { const d = ok(await sb.from("iletisim").select("eposta").eq("uid", benId).maybeSingle()); return d?.eposta || ""; },
    async tumEpostalar() { return ok(await sb.from("iletisim").select("uid, eposta")); },
    async epostaKaydet(e) { ok(await sb.from("iletisim").upsert({ uid: benId, eposta: e.trim().toLowerCase() })); },
    async fotoYukle(blob, eski) {
      const yol = benId + "/foto-" + Date.now() + ".jpg";
      ok(await sb.storage.from("avatar").upload(yol, blob, { contentType: "image/jpeg" }));
      ok(await sb.from("profiles").update({ foto: yol }).eq("id", benId));
      if (eski) await sb.storage.from("avatar").remove([eski]);
    },
    async fotoSil(eski) { ok(await sb.from("profiles").update({ foto: null }).eq("id", benId)); if (eski) await sb.storage.from("avatar").remove([eski]); },
    async fotoUrller(yollar) {
      if (!yollar.length) return {};
      const d = ok(await sb.storage.from("avatar").createSignedUrls(yollar, 604800));
      return Object.fromEntries(d.filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]));
    },
    async pushKaydet(endpoint, p256dh, auth) { ok(await sb.from("push_abonelik").upsert({ endpoint, uid: benId, p256dh, auth })); },
    async pushSil(endpoint) { await sb.from("push_abonelik").delete().eq("endpoint", endpoint); },

    /* ---- Duyurular ---- */
    async duyurular() { return ok(await sb.from("duyurular").select("*").order("created_at", { ascending: false }).limit(100)); },
    async duyuruEkle(d) { ok(await sb.from("duyurular").insert(d)); },
    async duyuruSil(id) { ok(await sb.from("duyurular").delete().eq("id", id)); },

    /* ---- Etkinlikler ---- */
    async etkinlikler() { return ok(await sb.from("etkinlikler").select("*, katilim(uid,durum)").gte("tarih", new Date(Date.now() - 864e5 * 2).toISOString().slice(0, 10)).order("tarih")); },
    async etkinlikEkle(e) { ok(await sb.from("etkinlikler").insert(e)); },
    async etkinlikSil(id) { ok(await sb.from("etkinlikler").delete().eq("id", id)); },
    async katil(id, durum) {
      if (!durum) return ok(await sb.from("katilim").delete().eq("etkinlik_id", id).eq("uid", benId));
      ok(await sb.from("katilim").upsert({ etkinlik_id: id, uid: benId, durum }));
    },

    /* ---- Anketler ---- */
    async anketler() { return ok(await sb.from("anketler").select("*, oylar(uid,secenek)").order("created_at", { ascending: false }).limit(30)); },
    async anketEkle(a) { ok(await sb.from("anketler").insert(a)); },
    async anketSil(id) { ok(await sb.from("anketler").delete().eq("id", id)); },
    async oyVer(id, secenek, coklu, vardi) {
      if (!coklu) ok(await sb.from("oylar").delete().eq("anket_id", id).eq("uid", benId));
      else if (vardi) return ok(await sb.from("oylar").delete().eq("anket_id", id).eq("uid", benId).eq("secenek", secenek));
      if (!vardi) ok(await sb.from("oylar").insert({ anket_id: id, uid: benId, secenek }));
    },

    /* ---- Aidat ---- */
    async aidat() {
      const ayar = ok(await sb.from("aidat_ayar").select("*").single());
      const od = ok(await sb.from("aidat_odeme").select("*"));
      return { aktif: ayar.aktif, tutar: +ayar.tutar, odemeler: Object.fromEntries(od.map(o => [o.uid + "|" + o.ay, true])) };
    },
    async aidatAyar(aktif, tutar) { ok(await sb.from("aidat_ayar").update({ aktif, tutar }).eq("id", 1)); },
    async odemeDegistir(uid, ay, odendi) {
      if (odendi) ok(await sb.from("aidat_odeme").insert({ uid, ay }));
      else ok(await sb.from("aidat_odeme").delete().eq("uid", uid).eq("ay", ay));
    },

    /* ---- Sohbet ---- */
    async sohbetler() { return ok(await sb.from("chats").select("*, chat_uyeler(uid,son_okuma)")); },
    async sonMesajlar() { return ok(await sb.from("mesajlar").select("*").order("id", { ascending: false }).limit(400)); },
    async mesajlar(chatId, oncekiId) {
      let q = sb.from("mesajlar").select("*").eq("chat_id", chatId).order("id", { ascending: false }).limit(80);
      if (oncekiId) q = q.lt("id", oncekiId);
      return ok(await q).reverse();
    },
    async mesaj(id) { return ok(await sb.from("mesajlar").select("*").eq("id", id).maybeSingle()); },
    async mesajGonder(chatId, sifreli, yanit, bahsedilen, silinme) { return ok(await sb.from("mesajlar").insert({ chat_id: chatId, sifreli, yanit: yanit || null, bahsedilen: bahsedilen || [], silinme: silinme || null }).select().single()); },
    async mesajDuzenle(id, sifreli) { ok(await sb.from("mesajlar").update({ sifreli, duzenlendi: true, updated_at: new Date().toISOString() }).eq("id", id)); },
    async herkestenSil(id) { ok(await sb.rpc("mesaj_herkesten_sil", { mid: id })); },
    async bendenSil(id) { ok(await sb.from("gizlenen").upsert({ uid: benId, mesaj_id: id })); },
    async sessizler() { return ok(await sb.from("sessiz").select("chat_id, bitis")); },
    async sessizAyarla(chatId, bitis) {
      if (bitis === false) return ok(await sb.from("sessiz").delete().eq("chat_id", chatId).eq("uid", benId));
      ok(await sb.from("sessiz").upsert({ uid: benId, chat_id: chatId, bitis }));
    },
    async gizlenenler() { return ok(await sb.from("gizlenen").select("mesaj_id")).map(x => x.mesaj_id); },
    async mesajGuncelle(id, sifreli) { ok(await sb.from("mesajlar").update({ sifreli, updated_at: new Date().toISOString() }).eq("id", id)); },
    async okundu(chatId) { ok(await sb.from("chat_uyeler").update({ son_okuma: new Date().toISOString() }).eq("chat_id", chatId).eq("uid", benId)); },
    async dmAc(uid) { return ok(await sb.rpc("dm_ac", { diger: uid })); },
    async tepkiler() { return ok(await sb.from("tepkiler").select("*").limit(2000)); },
    async tepki(mesajId, chatId, emoji) {
      if (!emoji) return ok(await sb.from("tepkiler").delete().eq("mesaj_id", mesajId).eq("uid", benId));
      ok(await sb.from("tepkiler").upsert({ mesaj_id: mesajId, chat_id: chatId, uid: benId, emoji }));
    },

    /* ---- Dosyalar ---- */
    async yukle(kova, ad, blob) { const yol = benId + "/" + ad; ok(await sb.storage.from(kova).upload(yol, blob, { contentType: blob.type || "application/octet-stream" })); return yol; },
    async indir(kova, yol) { return ok(await sb.storage.from(kova).download(yol)); },
    async dosyaSil(kova, yollar) { if (yollar.length) await sb.storage.from(kova).remove(yollar); },

    /* ---- Hikayeler ---- */
    async hikayeler() { return ok(await sb.from("hikayeler").select("*, hikaye_goren(uid)").order("created_at")); },
    async hikayeEkle(yol) { ok(await sb.from("hikayeler").insert({ yol })); },
    async hikayeSil(id, yol) { ok(await sb.from("hikayeler").delete().eq("id", id)); await sb.storage.from("hikaye").remove([yol]); },
    async hikayeGordum(id) { await sb.from("hikaye_goren").upsert({ hikaye_id: id, uid: benId }, { ignoreDuplicates: true }); },
    async eskiHikayelerimiTemizle() {
      const { data } = await sb.storage.from("hikaye").list(benId, { limit: 100 });
      const eski = (data || []).filter(f => Date.now() - new Date(f.created_at).getTime() > 864e5).map(f => benId + "/" + f.name);
      await this.dosyaSil("hikaye", eski);
    },

    /* ---- Canlı güncellemeler ---- */
    canli(degisti, yaziyorGeldi, onlineGeldi) {
      const ch = sb.channel("db");
      ["mesajlar", "tepkiler", "chat_uyeler", "duyurular", "etkinlikler", "katilim", "anketler", "oylar", "hikayeler", "profiles", "chats"]
        .forEach(t => ch.on("postgres_changes", { event: "*", schema: "public", table: t }, p => degisti(t, p)));
      ch.subscribe();
      const y = sb.channel("yaziyor").on("broadcast", { event: "y" }, p => yaziyorGeldi(p.payload)).subscribe();
      const on = sb.channel("online", { config: { presence: { key: benId } } });
      on.on("presence", { event: "sync" }, () => onlineGeldi(Object.keys(on.presenceState())))
        .subscribe(st => { if (st === "SUBSCRIBED") on.track({ t: Date.now() }); });
      return { yaziyor: (chatId) => y.send({ type: "broadcast", event: "y", payload: { chat: chatId, uid: benId } }) };
    },
    tazele() { sb.realtime.connect(); }
  };
})();
