/* =====================================================================
   ASPHALT RIDERS · Arayüz (app.js)
   Made By : İbrahim Boz
   ===================================================================== */
const AYLAR = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
const RENK = ["#ff7b80","#7fc8ff","#9ff0bd","#f2c46e","#d7a6ff","#ffb38a"];
const YETKI_ADLARI = { duyuru: "Duyuru, etkinlik ve anket", uye: "Üye başvurularını onaylama", sohbet: "Grubu açma/kapatma, susturma", aidat: "Aidat ödemesi işaretleme" };
const S = { user:null, durum:"yukleniyor", tab:"sohbet", loginMode:"giris", err:"", bilgi:"", members:[], duyurular:[], etkinlikler:[], anketler:[],
  aidat:{aktif:false,tutar:0,odemeler:{}}, chats:[], hikayeler:[], tepki:{}, chatOpen:null, draft:{}, secili:null, yanit:null,
  ekMenu:false, kayit:null, yeniSohbet:false, hv:null, yaziyor:{}, canliKonum:{}, mesgul:false, online:[], fotoUrl:{}, epostam:"",
  grupBilgi:false, hikayeMenu:false, fotoMenu:false, bahsHedef:null, oneri:[] };

const $ = s => document.querySelector(s);
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ini = ad => String(ad||"?").split(" ").filter(Boolean).map(x => x[0]).slice(0,2).join("").toLocaleUpperCase("tr");
const trTarih = d => new Date(d + "T00:00").toLocaleDateString("tr-TR", { day:"numeric", month:"long", weekday:"long" });
const yonetici = () => S.user && (S.user.rol === "kurucu" || S.user.rol === "yardimci");
const yetki = y => S.user && (S.user.rol === "kurucu" || (S.user.rol === "yardimci" && !!(S.user.yetkiler || {})[y]));
const rolAd = { kurucu:"Kurucu", yardimci:"Yönetici", uye:"Üye" };
const now = () => Date.now();
const ms = t => new Date(t).getTime();
const saat = t => new Date(t).toLocaleTimeString("tr-TR", { hour:"2-digit", minute:"2-digit" });
const sure = s => Math.floor(s/60) + ":" + String(Math.floor(s%60)).padStart(2,"0");
const once = t => { const d = Math.floor((now()-ms(t))/6e4); return d<1 ? "şimdi" : d<60 ? d+" dk önce" : Math.floor(d/60)+" sa önce"; };
const uye = id => S.members.find(m => m.id === id) || { ad:"Eski üye", id, username:"" };
const ayKey = (y, m) => y + "-" + String(m+1).padStart(2,"0");
const GRUP = AYAR.genelSohbet;

