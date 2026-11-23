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
  genelSohbet: "00000000-0000-0000-0000-000000000001"
};

const API = (() => {
  const sb = supabase.createClient(AYAR.url, AYAR.key, { auth: { persistSession: true, autoRefreshToken: true } });
  const ok = ({ data, error }) => { if (error) throw new Error(hataCevir(error.message)); return data; };
  function hataCevir(m) {
    if (/Invalid login/i.test(m)) return "Kullanıcı adı veya şifre hatalı.";
    if (/already registered|already exists|duplicate key.*username/i.test(m)) return "Bu kullanıcı adı alınmış.";
    if (/Password should be/i.test(m)) return "Şifre en az 6 karakter olmalı.";
    if (/rate limit/i.test(m)) return "Çok fazla deneme yapıldı, biraz bekle.";
    return m;
  }
  const eposta = u => u.trim().toLowerCase() + AYAR.epostaUzanti;
  let benId = null;

  return {
    /* ---- Oturum ---- */
    async oturum() { const { data } = await sb.auth.getSession(); benId = data.session?.user.id || null; return benId; },
    async giris(username, sifre) { const d = ok(await sb.auth.signInWithPassword({ email: eposta(username), password: sifre })); benId = d.user.id; return benId; },
    async kayit(f) {
      const d = ok(await sb.auth.signUp({ email: eposta(f.username), password: f.sifre,
        options: { data: { username: f.username.toLowerCase(), ad: f.ad, motor: f.motor, plaka: f.plaka, tel: f.tel } } }));
      if (d.user && d.user.identities && d.user.identities.length === 0) throw new Error("Bu kullanıcı adı alınmış.");
      benId = d.user?.id || null; return benId;
    },
    async cikis() { await sb.auth.signOut(); benId = null; },
    async sifreDegistir(yeni) { ok(await sb.auth.updateUser({ password: yeni })); },

    /* ---- Üyeler ---- */
    async profiller() { return ok(await sb.from("profiles").select("*").order("created_at")); },
    async profilim() { return ok(await sb.from("profiles").select("*").eq("id", benId).single()); },
    async profilGuncelle(p) { ok(await sb.from("profiles").update(p).eq("id", benId)); },
    async uyeOnayla(id) { ok(await sb.rpc("uye_onayla", { uid: id })); },
    async uyeReddet(id) { ok(await sb.rpc("uye_reddet", { uid: id })); },
    async rolDegistir(id, rol) { ok(await sb.rpc("rol_degistir", { uid: id, yeni: rol })); },

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
    async mesajGonder(chatId, sifreli, yanit) { return ok(await sb.from("mesajlar").insert({ chat_id: chatId, sifreli, yanit: yanit || null }).select().single()); },
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
    canli(degisti, yaziyorGeldi) {
      const ch = sb.channel("db");
      ["mesajlar", "tepkiler", "chat_uyeler", "duyurular", "etkinlikler", "katilim", "anketler", "oylar", "hikayeler", "profiles"]
        .forEach(t => ch.on("postgres_changes", { event: "*", schema: "public", table: t }, p => degisti(t, p)));
      ch.subscribe();
      const y = sb.channel("yaziyor").on("broadcast", { event: "y" }, p => yaziyorGeldi(p.payload)).subscribe();
      return { yaziyor: (chatId) => y.send({ type: "broadcast", event: "y", payload: { chat: chatId, uid: benId } }) };
    },
    tazele() { sb.realtime.connect(); }
  };
})();