function toast(m) { const b = $("#toastBox"); b.innerHTML = `<div class="toast" role="status">${esc(m)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => b.innerHTML = "", 2800); }
async function dene(f, basari) { try { await f(); if (basari) toast(basari); } catch (e) { toast("⚠️ " + (e.message || "Bir hata oldu")); console.error(e); } }

/* Profil fotoğrafı ya da baş harfler. online: yetkililere yeşil nokta */
function av(uid, sinif = "") {
  const m = uye(uid), url = m.foto && S.fotoUrl[m.foto], nokta = yonetici() && S.online.includes(uid) ? `<i class="cevrim" aria-label="Çevrimiçi"></i>` : "";
  return `<span class="av ${sinif}">${url ? `<img src="${url}" alt="">` : ini(m.ad)}${nokta}</span>`;
}
const siraRol = { kurucu: 0, yardimci: 1, uye: 2 };
const uyeSirala = l => [...l].sort((a, b) => (siraRol[a.rol] - siraRol[b.rol]) || a.ad.localeCompare(b.ad, "tr"));

const IC = {
 sohbet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19l1.5-4A8 8 0 1 1 9 18.5z"/></svg>',
 duyuru:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></svg>',
 etkinlik:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
 uyeler:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5.5 5"/></svg>',
 aidat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="6" width="19" height="13" rx="2"/><path d="M2.5 10h19M6 15h4"/></svg>',
 profil:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
};

/* ======================= VERİ YÜKLEME ======================= */
async function yukleUyeler() {
  S.members = await API.profiller(); const ben = S.members.find(m => m.id === S.user.id); if (ben) S.user = ben;
  const eksik = S.members.map(m => m.foto).filter(f => f && !S.fotoUrl[f]);
  if (eksik.length) try { Object.assign(S.fotoUrl, await API.fotoUrller(eksik)); } catch (_) {}
}
async function yukleDuyurular() { S.duyurular = await API.duyurular(); }
async function yukleEtkinlikler() { S.etkinlikler = (await API.etkinlikler()).map(e => ({ ...e, katilim: Object.fromEntries(e.katilim.map(k => [k.uid, k.durum])) })); }
async function yukleAnketler() { S.anketler = (await API.anketler()).map(a => ({ ...a, sec: a.secenekler.map((t, i) => ({ t, oy: a.oylar.filter(o => o.secenek === i).map(o => o.uid) })) })); }
async function yukleAidat() { S.aidat = await API.aidat(); }
async function yukleHikayeler() {
  const eski = Object.fromEntries(S.hikayeler.map(h => [h.id, h.url]));
  S.hikayeler = (await API.hikayeler()).map(h => ({ id:h.id, uid:h.uid, yol:h.yol, ts:h.created_at, goren:h.hikaye_goren.map(g => g.uid), url: eski[h.id] }));
}
async function yukleTepkiler() { S.tepki = {}; (await API.tepkiler()).forEach(t => (S.tepki[t.mesaj_id] ||= {})[t.uid] = t.emoji); }
async function yukleSohbetler() {
  const eski = Object.fromEntries(S.chats.map(c => [c.id, c]));
  S.chats = (await API.sohbetler()).map(c => ({ id:c.id, tip:c.tip, ad:c.ad, aciklama:c.aciklama || "", kapali:!!c.kapali, uyeler:c.chat_uyeler.map(u => u.uid),
    okuma: Object.fromEntries(c.chat_uyeler.map(u => [u.uid, ms(u.son_okuma)])), mesajlar: eski[c.id]?.mesajlar || [], tam: eski[c.id]?.tam || false, yuklendi: eski[c.id]?.yuklendi || false }));
}
async function yukleSonMesajlar() {
  const ham = await API.sonMesajlar();
  for (const r of ham.reverse()) { const c = chatBul(r.chat_id); if (c && !c.mesajlar.some(m => m.id === r.id)) c.mesajlar.push(await mesajCoz(r)); }
  S.chats.forEach(c => c.mesajlar.sort((a, b) => a.id - b.id));
}
async function hepsiniYukle() {
  await yukleUyeler();
  await Promise.all([yukleDuyurular(), yukleEtkinlikler(), yukleAnketler(), yukleAidat(), yukleHikayeler(), yukleTepkiler(), yukleSohbetler(), API.epostam().then(e => S.epostam = e)]);
  await yukleSonMesajlar();
}

/* ======================= MESAJ ŞİFRELEME ======================= */
async function mesajCoz(r) {
  const c = await Sifre.coz(r.sifreli, S.user.id);
  const m = { id:r.id, chat:r.chat_id, from:r.gonderen, ts:ms(r.created_at), reply:r.yanit, guncel:r.updated_at, bahs:r.bahsedilen || [] };
  if (!c) return { ...m, okunamaz:true };
  Object.assign(m, c.icerik); m._anahtar = c.anahtar;
  if (m.medya) medyaHazirla(m);
  return m;
}
const medyaCache = new Map();
async function medyaHazirla(m) {
  if (medyaCache.has(m.medya.yol)) { m.url = medyaCache.get(m.medya.yol); return; }
  try {
    const blob = await API.indir("medya", m.medya.yol);
    m.url = URL.createObjectURL(await Sifre.dosyaCoz(blob, m._anahtar, m.medya.iv, m.medya.tip));
    medyaCache.set(m.medya.yol, m.url); render();
  } catch (_) { m.medyaHata = true; render(); }
}
function alicilar(c) { return Object.fromEntries(c.uyeler.map(u => [u, uye(u).pubkey]).filter(([, k]) => k)); }

/* ======================= GÖRÜNÜM ======================= */
const odakGeri = id => { if (!id) return; const el = document.getElementById(id); if (!el || el.type === "file") return; el.focus({ preventScroll:true }); try { const n = el.value.length; el.setSelectionRange(n, n); } catch (_) {} };
function render() {
  const a = $("#app"), act = document.activeElement && document.activeElement.id;
  if (S.durum === "yukleniyor") { a.innerHTML = `<div class="login wrap"><img class="logo" src="${LOGO}" alt="Asphalt Riders logosu"><div class="demo">Yükleniyor...</div></div>`; return; }
  if (S.durum === "giris") { a.innerHTML = loginView(); odakGeri(act); return; }
  if (S.durum === "yenisifre") { a.innerHTML = yeniSifreView(); odakGeri(act); return; }
  if (S.durum === "bekliyor") { a.innerHTML = bekleView(); return; }
  if (S.chatOpen && S.grupBilgi) { a.innerHTML = grupBilgiView(); odakGeri(act); return; }
  if (S.chatOpen) { a.innerHTML = chatView(); odakGeri(act); if (S.scrollBottom) { S.scrollBottom = false; requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight)); } return; }
  const okToplam = benimChatler().reduce((n, c) => n + okunmamis(c), 0), bekleyen = S.members.filter(m => !m.onay).length;
  a.innerHTML = `
  <header class="top wrap"><img src="${LOGO}" alt="Asphalt Riders logosu"><div class="brand">ASPHALT<br><span>RIDERS</span></div>
   <div class="who"><b>${esc(S.user.ad)}</b>${rolAd[S.user.rol]} · <span class="onl">🟢 ${S.online.length} çevrimiçi</span></div></header>
  <main class="wrap">${({ sohbet:sohbetView, duyuru:duyuruView, etkinlik:etkinlikView, uyeler:uyelerView, aidat:aidatView, profil:profilView })[S.tab]()}
   <div class="sign">Made By : İbrahim Boz</div></main>
  <nav class="tabs" aria-label="Bölümler"><div class="in">
   ${[["sohbet","Sohbet"],["duyuru","Duyuru"],["etkinlik","Etkinlik"],["uyeler","Üyeler"],["aidat","Aidat"],["profil","Profil"]].map(([k, l]) =>
     `<button class="tab ${S.tab===k?"on":""}" data-tab="${k}">${IC[k]}${l}${k==="uyeler"&&yetki("uye")&&bekleyen?`<span class="badge">${bekleyen}</span>`:""}${k==="sohbet"&&okToplam?`<span class="badge">${okToplam}</span>`:""}</button>`).join("")}
  </div></nav>`;
  odakGeri(act);
}

function loginView() {
  const m = S.loginMode, hata = S.err ? `<div class="err">${esc(S.err)}</div>` : "", bilgi = S.bilgi ? `<div class="note">${esc(S.bilgi)}</div>` : "";
  let govde;
  if (m === "giris") govde = `<form class="form" id="fGiris">
     <label>Kullanıcı adı<input id="lu" autocomplete="username" autocapitalize="none" required></label>
     <label>Şifre<input id="lp" type="password" autocomplete="current-password" required></label>
     ${hata}${bilgi}<button class="btn pri" ${S.mesgul?"disabled":""}>${S.mesgul?"Giriş yapılıyor...":"Giriş yap"}</button></form>
     <button class="linkbtn" data-mode="unuttum">Şifremi unuttum</button>`;
  else if (m === "unuttum") govde = `<form class="form" id="fUnuttum">
     <div class="note">Kullanıcı adını veya kayıtlı e-postanı yaz. E-postana şifre yenileme linki gönderelim.</div>
     <label>Kullanıcı adı veya e-posta<input id="uk" autocapitalize="none" required></label>
     ${hata}${bilgi}<button class="btn pri" ${S.mesgul?"disabled":""}>${S.mesgul?"Gönderiliyor...":"Yenileme linki gönder"}</button></form>
     <button class="linkbtn" data-mode="giris">← Girişe dön</button>`;
  else govde = `<form class="form" id="fBasvuru">
     <label>Ad soyad<input id="bad" required></label>
     <label>Kullanıcı adı<input id="bu" autocapitalize="none" pattern="[a-zA-Z0-9._]{3,20}" title="3-20 karakter: harf, rakam, nokta, alt çizgi (Türkçe karakter yok)" required></label>
     <label>E-posta<input id="be" type="email" autocapitalize="none" autocomplete="email" required></label>
     <label>Şifre<input id="bp" type="password" minlength="6" autocomplete="new-password" required></label>
     <label>Motosiklet<input id="bm" placeholder="Örn. Yamaha MT-07" required></label>
     <label>Plaka<input id="bpl" placeholder="06 ABC 123" required></label>
     <label>Telefon<input id="bt" inputmode="tel" required></label>
     ${hata}<button class="btn pri" ${S.mesgul?"disabled":""}>${S.mesgul?"Gönderiliyor...":"Başvuruyu gönder"}</button></form>
     <div class="demo">Başvurun yönetici onayından sonra aktif olur.</div>`;
  return `<div class="login wrap">
   <img class="logo" src="${LOGO}" alt="Asphalt Riders logosu">
   ${m !== "unuttum" ? `<div class="seg" role="tablist"><button class="${m==="giris"?"on":""}" data-mode="giris">Giriş yap</button><button class="${m==="basvuru"?"on":""}" data-mode="basvuru">Üyelik başvurusu</button></div>` : `<h2 style="text-align:center">Şifremi unuttum</h2>`}
   ${govde}<div class="sign">Made By : İbrahim Boz</div></div>`;
}
function yeniSifreView() {
  return `<div class="login wrap"><img class="logo" src="${LOGO}" alt="Asphalt Riders logosu"><h2 style="text-align:center">Yeni şifre belirle</h2>
   <form class="form" id="fYeniSifre"><label>Yeni şifre<input id="ns" type="password" minlength="6" autocomplete="new-password" required></label>
   <label>Yeni şifre (tekrar)<input id="ns2" type="password" minlength="6" autocomplete="new-password" required></label>
   ${S.err?`<div class="err">${esc(S.err)}</div>`:""}<button class="btn pri">Şifreyi kaydet</button></form><div class="sign">Made By : İbrahim Boz</div></div>`;
}
function bekleView() {
  return `<div class="login wrap"><img class="logo" src="${LOGO}" alt="Asphalt Riders logosu">
   <div class="card"><span class="chip warn" style="align-self:flex-start">Onay bekleniyor</span>
   <div>Merhaba <b>${esc(S.user.ad)}</b>, başvurun alındı. Bir yönetici onayladığında uygulama otomatik açılacak.</div></div>
   <button class="btn" data-yenile>Durumu kontrol et</button><button class="btn" id="cikis">Çıkış yap</button>
   <div class="sign">Made By : İbrahim Boz</div></div>`;
}

/* ---------- Duyurular ---------- */
function duyuruView() {
  const list = [...S.duyurular].sort((a, b) => (b.pin - a.pin) || ms(b.created_at) - ms(a.created_at));
  return `<h2>Duyurular</h2>
  ${yetki("duyuru")?`<form class="card form" id="fDuyuru"><b>Yeni duyuru</b>
    <input id="db" placeholder="Başlık" required><textarea id="dm" placeholder="Duyuru metni" required></textarea>
    <div class="row"><label class="row" style="flex-direction:row;gap:6px"><input type="checkbox" id="dp" style="width:auto"> Sabitle</label><span class="grow"></span><button class="btn pri sm">Yayınla + bildirim gönder</button></div>
    <div class="meta">Tüm üyelere telefon bildirimi ve e-posta gider.</div></form>`:""}
  ${list.length ? "" : `<div class="note">Henüz duyuru yok.</div>`}
  ${list.map(d => `<article class="card ${d.pin?"pin":""}">
    <div class="meta">${d.pin?'<span class="chip red">Sabit</span>':""}<span>${trTarih(d.created_at.slice(0,10))}</span><span>· ${esc(uye(d.yazan).ad)}</span></div>
    <div class="ttl">${esc(d.baslik)}</div><div style="white-space:pre-wrap">${esc(d.metin)}</div>
    ${yetki("duyuru")?`<div class="row"><button class="btn sm" data-delduyuru="${d.id}">Sil</button></div>`:""}</article>`).join("")}`;
}

/* ---------- Etkinlikler + Anketler ---------- */
function etkinlikView() {
  const uid = S.user.id;
  return anketView() + `<h2>Etkinlikler</h2><div class="sub">Gelip gelmeyeceğini işaretle, kimlerin geldiğini gör.</div>
  ${yetki("duyuru")?`<form class="card form" id="fEtk"><b>Yeni etkinlik</b>
    <input id="eb" placeholder="Etkinlik adı" required>
    <div class="row"><input id="et" type="date" required style="flex:1 1 140px"><input id="es" type="time" value="10:00" required style="flex:1 1 100px"></div>
    <input id="ey" placeholder="Buluşma yeri" required><input id="er" placeholder="Rota (isteğe bağlı)"><input id="eh" type="url" placeholder="Harita linki (isteğe bağlı)">
    <div class="row"><span class="grow"></span><button class="btn pri sm">Oluştur + bildirim gönder</button></div></form>`:""}
  ${S.etkinlikler.length ? "" : `<div class="note">Yaklaşan etkinlik yok.</div>`}
  ${S.etkinlikler.map(e => {
    const gel = S.members.filter(m => e.katilim[m.id] === "evet"), ben = e.katilim[uid];
    return `<article class="card">
     <div class="meta"><span class="chip">${trTarih(e.tarih)}</span><span class="chip">${esc(e.saat)}</span></div>
     <div class="ttl">${esc(e.baslik)}</div>
     <div class="meta" style="font-size:13px;color:var(--fg)">📍 ${esc(e.yer)}${/^https?:\/\//.test(e.harita)?` · <a href="${esc(e.harita)}" target="_blank" rel="noopener" style="color:#ff7b80">Haritada aç</a>`:""}</div>
     ${e.rota?`<div class="meta">Rota: ${esc(e.rota)}</div>`:""}
     <div class="rsvp"><button class="btn sm ${ben==="evet"?"on-yes":""}" data-rsvp="${e.id}:evet">Geliyorum</button><button class="btn sm ${ben==="hayir"?"on-no":""}" data-rsvp="${e.id}:hayir">Gelmiyorum</button></div>
     <div class="meta"><b style="color:var(--fg)">${gel.length} kişi geliyor</b></div>
     <div class="avatars">${gel.map(m => av(m.id)).join("")}</div>
     ${yetki("duyuru")?`<div class="row"><button class="btn sm" data-deletk="${e.id}">Sil</button></div>`:""}</article>`; }).join("")}`;
}
function anketView() {
  const me = S.user.id;
  return `<h2>Buluşma anketleri</h2><div class="sub">${yetki("duyuru")?"Açtığın anket tüm üyelere bildirim olarak gider.":"Anketleri yöneticiler açar, sen oyunu ver."}</div>
  ${yetki("duyuru")?`<form class="card form" id="fAnket"><b>Yeni anket</b>
    <input id="as" placeholder="Soru (örn. Pazar sürüşü nereye?)" required>
    <input id="ao0" placeholder="Seçenek 1" required><input id="ao1" placeholder="Seçenek 2" required>
    <input id="ao2" placeholder="Seçenek 3 (isteğe bağlı)"><input id="ao3" placeholder="Seçenek 4 (isteğe bağlı)">
    <div class="row"><label class="row" style="flex-direction:row;gap:6px"><input type="checkbox" id="ac" style="width:auto"> Birden fazla seçilebilir</label><span class="grow"></span>
    <select id="asr" style="width:auto" aria-label="Anket süresi"><option value="24">24 saat</option><option value="48">2 gün</option><option value="168">1 hafta</option></select></div>
    <div class="row"><span class="grow"></span><button class="btn pri sm">Anketi aç + bildirim gönder</button></div></form>`:""}
  ${S.anketler.length ? "" : `<div class="note">Açık anket yok.</div>`}
  ${S.anketler.map(a => { const kapali = now() > ms(a.bitis), kisi = new Set(a.sec.flatMap(s => s.oy)).size, kalan = Math.ceil((ms(a.bitis) - now()) / 36e5);
   return `<article class="card"><div class="meta"><span class="chip ${kapali?"":"red"}">${kapali?"Kapandı":"Anket"}</span><span>${a.coklu?"Birden fazla seçim":"Tek seçim"}</span>${kapali?"":`<span>· ${kalan>24?Math.ceil(kalan/24)+" gün kaldı":kalan+" saat kaldı"}</span>`}</div>
    <div class="ttl">${esc(a.soru)}</div>
    ${a.sec.map((s, i) => { const p = kisi ? Math.round(s.oy.length / kisi * 100) : 0, ben = s.oy.includes(me);
      return `<button class="poll-op ${ben?"mine":""}" data-oy="${a.id}:${i}" ${kapali?"disabled":""}><span class="fillb" style="width:${p}%"></span><span class="chk">${ben?"✓":""}</span><span>${esc(s.t)}</span><span class="cnt">${s.oy.length} · %${p}</span></button>
      ${s.oy.length?`<div class="avatars" style="padding-left:26px">${s.oy.map(x => av(x)).join("")}</div>`:""}`; }).join("")}
    <div class="meta">${kisi} kişi oy verdi · ${esc(uye(a.yazan).ad)}</div>
    ${yetki("duyuru")?`<div class="row"><button class="btn sm" data-anketsil="${a.id}">Sil</button></div>`:""}</article>`; }).join("")}`;
}

/* ---------- Üyeler ---------- */
function uyelerView() {
  const onayli = uyeSirala(S.members.filter(m => m.onay)), bek = S.members.filter(m => !m.onay), me = S.user.id;
  const onl = uyeSirala(S.members.filter(m => S.online.includes(m.id)));
  return `<div class="card"><div class="row"><span class="chip ok">🟢 ${S.online.length} çevrimiçi</span><span class="meta">${onayli.length} aktif üye</span></div>
    ${yonetici() && onl.length ? `<div class="onlist">${onl.map(m => `<span class="onkisi">${av(m.id)}<small>${esc(m.ad.split(" ")[0])}</small></span>`).join("")}</div>` : ""}</div>
  ${yetki("uye")&&bek.length?`<h2>Onay bekleyenler</h2>${bek.map(m => `<div class="card"><div class="mem">${av(m.id)}<div class="info"><div class="ttl">${esc(m.ad)}</div><div class="meta">@${esc(m.username)} · ${esc(m.motor)} · <span class="plate">${esc(m.plaka)}</span></div><div class="meta">${esc(m.tel)}</div></div></div>
    <div class="row"><button class="btn pri sm" data-onay="${m.id}">Onayla</button><button class="btn sm" data-red="${m.id}">Reddet</button></div></div>`).join("")}`:""}
  <h2>Üyeler</h2>
  ${onayli.map(m => { const y = m.yetkiler || {};
    return `<div class="card"><div class="mem">${av(m.id)}<div class="info">
    <div class="row"><span class="ttl">${esc(m.ad)}</span>${m.rol!=="uye"?`<span class="chip ${m.rol==="kurucu"?"red":""}">${rolAd[m.rol]}</span>`:""}${m.susturuldu?`<span class="chip warn">🔇 Susturuldu</span>`:""}</div>
    <div class="meta">@${esc(m.username)} · ${esc(m.motor)} · <span class="plate">${esc(m.plaka)}</span></div>
    ${yonetici()?`<div class="meta">${esc(m.tel)}</div>`:""}</div></div>
    ${S.user.rol==="kurucu"&&m.rol==="yardimci"?`<div class="yetkiler">${Object.entries(YETKI_ADLARI).map(([k, l]) => `<button class="ytk ${y[k]?"on":""}" data-yetki="${m.id}:${k}" aria-pressed="${!!y[k]}">${y[k]?"✓":"✕"} ${l}</button>`).join("")}</div>`:""}
    ${m.id!==me?`<div class="row"><button class="btn sm" data-dm="${m.id}">Mesaj gönder</button>
      ${S.user.rol==="kurucu"&&m.rol!=="kurucu"?`<button class="btn sm" data-rol="${m.id}">${m.rol==="yardimci"?"Yöneticilikten al":"Yönetici yap"}</button>`:""}
      ${yetki("sohbet")&&m.rol!=="kurucu"?`<button class="btn sm" data-sustur="${m.id}">${m.susturuldu?"🔊 Susturmayı kaldır":"🔇 Grupta sustur"}</button>`:""}</div>`:""}</div>`; }).join("")}`;
}

/* ---------- Aidat ---------- */
function aidatView() {
  const A = S.aidat, d = new Date(), aylar = [...Array(6)].map((_, i) => { const x = new Date(d.getFullYear(), d.getMonth() - 5 + i, 1); return { k: ayKey(x.getFullYear(), x.getMonth()), l: AYLAR[x.getMonth()] }; });
  const onayli = uyeSirala(S.members.filter(m => m.onay)), buAy = aylar[5].k;
  return `<h2>Aidat</h2>
  ${!A.aktif ? `<div class="card"><div class="row"><span class="chip warn">Şu an aidat toplanmıyor</span></div>
    <div class="note">Aidat sistemi hazır bekliyor.${S.user.rol==="kurucu"?" Toplamaya başladığında aylık tutarı gir.":""}</div>
    ${S.user.rol==="kurucu"?`<form class="row" id="fAidat"><input id="at" type="number" min="1" placeholder="Aylık tutar (₺)" required style="flex:1 1 140px"><button class="btn pri sm">Aidatı başlat</button></form>`:""}</div>`
  : `<div class="card"><div class="row"><span class="chip ok">Aktif</span><b>Aylık ${A.tutar} ₺</b><span class="grow"></span>${S.user.rol==="kurucu"?`<button class="btn sm" id="aidatDur">Durdur</button>`:""}</div>
    ${yetki("aidat")?`<div class="meta">Ödeme yapanı işaretlemek için daireye dokun.</div>`:""}
    <div class="scroll"><table><thead><tr><th>Üye</th>${aylar.map(a => `<th>${a.l}</th>`).join("")}</tr></thead><tbody>
    ${onayli.filter(m => yonetici() || m.id === S.user.id).map(m => `<tr><td>${esc(m.ad)}</td>${aylar.map(a => { const k = m.id + "|" + a.k, p = A.odemeler[k];
      return `<td>${yetki("aidat")?`<button class="dot ${p?"paid":""}" data-pay="${k}" aria-label="${esc(m.ad)} ${a.l} ${p?"ödendi":"ödenmedi"}"></button>`:`<span class="dot ${p?"paid":""}"></span>`}</td>`; }).join("")}</tr>`).join("")}
    </tbody></table></div>
    ${yonetici()?`<div class="meta">Bu ay toplanan: <b style="color:var(--fg)">${onayli.filter(m => A.odemeler[m.id + "|" + buAy]).length * A.tutar} ₺</b></div>`:""}</div>`}`;
}

/* ---------- Profil ---------- */
function profilView() {
  const m = S.user;
  return `<h2>Profilim</h2>
  <div class="card"><div class="mem">${av(m.id, "buyuk")}<div class="info"><div class="ttl">${esc(m.ad)}</div><div class="meta">${rolAd[m.rol]} · @${esc(m.username)}</div></div></div>
   <div class="row"><button class="btn sm" data-fotomenu>📷 ${m.foto?"Fotoğrafı değiştir":"Fotoğraf ekle"}</button>${m.foto?`<button class="btn sm" data-fotosil>Fotoğrafı sil</button>`:""}</div>
   ${S.fotoMenu?`<div class="ekm" style="grid-template-columns:repeat(2,1fr)"><label class="ekb"><span>🖼️</span>Galeriden seç<input type="file" accept="image/*" class="fotoIn" hidden></label><label class="ekb"><span>🤳</span>Kamerayla çek<input type="file" accept="image/*" capture="user" class="fotoIn" hidden></label></div>`:""}</div>
  <form class="card form" id="fProfil">
   <label>E-posta<input id="pe" type="email" autocapitalize="none" value="${esc(S.epostam)}" placeholder="ornek@gmail.com" required></label>
   ${S.epostam?"":`<div class="note">⚠️ E-posta ekle. Şifreni unutursan yenileme linki ve duyurular buraya gelir.</div>`}
   <label>Motosiklet<input id="pm" value="${esc(m.motor)}"></label>
   <label>Plaka<input id="ppl" value="${esc(m.plaka)}"></label>
   <label>Telefon<input id="pt" value="${esc(m.tel)}" inputmode="tel"></label>
   <button class="btn pri">Kaydet</button></form>
  <div class="card"><b>Bildirimler</b><div class="meta">${Bildirim.durumYazi()}</div>
   ${Bildirim.acik()?"":`<button class="btn sm pri" id="bildirimAc">🔔 Bildirimleri aç</button>`}</div>
  ${S.user.rol==="kurucu"?`<form class="card form" id="fToplu"><b>📧 Toplu e-posta</b><div class="meta">Tüm onaylı üyelerin e-posta adresine gider (günde en fazla 300 e-posta).</div>
   <input id="tk" placeholder="Konu" required><textarea id="tm" placeholder="Mesaj" required></textarea><button class="btn sm pri">Herkese gönder</button></form>`:""}
  <form class="card form" id="fSifre"><b>Şifre değiştir</b><input id="ys" type="password" minlength="6" autocomplete="new-password" placeholder="Yeni şifre (en az 6 karakter)" required><button class="btn sm">Şifreyi değiştir</button></form>
  <div class="card"><b>Uygulamayı telefona yükle</b><div class="meta">iPhone: Safari'de Paylaş → Ana Ekrana Ekle. Android: Chrome menüsü → Uygulamayı yükle.</div>
   <div class="meta">🔒 Mesajların şifre anahtarı sadece bu cihazda durur. Telefon değiştirirsen eski mesajlar yeni cihazda okunamaz.</div></div>
  <button class="btn" id="cikis">Çıkış yap</button>`;
}

/* ======================= SOHBET ======================= */
const chatBul = id => S.chats.find(c => c.id === id);
const chatAd = c => c.tip === "grup" ? (c.ad || "ASPHALT RIDERS") : uye(c.uyeler.find(x => x !== S.user.id) || S.user.id).ad;
const okunmamis = c => c.mesajlar.filter(m => m.from !== S.user.id && m.ts > (c.okuma[S.user.id] || 0)).length;
const bahsVar = c => c.mesajlar.some(m => m.from !== S.user.id && m.ts > (c.okuma[S.user.id] || 0) && (m.bahs || []).includes(S.user.id));
const benimChatler = () => S.chats.filter(c => c.uyeler.includes(S.user.id));
const avHtml = c => c.tip === "grup" ? `<span class="av"><img src="${LOGO}" alt=""></span>` : av(c.uyeler.find(x => x !== S.user.id) || S.user.id);
const aktifHikayeler = () => S.hikayeler.filter(h => now() - ms(h.ts) < 864e5);
const msgBul = id => chatBul(S.chatOpen)?.mesajlar.find(m => m.id === id);
const yazabilir = c => c.tip !== "grup" || yetki("sohbet") || (!c.kapali && !S.user.susturuldu);

function metinHtml(t) {
  return esc(t).replace(/@([a-zA-Z0-9._]{3,20})/g, (h, u) => {
    const m = S.members.find(x => x.username === u.toLowerCase());
    return m ? `<span class="mention ${m.id === S.user.id ? "ben" : ""}">@${esc(m.ad)}</span>` : h;
  });
}
function onizle(m, c) {
  const me = S.user.id, on = c ? (m.from === me ? "Sen: " : c.tip === "grup" ? uye(m.from).ad.split(" ")[0] + ": " : "") : "";
  if (m.okunamaz) return esc(on + "🔒 Bu cihazda okunamıyor");
  const t = (m.text || "").replace(/@([a-zA-Z0-9._]{3,20})/g, (h, u) => { const x = S.members.find(y => y.username === u.toLowerCase()); return x ? "@" + x.ad : h; });
  const ic = m.tur === "foto" ? "📷 Fotoğraf" : m.tur === "ses" ? "🎤 Sesli mesaj (" + sure(m.sn || 0) + ")" : m.konum ? (m.konum.dk ? "📍 Canlı konum" : "📍 Konum") : m.hikayeYaniti ? "↩ Hikayeye yanıt: " + t : t;
  return esc(on + (ic || ""));
}

function sohbetView() {
  const me = S.user.id, benim = aktifHikayeler().filter(h => h.uid === me), yeni = u => aktifHikayeler().some(h => h.uid === u && !h.goren.includes(me));
  const sonTs = c => c.mesajlar.length ? c.mesajlar.at(-1).ts : 0;
  const chats = benimChatler().filter(c => c.tip === "grup" || c.mesajlar.length).sort((a, b) => sonTs(b) - sonTs(a));
  return `${Bildirim.sorulmadi() || Bildirim.iosEkleGerek() ? `<div class="card bilcard"><b>🔔 Bildirimleri aç</b><div class="meta">${Bildirim.iosEkleGerek() ? "iPhone'da bildirim almak için: Safari → Paylaş → <b>Ana Ekrana Ekle</b>, sonra uygulamayı ana ekrandan aç." : "Duyuru, etkinlik ve senden bahsedildiğinde haberin olsun."}</div>${Bildirim.iosEkleGerek() ? "" : `<button class="btn sm pri" id="bildirimAc">Aç</button>`}</div>` : ""}
  <div class="stories">
    <div class="st">${benim.length?`<button class="ring" data-hk="${me}" aria-label="Hikayeni gör">${av(me)}</button>`:`<button class="ring" data-hikayemenu aria-label="Hikaye ekle">${av(me)}</button>`}
      <button class="plus" data-hikayemenu aria-label="Hikaye ekle">+</button><small>Hikayen</small></div>
    ${hikayeSirasi().map(u => `<div class="st"><button class="ring ${yeni(u)?"new":""}" data-hk="${u}" aria-label="${esc(uye(u).ad)} hikayesi">${av(u)}</button><small>${esc(uye(u).ad.split(" ")[0])}</small></div>`).join("")}
  </div>
  ${S.hikayeMenu?`<div class="card"><div class="row"><b class="grow">Hikaye paylaş · 24 saat görünür</b><button class="icb" data-hikayemenu aria-label="Kapat">✕</button></div>
   <div class="ekm" style="grid-template-columns:repeat(3,1fr)"><label class="ekb"><span>🖼️</span>Galeri<input type="file" accept="image/*" class="hikayeIn" hidden></label>
   <label class="ekb"><span>🤳</span>Ön kamera<input type="file" accept="image/*" capture="user" class="hikayeIn" hidden></label>
   <label class="ekb"><span>📷</span>Arka kamera<input type="file" accept="image/*" capture="environment" class="hikayeIn" hidden></label></div>
   <div class="meta">24 saat sonra fotoğraf sunucudan tamamen silinir.</div></div>`:""}
  <div class="row"><h2 class="grow">Sohbetler</h2><button class="btn sm" data-yeni>${S.yeniSohbet?"Vazgeç":"+ Yeni sohbet"}</button></div>
  ${S.yeniSohbet?`<div class="card"><b>Kiminle sohbet edeceksin?</b>${uyeSirala(S.members.filter(m => m.onay && m.id !== me)).map(m => `<button class="ci" data-dm="${m.id}">${av(m.id)}<span class="mid"><span class="nm">${esc(m.ad)}</span><span class="pv"><span>${esc(m.motor)}</span></span></span></button>`).join("")}</div>`:""}
  <div class="clist">${chats.map(c => { const son = c.mesajlar.at(-1), n = okunmamis(c), yz = yaziyorKim(c);
    return `<button class="ci" data-chat="${c.id}">${avHtml(c)}<span class="mid"><span class="nm">${esc(chatAd(c))}${c.tip==="grup"&&c.kapali?" 🔒":""}<small>${son?saat(son.ts):""}</small></span>
    <span class="pv">${yz?`<span class="typing">yazıyor...</span>`:`<span>${son?onizle(son, c):"Henüz mesaj yok"}</span>`}${bahsVar(c)?`<span class="unr bahs">@</span>`:""}${n?`<span class="unr">${n}</span>`:""}</span></span></button>`; }).join("")}</div>
  <div class="e2e">🔒 Tüm sohbetler uçtan uca şifreli</div>`;
}

function yaziyorKim(c) { const y = S.yaziyor[c.id]; return y && now() - y.t < 3500 && y.uid !== S.user.id ? y.uid : null; }
function tik(m, c) {
  if (m.bekliyor) return `<span class="tk" aria-label="Gönderiliyor">🕓</span>`;
  const dig = c.uyeler.filter(x => x !== S.user.id);
  if (dig.length && dig.every(x => (c.okuma[x] || 0) >= m.ts)) return `<span class="tk read" aria-label="Görüldü">✓✓</span>`;
  return `<span class="tk" aria-label="İletildi">✓✓</span>`;
}
function balon(m, c) {
  const me = S.user.id, mine = m.from === me, r = m.reply && c.mesajlar.find(x => x.id === m.reply), k = m.konum, tp = S.tepki[m.id] || {}, vals = Object.values(tp);
  let ic;
  if (m.okunamaz) ic = `<div class="mtx" style="color:var(--muted)">🔒 Bu mesaj başka bir cihaz için şifrelenmiş, burada okunamıyor.</div>`;
  else ic = `
   ${r?`<div class="quote"><b>${r.from===me?"Sen":esc(uye(r.from).ad)}</b>${onizle(r)}</div>`:""}
   ${m.hikayeYaniti?`<div class="quote"><b>Hikayeye yanıt</b></div>`:""}
   ${m.tur==="foto"?(m.url?`<img class="mimg" src="${m.url}" alt="Fotoğraf">`:`<div class="meta">${m.medyaHata?"Fotoğraf açılamadı":"📷 Fotoğraf yükleniyor..."}</div>`):""}
   ${m.tur==="ses"?`<div class="voice"><button class="play" data-play="${m.id}" aria-label="Oynat" ${m.url?"":"disabled"}>▶</button><div class="wave"><i style="animation-duration:${m.sn||1}s"></i></div><span class="meta">${sure(m.sn||0)}</span></div>`:""}
   ${k?`<div class="loc"><div class="map ${k.dk&&k.bitis>now()?"live":""}">📍</div><div><b>${k.dk?"Canlı konum":"Konum"}</b>
     <div class="meta">${k.dk?(k.bitis>now()?Math.ceil((k.bitis-now())/6e4)+" dk kaldı · "+saat(m.guncel)+" güncellendi":"Sona erdi"):(+k.lat).toFixed(4)+", "+(+k.lng).toFixed(4)}</div>
     <a href="https://www.google.com/maps?q=${+k.lat},${+k.lng}" target="_blank" rel="noopener">Haritada aç</a>
     ${mine&&k.dk&&k.bitis>now()?` · <button class="btn sm" data-durdur="${m.id}">Durdur</button>`:""}</div></div>`:""}
   ${m.text?`<div class="mtx">${metinHtml(m.text)}</div>`:""}`;
  const bahsBen = !mine && (m.bahs || []).includes(me);
  return `<div class="mrow ${mine?"me":""}" id="m${m.id}"><div class="bub ${S.secili===m.id?"sel":""} ${bahsBen?"bahsben":""}" data-msg="${m.id}">
   ${c.tip==="grup"&&!mine?`<div class="snd" style="color:${RENK[Math.max(0, S.members.findIndex(x => x.id === m.from)) % RENK.length]}">${esc(uye(m.from).ad)}</div>`:""}
   ${ic}<div class="mt">${saat(m.ts)}${mine?tik(m, c):""}</div></div>
   ${vals.length?`<span class="react">${[...new Set(vals)].join("")}${vals.length>1?" "+vals.length:""}</span>`:""}</div>`;
}
function chatView() {
  const c = chatBul(S.chatOpen), me = S.user.id, dr = S.draft[c.id] || "", yz = yaziyorKim(c);
  const alt = yz ? `<small class="typing">${c.tip==="grup"?esc(uye(yz).ad.split(" ")[0])+" ":""}yazıyor...</small>` : `<small>${c.tip==="grup"?(c.kapali?"🔒 Grup kapalı · ":"")+c.uyeler.length+" üye · bilgi için dokun":"@"+esc(uye(c.uyeler.find(x => x !== me)).username||"")}</small>`;
  const y = S.yanit && msgBul(S.yanit), eksik = c.uyeler.filter(u => !uye(u).pubkey).length;
  let alt2;
  if (!yazabilir(c)) alt2 = `<div class="note" style="text-align:center">${c.kapali?"🔒 Grup şu an kapalı. Sadece yöneticiler mesaj gönderebilir.":"🔇 Grupta mesaj gönderme yetkin kapatıldı."}</div>`;
  else alt2 = `
   ${S.secili?`<div class="emojis">${["👍","❤️","😂","😮","🙏","🔥"].map(x => `<button data-react="${x}">${x}</button>`).join("")}<span class="grow"></span><button class="btn sm" data-reply>↩ Yanıtla</button></div>`:""}
   ${y?`<div class="quote row" style="margin:0;flex-wrap:nowrap"><span class="grow" style="min-width:0"><b>${y.from===me?"Sen":esc(uye(y.from).ad)}</b>${onizle(y)}</span><button class="icb" data-yanitx aria-label="Yanıtı iptal et">✕</button></div>`:""}
   <div id="oneriler" class="oneriler"></div>
   ${S.ekMenu?`<div class="ekm"><label class="ekb"><span>🖼️</span>Galeri<input type="file" accept="image/*" id="fotoIn" hidden></label><label class="ekb"><span>📷</span>Kamera<input type="file" accept="image/*" capture="environment" id="fotoIn2" hidden></label><button class="ekb" data-konum="0"><span>📍</span>Konum</button><button class="ekb" data-konum="15"><span>🔴</span>Canlı 15 dk</button><button class="ekb" data-konum="60"><span>🔴</span>Canlı 1 sa</button></div>`:""}
   ${S.kayit?`<div class="crow"><span class="rec">Kaydediliyor <span id="recT">${sure((now()-S.kayit.bas)/1000)}</span></span><button class="btn sm" data-recx>İptal</button><button class="send" data-recok aria-label="Sesli mesajı gönder">➤</button></div>`
   :`<div class="crow"><button class="icb" data-ek aria-label="Ekle">${S.ekMenu?"✕":"+"}</button><input id="msgIn" placeholder="Mesaj yaz · @ ile bahset" autocomplete="off" value="${esc(dr)}"><button class="send" data-send aria-label="Gönder" ${dr.trim()?"":"hidden"}>➤</button><button class="send" data-mic aria-label="Sesli mesaj kaydet" ${dr.trim()?"hidden":""}>🎤</button></div>`}`;
  return `<header class="chead wrap"><button class="icb" data-back aria-label="Geri">←</button>${avHtml(c)}<span class="grow" ${c.tip==="grup"?'data-grupbilgi role="button" tabindex="0"':""} style="cursor:${c.tip==="grup"?"pointer":"default"}"><b>${esc(chatAd(c))}</b>${alt}</span></header>
  <main class="msgs wrap"><div class="e2e">🔒 Mesajlar uçtan uca şifreli. Bu sohbetin dışındaki kimse, yöneticiler dahil, okuyamaz.</div>
   ${c.tip==="grup"&&c.aciklama?`<div class="e2e" style="color:var(--fg);border-color:var(--line);background:var(--panel)">${esc(c.aciklama)}</div>`:""}
   ${!c.tam&&c.mesajlar.length>=20?`<button class="btn sm" style="align-self:center" data-eski>Önceki mesajları yükle</button>`:""}
   ${eksik?`<div class="e2e" style="color:var(--muted)">${eksik} üye uygulamayı henüz açmadığı için şimdilik mesajları göremez.</div>`:""}
   ${c.mesajlar.map(m => balon(m, c)).join("")}</main>
  ${S.bahsHedef?`<button class="bahsgit" data-bahsgit aria-label="Senden bahsedilen mesaja git">@</button>`:""}
  <div class="composer"><div class="cin wrap">${alt2}</div></div>`;
}
function grupBilgiView() {
  const c = chatBul(S.chatOpen), yt = yetki("sohbet");
  return `<header class="chead wrap"><button class="icb" data-grupbilgi aria-label="Geri">←</button><span class="grow"><b>Grup bilgisi</b></span></header>
  <main class="wrap" style="padding-block:16px 40px;display:flex;flex-direction:column;gap:14px">
   <div class="card" style="align-items:center;text-align:center"><img src="${LOGO}" alt="" style="width:110px"><div class="ttl" style="font-size:20px">${esc(chatAd(c))}</div>
    <div class="meta">${c.uyeler.length} üye · ${c.kapali?'<span class="chip warn">🔒 Kapalı</span>':'<span class="chip ok">Açık</span>'}</div></div>
   ${yt?`<form class="card form" id="fGrup"><b>Grup açıklaması</b><textarea id="ga" maxlength="500" placeholder="Grup kuralları, açıklama...">${esc(c.aciklama)}</textarea><button class="btn sm pri">Açıklamayı kaydet</button></form>
    <div class="card"><b>Mesaj gönderme</b><div class="meta">${c.kapali?"Grup kapalı: sadece yöneticiler yazabiliyor.":"Grup açık: tüm üyeler yazabiliyor."}</div>
     <button class="btn ${c.kapali?"pri":""}" data-grupkapat>${c.kapali?"🔓 Grubu herkese aç":"🔒 Grubu kapat (sadece yöneticiler yazsın)"}</button>
     <div class="meta">Tek tek üye susturmak için Üyeler sekmesini kullan.</div></div>`
   :`<div class="card"><b>Açıklama</b><div style="white-space:pre-wrap">${c.aciklama?esc(c.aciklama):'<span class="meta">Açıklama yok.</span>'}</div></div>`}
   <div class="sign">Made By : İbrahim Boz</div></main>`;
}

async function openChat(id) {
  const c = chatBul(id), onceki = c.okuma[S.user.id] || 0;
  S.tab = "sohbet"; S.chatOpen = id; S.grupBilgi = false; S.yeniSohbet = false; S.secili = null; S.yanit = null; S.ekMenu = false; S.scrollBottom = true;
  const hedefBul = () => c.mesajlar.find(m => m.from !== S.user.id && m.ts > onceki && (m.bahs || []).includes(S.user.id))?.id || null;
  S.bahsHedef = hedefBul();
  c.okuma[S.user.id] = now(); render();
  API.okundu(id).catch(() => {});
  if (!c.yuklendi) { c.yuklendi = true;
    const ham = await API.mesajlar(id); for (const r of ham) if (!c.mesajlar.some(m => m.id === r.id)) c.mesajlar.push(await mesajCoz(r));
    c.mesajlar.sort((a, b) => a.id - b.id); if (ham.length < 80) c.tam = true; S.bahsHedef = S.bahsHedef || hedefBul(); S.scrollBottom = true; render(); }
}
async function eskiYukle() {
  const c = chatBul(S.chatOpen), ilk = c.mesajlar.find(m => m.id > 0);
  const ham = await API.mesajlar(c.id, ilk?.id); if (ham.length < 80) c.tam = true;
  for (const r of ham) if (!c.mesajlar.some(m => m.id === r.id)) c.mesajlar.push(await mesajCoz(r));
  c.mesajlar.sort((a, b) => a.id - b.id); render();
}

/* @bahsetme önerileri */
function oneriGuncelle(input) {
  const kutu = $("#oneriler"); if (!kutu) return;
  const once = input.value.slice(0, input.selectionStart ?? input.value.length), m = once.match(/(?:^|\s)@([\p{L}0-9._]*)$/u);
  if (!m) { kutu.innerHTML = ""; return; }
  const q = m[1].toLocaleLowerCase("tr"), c = chatBul(S.chatOpen);
  S.oneri = uyeSirala(S.members.filter(u => u.onay && u.id !== S.user.id && c.uyeler.includes(u.id) &&
    (u.username.startsWith(q) || u.ad.toLocaleLowerCase("tr").split(" ").some(p => p.startsWith(q))))).slice(0, 6);
  kutu.innerHTML = S.oneri.map(u => `<button class="oneri" data-oneri="${u.username}">${av(u.id)}<span><b>${esc(u.ad)}</b> <small>@${esc(u.username)}</small></span></button>`).join("");
}
function bahsedilenler(text, c) {
  const adlar = [...text.matchAll(/@([a-zA-Z0-9._]{3,20})/g)].map(x => x[1].toLowerCase());
  return S.members.filter(m => adlar.includes(m.username) && m.id !== S.user.id && c.uyeler.includes(m.id)).map(m => m.id);
}

/* Mesaj gönder: icerik = {text} | {tur:"foto"} | {tur:"ses",sn} | {konum} ; dosya = Blob */
let geciciId = -1;
async function gonderMsg(icerik, dosya, chatId = S.chatOpen) {
  const c = chatBul(chatId), yanit = S.yanit, bahs = icerik.text ? bahsedilenler(icerik.text, c) : [];
  const gecici = { id: geciciId--, chat: chatId, from: S.user.id, ts: now(), bekliyor: true, reply: yanit, bahs, ...icerik, guncel: new Date().toISOString() };
  if (dosya) gecici.url = URL.createObjectURL(dosya);
  c.mesajlar.push(gecici); S.yanit = null; S.secili = null; S.ekMenu = false; S.scrollBottom = true; render();
  try {
    const anahtar = await Sifre.yeniAnahtar(), paketIcerik = { ...icerik };
    if (dosya) { const s = await Sifre.dosyaSifrele(dosya, anahtar);
      const yol = await API.yukle("medya", Date.now() + "-" + Math.random().toString(36).slice(2), s.blob);
      paketIcerik.medya = { yol, iv: s.iv, tip: dosya.type }; medyaCache.set(yol, gecici.url); }
    const { paket } = await Sifre.sifrele(paketIcerik, alicilar(c), anahtar);
    const r = await API.mesajGonder(chatId, paket, yanit, bahs);
    const zaten = c.mesajlar.find(m => m.id === r.id);
    Object.assign(gecici, { id: r.id, ts: ms(r.created_at), bekliyor: false, medya: paketIcerik.medya, _anahtar: anahtar });
    if (zaten && zaten !== gecici) c.mesajlar.splice(c.mesajlar.indexOf(zaten), 1);
    c.okuma[S.user.id] = now(); API.okundu(chatId).catch(() => {});
    if (icerik.konum?.dk) canliKonumBasla(gecici);
  } catch (e) { c.mesajlar.splice(c.mesajlar.indexOf(gecici), 1); toast("⚠️ Gönderilemedi: " + e.message); }
  render();
}

/* Canlı konum: uygulama açıkken her 30 sn güncellenir */
function canliKonumBasla(m) {
  const c = chatBul(m.chat);
  const t = setInterval(() => {
    if (m.konum.bitis <= now()) { clearInterval(t); delete S.canliKonum[m.id]; return render(); }
    konumAl(async (lat, lng) => {
      m.konum = { ...m.konum, lat, lng }; m.guncel = new Date().toISOString();
      const { paket } = await Sifre.sifrele({ konum: m.konum }, alicilar(c));
      API.mesajGuncelle(m.id, paket).catch(() => {});
    });
  }, 30000);
  S.canliKonum[m.id] = t;
}
async function canliKonumDurdur(m) {
  clearInterval(S.canliKonum[m.id]); delete S.canliKonum[m.id];
  m.konum = { ...m.konum, bitis: now() };
  const { paket } = await Sifre.sifrele({ konum: m.konum }, alicilar(chatBul(m.chat)));
  await API.mesajGuncelle(m.id, paket); render();
}
function konumAl(cb, hata) {
  if (!navigator.geolocation) return hata && hata();
  navigator.geolocation.getCurrentPosition(p => cb(p.coords.latitude, p.coords.longitude), () => hata && hata(), { enableHighAccuracy: true, timeout: 10000 });
}

/* Sesli mesaj */
async function kayitBasla() {
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: true }), r = new MediaRecorder(st);
    S.kayit = { bas: now(), parca: [], rec: r, st }; r.ondataavailable = e => S.kayit && S.kayit.parca.push(e.data); r.start();
    S.ekMenu = false; render();
    S.kayitT = setInterval(() => { const el = $("#recT"); if (el && S.kayit) el.textContent = sure((now() - S.kayit.bas) / 1000); }, 500);
  } catch (_) { toast("Mikrofon izni verilmedi."); }
}
function kayitBitir(gonder) {
  const k = S.kayit; if (!k) return; clearInterval(S.kayitT); S.kayit = null; const sn = Math.max(1, Math.round((now() - k.bas) / 1000));
  k.rec.onstop = () => { k.st.getTracks().forEach(t => t.stop());
    if (gonder) gonderMsg({ tur: "ses", sn }, new Blob(k.parca, { type: k.rec.mimeType || "audio/webm" })); else render(); };
  k.rec.stop();
}
function kucult(f, cb, max = 1280, kare = false) {
  const u = URL.createObjectURL(f), i = new Image();
  i.onload = () => {
    const c = document.createElement("canvas"), x = c.getContext("2d");
    if (kare) { const k = Math.min(i.width, i.height), boy = Math.min(max, k); c.width = c.height = boy; x.drawImage(i, (i.width - k) / 2, (i.height - k) / 2, k, k, 0, 0, boy, boy); }
    else { const s = Math.min(1, max / Math.max(i.width, i.height)); c.width = Math.round(i.width * s); c.height = Math.round(i.height * s); x.drawImage(i, 0, 0, c.width, c.height); }
    URL.revokeObjectURL(u); c.toBlob(b => cb(b), "image/jpeg", 0.82); };
  i.onerror = () => toast("Fotoğraf açılamadı"); i.src = u;
}

/* ======================= HİKAYELER ======================= */
function hikayeSirasi() { const me = S.user.id, ak = aktifHikayeler(), yeni = u => ak.some(h => h.uid === u && !h.goren.includes(me));
  return [...new Set(ak.filter(h => h.uid !== me).map(h => h.uid))].sort((a, b) => yeni(b) - yeni(a)); }
function hikayeAc(uid) { const me = S.user.id, l = aktifHikayeler().filter(h => h.uid === uid); if (!l.length) return;
  const i = uid === me ? 0 : l.findIndex(h => !h.goren.includes(me)); S.hv = { uid, i: i < 0 ? 0 : i }; hikayeGoster(); }
async function hikayeGoster() {
  clearTimeout(S.hvT); const box = $("#storyBox"); if (!S.hv) { box.innerHTML = ""; return; }
  const me = S.user.id, l = aktifHikayeler().filter(h => h.uid === S.hv.uid), h = l[S.hv.i]; if (!h) return hikayeKapat();
  if (!h.goren.includes(me)) { h.goren.push(me); if (h.uid !== me) API.hikayeGordum(h.id); }
  S.hv.cur = h.id;
  const u = uye(h.uid), gor = h.goren.filter(x => x !== me);
  box.innerHTML = `<div class="sv" role="dialog" aria-label="Hikaye">
   <div class="bars">${l.map((x, j) => `<span><i class="${j<S.hv.i?"full":j===S.hv.i&&h.url?"run":""}"></i></span>`).join("")}</div>
   <div class="svh">${av(h.uid)}<b>${esc(h.uid===me?"Hikayen":u.ad)}</b><small>${once(h.ts)}</small><button class="x" data-svx aria-label="Kapat">✕</button></div>
   ${h.url?`<img src="${h.url}" alt="Hikaye fotoğrafı" draggable="false" oncontextmenu="return false">`:`<div style="flex:1;display:grid;place-items:center">Yükleniyor...</div>`}
   <button class="tz" data-svp aria-label="Önceki"></button><button class="tz r" data-svn aria-label="Sonraki"></button>
   <div class="svf">${h.uid===me?`<span class="grow">👁 ${gor.length} görüntüleme${gor.length?": "+gor.map(x => esc(uye(x).ad.split(" ")[0])).join(", "):""}</span><button class="btn sm" data-svdel>Sil</button>`
   :`<form id="fSvy" class="row grow" style="flex-wrap:nowrap"><input id="svy" placeholder="${esc(u.ad.split(" ")[0])} kişisine yanıt gönder" autocomplete="off"><button class="send" aria-label="Gönder">➤</button></form>`}</div></div>`;
  if (!h.url) { try { h.url = URL.createObjectURL(await API.indir("hikaye", h.yol)); } catch (_) { return hikayeIleri(); } if (S.hv?.cur === h.id) hikayeGoster(); return; }
  S.hvT = setTimeout(hikayeIleri, 5000);
}
function hikayeIleri() { if (!S.hv) return; const l = aktifHikayeler().filter(h => h.uid === S.hv.uid);
  if (S.hv.i < l.length - 1) { S.hv.i++; return hikayeGoster(); }
  const sira = hikayeSirasi(), sonraki = sira[sira.indexOf(S.hv.uid) + 1]; sonraki !== undefined ? hikayeAc(sonraki) : hikayeKapat(); }
function hikayeGeri() { if (!S.hv) return; if (S.hv.i > 0) S.hv.i--; hikayeGoster(); }
function hikayeKapat() { clearTimeout(S.hvT); S.hv = null; $("#storyBox").innerHTML = ""; render(); }

/* ======================= OLAYLAR ======================= */
document.addEventListener("click", e => {
  if (e.target.closest("a")) return;
  const t = e.target.closest("button,[data-tab],[data-grupbilgi]"); if (!t) return; const d = t.dataset;
  if (d.mode) { S.loginMode = d.mode; S.err = ""; S.bilgi = ""; return render(); }
  if (S.durum === "bekliyor" && "yenile" in d) return baslat();
  if (t.id === "cikis") return dene(async () => { await Bildirim.cikis(); await API.cikis(); location.reload(); });
  if (S.durum !== "hazir") return;
  const me = S.user.id;
  if (d.tab) { S.tab = d.tab; S.fotoMenu = false; S.hikayeMenu = false; render(); return window.scrollTo(0, 0); }
  if (d.rsvp) { const [id, v] = d.rsvp.split(":"), ev = S.etkinlikler.find(x => x.id == id), yeni = ev.katilim[me] === v ? null : v;
    ev.katilim[me] = yeni || undefined; render(); return dene(() => API.katil(+id, yeni)); }
  if (d.delduyuru) return dene(async () => { await API.duyuruSil(+d.delduyuru); await yukleDuyurular(); render(); }, "Duyuru silindi");
  if (d.deletk) return dene(async () => { await API.etkinlikSil(+d.deletk); await yukleEtkinlikler(); render(); }, "Etkinlik silindi");
  if (d.onay) return dene(async () => { await API.uyeOnayla(d.onay); await yukleUyeler(); await yukleSohbetler(); render(); }, "Üye onaylandı");
  if (d.red) return dene(async () => { await API.uyeReddet(d.red); await yukleUyeler(); render(); }, "Başvuru reddedildi");
  if (d.rol) { const m = uye(d.rol), yeni = m.rol === "yardimci" ? "uye" : "yardimci";
    return dene(async () => { await API.rolDegistir(m.id, yeni); await yukleUyeler(); render(); }, yeni === "yardimci" ? "Yönetici yapıldı (tüm yetkiler açık)" : "Yöneticilikten alındı"); }
  if (d.yetki) { const [uid, k] = d.yetki.split(":"), m = uye(uid), y = { ...(m.yetkiler || {}) }; y[k] = !y[k]; m.yetkiler = y; render();
    return dene(async () => { await API.yetkiAyarla(uid, y); await yukleUyeler(); render(); }); }
  if (d.sustur) { const m = uye(d.sustur), yeni = !m.susturuldu;
    return dene(async () => { await API.sustur(m.id, yeni); await yukleUyeler(); render(); }, yeni ? m.ad + " grupta susturuldu" : "Susturma kaldırıldı"); }
  if (d.pay) { const [uid, ay] = d.pay.split("|"), od = !S.aidat.odemeler[d.pay]; S.aidat.odemeler[d.pay] = od; render(); return dene(() => API.odemeDegistir(uid, ay, od)); }
  if (t.id === "aidatDur") return dene(async () => { await API.aidatAyar(false, S.aidat.tutar); await yukleAidat(); render(); }, "Aidat durduruldu");
  if (t.id === "bildirimAc") return Bildirim.ac();
  if ("fotomenu" in d) { S.fotoMenu = !S.fotoMenu; return render(); }
  if ("fotosil" in d) return dene(async () => { await API.fotoSil(S.user.foto); await yukleUyeler(); render(); }, "Profil fotoğrafı silindi");
  if ("hikayemenu" in d) { S.hikayeMenu = !S.hikayeMenu; return render(); }
  if ("grupbilgi" in d) { S.grupBilgi = !S.grupBilgi; S.scrollBottom = !S.grupBilgi; render(); return S.grupBilgi && window.scrollTo(0, 0); }
  if ("grupkapat" in d) { const c = chatBul(GRUP), yeni = !c.kapali;
    return dene(async () => { await API.grupAyarla(null, yeni); c.kapali = yeni; render(); }, yeni ? "Grup kapatıldı" : "Grup açıldı"); }
  if ("chat" in d) return openChat(d.chat);
  if ("back" in d) { if (S.kayit) kayitBitir(false); S.chatOpen = null; S.grupBilgi = false; S.secili = null; S.yanit = null; S.ekMenu = false; S.bahsHedef = null; render(); return window.scrollTo(0, 0); }
  if ("dm" in d) return dene(async () => { const id = await API.dmAc(d.dm); if (!chatBul(id)) await yukleSohbetler(); openChat(id); });
  if ("yeni" in d) { S.yeniSohbet = !S.yeniSohbet; return render(); }
  if ("eski" in d) return dene(eskiYukle);
  if ("bahsgit" in d) { const el = document.getElementById("m" + S.bahsHedef); S.bahsHedef = null; t.remove();
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("parla"); setTimeout(() => el.classList.remove("parla"), 2200); } return; }
  if (d.oneri) { const inp = $("#msgIn"), pos = inp.selectionStart ?? inp.value.length, once = inp.value.slice(0, pos).replace(/@[\p{L}0-9._]*$/u, "@" + d.oneri + " ");
    inp.value = once + inp.value.slice(pos); S.draft[S.chatOpen] = inp.value; $("#oneriler").innerHTML = ""; inp.focus(); inp.setSelectionRange(once.length, once.length);
    $("[data-send]").hidden = false; $("[data-mic]").hidden = true; return; }
  if ("send" in d) { const v = (S.draft[S.chatOpen] || "").trim(); if (!v) return; S.draft[S.chatOpen] = ""; return gonderMsg({ text: v }); }
  if ("mic" in d) return kayitBasla();
  if ("recx" in d) return kayitBitir(false);
  if ("recok" in d) return kayitBitir(true);
  if ("ek" in d) { S.ekMenu = !S.ekMenu; return render(); }
  if ("konum" in d) { const dk = +d.konum, chatId = S.chatOpen; S.ekMenu = false; render(); toast("Konum alınıyor...");
    return konumAl((lat, lng) => gonderMsg({ konum: { lat, lng, dk, bitis: dk ? now() + dk * 6e4 : 0 } }, null, chatId), () => toast("Konum izni verilmedi.")); }
  if ("react" in d) { const m = msgBul(S.secili), tp = S.tepki[m.id] ||= {}, yeni = tp[me] === d.react ? null : d.react;
    if (yeni) tp[me] = yeni; else delete tp[me]; S.secili = null; render(); return dene(() => API.tepki(m.id, m.chat, yeni)); }
  if ("reply" in d) { S.yanit = S.secili; S.secili = null; render(); return $("#msgIn") && $("#msgIn").focus(); }
  if ("yanitx" in d) { S.yanit = null; return render(); }
  if ("play" in d) { const m = msgBul(+d.play), w = t.parentElement.querySelector(".wave"); w.classList.remove("playing"); void w.offsetWidth; w.classList.add("playing");
    if (m.url) new Audio(m.url).play().catch(() => toast("Ses çalınamadı")); return; }
  if ("durdur" in d) return dene(() => canliKonumDurdur(msgBul(+d.durdur)), "Canlı konum durduruldu");
  if ("msg" in d) { const id = +d.msg; if (id < 0 || !yazabilir(chatBul(S.chatOpen))) return; S.secili = S.secili === id ? null : id; return render(); }
  if ("hk" in d) return hikayeAc(d.hk);
  if ("svx" in d) return hikayeKapat();
  if ("svp" in d) return hikayeGeri();
  if ("svn" in d) return hikayeIleri();
  if ("svdel" in d) { const h = S.hikayeler.find(x => x.id === S.hv.cur); return dene(async () => { await API.hikayeSil(h.id, h.yol); S.hikayeler = S.hikayeler.filter(x => x.id !== h.id); hikayeGoster(); }, "Hikaye silindi"); }
  if (d.oy) { const [aid, i] = d.oy.split(":"), a = S.anketler.find(x => x.id == aid), s = a.sec[i], vardi = s.oy.includes(me);
    if (!a.coklu) a.sec.forEach(x => x.oy = x.oy.filter(y => y !== me)); else s.oy = s.oy.filter(y => y !== me); if (!vardi) s.oy.push(me); render();
    return dene(() => API.oyVer(a.id, +i, a.coklu, vardi)); }
  if (d.anketsil) return dene(async () => { await API.anketSil(+d.anketsil); await yukleAnketler(); render(); }, "Anket silindi");
});
let sonYaziyor = 0;
document.addEventListener("input", e => {
  if (e.target.id !== "msgIn") return; S.draft[S.chatOpen] = e.target.value; const bos = !e.target.value.trim();
  $("[data-send]").hidden = bos; $("[data-mic]").hidden = !bos; oneriGuncelle(e.target);
  if (!bos && now() - sonYaziyor > 2500) { sonYaziyor = now(); Canli?.yaziyor(S.chatOpen); }
});
document.addEventListener("keydown", e => {
  if (e.target.id === "msgIn" && e.key === "Enter") { e.preventDefault(); const ilk = $(".oneri"); if (ilk) return ilk.click(); $("[data-send]").click(); }
  if (e.key === "Enter" && e.target.matches("[data-grupbilgi]")) e.target.click();
});
document.addEventListener("focusin", e => { if (e.target.id === "svy") { clearTimeout(S.hvT); const b = $(".bars i.run"); if (b) b.style.animationPlayState = "paused"; } });
document.addEventListener("change", e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  if (e.target.id === "fotoIn" || e.target.id === "fotoIn2") kucult(f, b => gonderMsg({ tur: "foto" }, b));
  else if (e.target.classList.contains("hikayeIn")) { S.hikayeMenu = false; toast("Hikaye yükleniyor..."); kucult(f, b => dene(async () => {
    const yol = await API.yukle("hikaye", Date.now() + ".jpg", b); await API.hikayeEkle(yol); await yukleHikayeler(); render(); }, "Hikayen paylaşıldı · 24 saat görünür"), 1440); }
  else if (e.target.classList.contains("fotoIn")) { S.fotoMenu = false; toast("Fotoğraf yükleniyor..."); kucult(f, b => dene(async () => {
    await API.fotoYukle(b, S.user.foto); await yukleUyeler(); render(); }, "Profil fotoğrafı güncellendi"), 400, true); }
  e.target.value = "";
});
document.addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target.id, v = id => $("#" + id).value.trim();
  if (f === "fGiris") { const ku = v("lu"), sf = $("#lp").value; S.mesgul = true; S.err = ""; S.bilgi = ""; render();
    try { await API.giris(ku, sf); S.mesgul = false; return baslat(); } catch (er) { S.err = er.message; S.mesgul = false; return render(); } }
  if (f === "fBasvuru") { const bilgi = { username: v("bu"), eposta: v("be").toLowerCase(), sifre: $("#bp").value, ad: v("bad"), motor: v("bm"), plaka: v("bpl").toLocaleUpperCase("tr"), tel: v("bt") };
    S.mesgul = true; S.err = ""; render();
    try { await API.kayit(bilgi); S.mesgul = false; return baslat(); } catch (er) { S.err = er.message; S.mesgul = false; return render(); } }
  if (f === "fUnuttum") { const k = v("uk"); S.mesgul = true; S.err = ""; render();
    try { await API.sifreSifirla(k); S.bilgi = "Bu bilgiyle kayıtlı bir hesap varsa e-postana yenileme linki gönderdik. Gelmezse spam klasörüne bak."; S.loginMode = "giris"; }
    catch (er) { S.err = er.message; }
    S.mesgul = false; return render(); }
  if (f === "fYeniSifre") { const a = $("#ns").value, b = $("#ns2").value; if (a !== b) { S.err = "Şifreler aynı değil."; return render(); }
    try { await API.sifreDegistir(a); S.err = ""; history.replaceState(null, "", location.pathname); toast("Şifren yenilendi"); return baslat(); } catch (er) { S.err = er.message; return render(); } }
  if (S.durum !== "hazir") return;
  if (f === "fDuyuru") { const baslik = v("db"), metin = v("dm");
    return dene(async () => { await API.duyuruEkle({ baslik, metin, pin: $("#dp").checked }); await yukleDuyurular(); render(); }, "Duyuru yayınlandı, bildirimler gidiyor"); }
  if (f === "fEtk") { const e2 = { baslik: v("eb"), tarih: v("et"), saat: v("es"), yer: v("ey"), rota: v("er"), harita: v("eh") };
    return dene(async () => { await API.etkinlikEkle(e2); await yukleEtkinlikler(); render(); }, "Etkinlik oluşturuldu, bildirimler gidiyor"); }
  if (f === "fAnket") { const sec = ["ao0","ao1","ao2","ao3"].map(v).filter(Boolean); if (sec.length < 2) return toast("En az 2 seçenek gir");
    const soru = v("as");
    return dene(async () => { await API.anketEkle({ soru, secenekler: sec, coklu: $("#ac").checked, bitis: new Date(now() + (+$("#asr").value) * 36e5).toISOString() });
      await yukleAnketler(); render(); }, "Anket açıldı, bildirimler gidiyor"); }
  if (f === "fAidat") { const tutar = +v("at"); return dene(async () => { await API.aidatAyar(true, tutar); await yukleAidat(); render(); }, "Aidat başlatıldı"); }
  if (f === "fProfil") { const ep = v("pe");
    return dene(async () => { await API.profilGuncelle({ motor: v("pm"), plaka: v("ppl").toLocaleUpperCase("tr"), tel: v("pt") }); if (ep && ep !== S.epostam) { await API.epostaKaydet(ep); S.epostam = ep.toLowerCase(); } await yukleUyeler(); render(); }, "Profil kaydedildi"); }
  if (f === "fSifre") return dene(async () => { await API.sifreDegistir($("#ys").value); e.target.reset(); }, "Şifren değişti");
  if (f === "fToplu") { const konu = v("tk"), metin = v("tm");
    return dene(async () => { const r = await API.topluEposta(konu, metin); if (!r.brevo) return toast("E-posta servisi henüz kurulmadı."); e.target.reset(); toast("📧 " + r.gonderilen + " kişiye gönderildi"); }); }
  if (f === "fGrup") return dene(async () => { await API.grupAyarla(v("ga"), null); chatBul(GRUP).aciklama = v("ga"); render(); }, "Açıklama kaydedildi");
  if (f === "fSvy") { const txt = v("svy"); if (!txt) return; const uid = S.hv.uid; hikayeKapat();
    return dene(async () => { const id = await API.dmAc(uid); if (!chatBul(id)) await yukleSohbetler(); await gonderMsg({ text: txt, hikayeYaniti: true }, null, id); }, "Yanıtın gönderildi"); }
});

/* ======================= CANLI GÜNCELLEME ======================= */
let Canli = null, tazeleT = {};
function gecikmeli(ad, f) { clearTimeout(tazeleT[ad]); tazeleT[ad] = setTimeout(async () => { try { await f(); render(); } catch (_) {} }, 300); }
async function degisti(tablo, p) {
  const r = p.new && Object.keys(p.new).length ? p.new : p.old;
  if (tablo === "mesajlar") {
    if (p.eventType === "DELETE") return;
    const c = chatBul(r.chat_id); if (!c) return gecikmeli("sohbet", async () => { await yukleSohbetler(); await yukleSonMesajlar(); });
    const m = await mesajCoz(r), i = c.mesajlar.findIndex(x => x.id === m.id);
    if (i >= 0) { if (c.mesajlar[i].from === S.user.id && p.eventType === "INSERT") return; c.mesajlar[i] = { ...c.mesajlar[i], ...m }; }
    else if (!c.mesajlar.some(x => x.bekliyor && x.from === m.from)) {
      c.mesajlar.push(m); c.mesajlar.sort((a, b) => a.id - b.id);
      if (S.yaziyor[c.id]?.uid === m.from) delete S.yaziyor[c.id];
      if (m.from !== S.user.id) {
        if (S.chatOpen === c.id && document.visibilityState === "visible") { c.okuma[S.user.id] = now(); API.okundu(c.id).catch(() => {}); S.scrollBottom = window.innerHeight + scrollY >= document.body.scrollHeight - 200; }
        else toast(((m.bahs || []).includes(S.user.id) ? "@ " + uye(m.from).ad + " senden bahsetti" : "💬 " + chatAd(c) + ": " + onizle(m).replace(/&[^;]+;/g, "")));
      }
    }
    return render();
  }
  if (tablo === "chat_uyeler") { const c = chatBul(r.chat_id);
    if (c && p.eventType === "UPDATE" && r.uid) { c.okuma[r.uid] = ms(r.son_okuma); return render(); }
    return gecikmeli("sohbet", async () => { await yukleSohbetler(); await yukleSonMesajlar(); }); }
  if (tablo === "chats") { const c = chatBul(r.id); if (c && p.new) { c.aciklama = r.aciklama || ""; c.kapali = !!r.kapali; return render(); } return; }
  const harita = { tepkiler: yukleTepkiler, duyurular: yukleDuyurular, etkinlikler: yukleEtkinlikler, katilim: yukleEtkinlikler, anketler: yukleAnketler, oylar: yukleAnketler, hikayeler: yukleHikayeler, profiles: yukleUyeler };
  if (harita[tablo]) gecikmeli(tablo, harita[tablo]);
}
function yaziyorGeldi(p) { if (p.uid === S.user?.id) return; S.yaziyor[p.chat] = { uid: p.uid, t: now() }; render(); setTimeout(render, 3600); }
function onlineGeldi(l) { S.online = l; if (S.durum === "hazir" && !S.chatOpen) render(); }

/* ======================= BAŞLAT ======================= */
async function baslat() {
  S.durum = "yukleniyor"; render();
  try {
    if (/error_description=/.test(location.hash)) { S.err = "Link geçersiz veya süresi dolmuş. Yeniden 'Şifremi unuttum' de."; history.replaceState(null, "", location.pathname); S.durum = "giris"; return render(); }
    const uid = await API.oturum();
    if (!uid) { S.durum = "giris"; return render(); }
    if (API.kurtarmaModu()) { S.durum = "yenisifre"; return render(); }
    S.user = await API.profilim();
    if (!S.user.onay) { S.durum = "bekliyor"; render(); clearTimeout(baslat.t); baslat.t = setTimeout(baslat, 20000); return; }
    const acik = await Sifre.hazirla(uid);
    if (!Sifre.ayni(acik, S.user.pubkey)) await API.profilGuncelle({ pubkey: acik });
    await hepsiniYukle();
    S.durum = "hazir"; render();
    if (!Canli) Canli = API.canli(degisti, yaziyorGeldi, onlineGeldi);
    Bildirim.giris();
    API.eskiHikayelerimiTemizle().catch(() => {});
  } catch (e) { console.error(e); S.err = e.message; S.durum = "giris"; render(); }
}
API.kurtarmaDinle(() => { if (S.durum !== "yenisifre") { S.durum = "yenisifre"; render(); } });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || S.durum !== "hazir") return;
  API.tazele();
  gecikmeli("hepsi", async () => { await hepsiniYukle(); if (S.chatOpen) { const c = chatBul(S.chatOpen); c.okuma[S.user.id] = now(); API.okundu(c.id).catch(() => {}); } });
});
setInterval(() => { if (S.durum === "hazir" && !S.chatOpen && S.tab === "sohbet") render(); }, 60000);
Bildirim.baslat().catch(() => {});
baslat();
