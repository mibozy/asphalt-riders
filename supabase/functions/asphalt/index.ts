// ASPHALT RIDERS · Sunucu fonksiyonu (Supabase Edge Function: "asphalt")
// İşlemler: bildir (push + e-posta), sifre (şifre sıfırlama linki), toplu (kurucu toplu e-posta), temizle (24 saatlik hikayeleri sil)
// Gizli anahtarlar Supabase → Edge Functions → Secrets bölümünde: VAPID_PRIVATE, BREVO_KEY
// Made By : İbrahim Boz
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const SITE = "https://mibozy.github.io/asphalt-riders/";
const GONDEREN = { name: "ASPHALT RIDERS", email: "mibozy2002@gmail.com" };
const VAPID_PUBLIC = "BGQFN5x_bm-1PK9Ib9oXbG7aNOViXQ6sM9RwjAfX-XFU8oTqvfIUg4zvHf-WeKuNetqy-5dQH__C4GTV04ssolE";
const GRUP = "00000000-0000-0000-0000-000000000001";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE");
const BREVO_KEY = Deno.env.get("BREVO_KEY");
if (VAPID_PRIVATE) webpush.setVapidDetails("mailto:" + GONDEREN.email, VAPID_PUBLIC, VAPID_PRIVATE);

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const cevap = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (t: string) => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const kisalt = (t: string, n = 140) => (t || "").length > n ? t.slice(0, n - 1) + "…" : (t || "");

/* Aynı olay için ikinci kez bildirim gitmesin */
async function ilkKez(anahtar: string) { const { error } = await sb.from("bildirim_log").insert({ anahtar }); return !error; }

async function pushGonder(uids: string[], b: { baslik: string; govde: string; url?: string; tag?: string }) {
  if (!VAPID_PRIVATE || !uids.length) return 0;
  const { data: abo } = await sb.from("push_abonelik").select("*").in("uid", uids);
  const yuk = JSON.stringify({ title: b.baslik, body: b.govde, url: b.url || SITE, tag: b.tag || "ar" });
  let n = 0;
  await Promise.all((abo || []).map(async a => {
    try { await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, yuk, { TTL: 86400, urgency: "high" }); n++; }
    catch (e) { const s = (e as { statusCode?: number }).statusCode; if (s === 404 || s === 410) await sb.from("push_abonelik").delete().eq("endpoint", a.endpoint); }
  }));
  return n;
}

function epostaHtml(baslik: string, icerik: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#0d0d0f;color:#f1f1f3;border-radius:10px;overflow:hidden">
  <div style="background:#8b1a1a;padding:16px 20px;font-size:20px;font-weight:bold;letter-spacing:2px">ASPHALT RIDERS</div>
  <div style="padding:20px"><h2 style="margin:0 0 12px;color:#fff">${esc(baslik)}</h2><div style="white-space:pre-wrap;line-height:1.6;color:#ddd">${icerik}</div>
  <p style="margin-top:24px"><a href="${SITE}" style="background:#c0262d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Uygulamayı aç</a></p></div>
  <div style="padding:12px 20px;font-size:11px;color:#888;border-top:1px solid #2c2c31">Made By : İbrahim Boz</div></div>`;
}
async function epostaGonder(alicilar: string[], konu: string, html: string) {
  if (!BREVO_KEY || !alicilar.length) return 0;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": BREVO_KEY, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: GONDEREN, subject: konu, htmlContent: html, messageVersions: alicilar.map(e => ({ to: [{ email: e }] })) })
  });
  if (!r.ok) console.error("Brevo", r.status, await r.text());
  return r.ok ? alicilar.length : 0;
}
async function onayliUyeler() { const { data } = await sb.from("profiles").select("id, ad").eq("onay", true); return data || []; }
async function epostalar(uids: string[]) { const { data } = await sb.from("iletisim").select("eposta").in("uid", uids); return (data || []).map(x => x.eposta); }

async function bildir(tablo: string, id: number) {
  if (!["duyurular", "etkinlikler", "anketler", "mesajlar"].includes(tablo) || !(await ilkKez(tablo + ":" + id))) return { atlandi: true };
  const { data: r } = await sb.from(tablo).select("*").eq("id", id).maybeSingle();
  if (!r) return { yok: true };
  const uyeler = await onayliUyeler(), ad = (uid: string) => uyeler.find(u => u.id === uid)?.ad || "Bir üye";
  const yazar = r.yazan || r.gonderen, digerleri = uyeler.map(u => u.id).filter(u => u !== yazar);

  if (tablo === "duyurular") {
    const p = await pushGonder(digerleri, { baslik: "📢 " + r.baslik, govde: kisalt(r.metin), tag: "duyuru-" + id });
    const e = await epostaGonder(await epostalar(digerleri), "📢 " + r.baslik, epostaHtml(r.baslik, esc(r.metin)));
    return { p, e };
  }
  if (tablo === "etkinlikler") {
    const tarih = new Date(r.tarih + "T00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
    const ozet = `${tarih} · ${r.saat} · ${r.yer}`;
    const p = await pushGonder(digerleri, { baslik: "🏍️ Yeni etkinlik: " + r.baslik, govde: ozet, tag: "etkinlik-" + id });
    const icerik = `<b>📅 ${esc(tarih)} · ${esc(r.saat)}</b><br>📍 ${esc(r.yer)}${r.rota ? "<br>🛣️ " + esc(r.rota) : ""}${r.harita ? `<br><a href="${esc(r.harita)}" style="color:#ff7b80">Haritada aç</a>` : ""}<br><br>Katılım durumunu uygulamadan işaretle.`;
    const e = await epostaGonder(await epostalar(digerleri), "🏍️ " + r.baslik + " · " + tarih, epostaHtml(r.baslik, icerik));
    return { p, e };
  }
  if (tablo === "anketler") return { p: await pushGonder(digerleri, { baslik: "📊 Yeni anket", govde: r.soru, tag: "anket-" + id }) };

  // mesajlar: içerik şifreli, bildirimde gösterilmez
  const { data: uy } = await sb.from("chat_uyeler").select("uid").eq("chat_id", r.chat_id);
  const { data: ch } = await sb.from("chats").select("tip, ad").eq("id", r.chat_id).single();
  const alicilar = (uy || []).map(x => x.uid).filter(u => u !== r.gonderen);
  const bahs = (r.bahsedilen || []).filter((u: string) => alicilar.includes(u)), kim = ad(r.gonderen);
  const grupAd = ch?.tip === "grup" ? (ch.ad || "ASPHALT RIDERS") : kim;
  const p1 = await pushGonder(bahs, { baslik: "@ " + kim + " senden bahsetti", govde: ch?.tip === "grup" ? grupAd : "Özel mesaj", tag: "bahs-" + id });
  const p2 = await pushGonder(alicilar.filter((u: string) => !bahs.includes(u)), { baslik: grupAd, govde: ch?.tip === "grup" ? kim + ": 🔒 yeni mesaj" : "🔒 Yeni mesaj", tag: "sohbet-" + r.chat_id });
  return { p: p1 + p2 };
}

async function sifre(kimlik: string) {
  kimlik = (kimlik || "").trim().toLowerCase(); if (!kimlik) return;
  let uid: string | null = null;
  if (kimlik.includes("@")) { const { data } = await sb.from("iletisim").select("uid").eq("eposta", kimlik).maybeSingle(); uid = data?.uid || null; }
  else { const { data } = await sb.from("profiles").select("id").eq("username", kimlik).maybeSingle(); uid = data?.id || null; }
  if (!uid || !(await ilkKez("sifre:" + uid + ":" + Math.floor(Date.now() / 120000)))) return;
  const { data: il } = await sb.from("iletisim").select("eposta").eq("uid", uid).maybeSingle();
  const { data: u } = await sb.auth.admin.getUserById(uid);
  if (!il?.eposta || !u?.user?.email) return;
  const { data: link, error } = await sb.auth.admin.generateLink({ type: "recovery", email: u.user.email, options: { redirectTo: SITE } });
  if (error) return console.error(error);
  const icerik = `Şifreni yenilemek için aşağıdaki butona dokun. Link 1 saat geçerli.<br><br><a href="${link.properties.action_link}" style="background:#c0262d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Yeni şifre belirle</a><br><br>Bu isteği sen yapmadıysan bu e-postayı yok say.`;
  await epostaGonder([il.eposta], "ASPHALT RIDERS · Şifre yenileme", epostaHtml("Şifre yenileme", icerik).replace(/<p style="margin-top:24px">[\s\S]*?<\/p>/, ""));
}

async function toplu(req: Request, konu: string, metin: string) {
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data } = await sb.auth.getUser(jwt);
  const { data: p } = await sb.from("profiles").select("rol, onay").eq("id", data.user?.id || "").maybeSingle();
  if (!p || p.rol !== "kurucu" || !p.onay) return cevap({ hata: "Yetki yok" }, 403);
  if (!konu?.trim() || !metin?.trim()) return cevap({ hata: "Konu ve metin gerekli" }, 400);
  const uids = (await onayliUyeler()).map(u => u.id);
  const n = await epostaGonder(await epostalar(uids), konu, epostaHtml(konu, esc(metin)));
  return cevap({ gonderilen: n, brevo: !!BREVO_KEY });
}

async function temizle() {
  const sinir = Date.now() - 864e5; let silinen = 0;
  const { data: klasorler } = await sb.storage.from("hikaye").list("", { limit: 1000 });
  for (const k of klasorler || []) {
    const { data: dosyalar } = await sb.storage.from("hikaye").list(k.name, { limit: 1000 });
    const eski = (dosyalar || []).filter(f => new Date(f.created_at).getTime() < sinir).map(f => k.name + "/" + f.name);
    if (eski.length) { await sb.storage.from("hikaye").remove(eski); silinen += eski.length; }
  }
  await sb.from("hikayeler").delete().lt("created_at", new Date(sinir).toISOString());
  return { silinen };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json();
    if (b.islem === "bildir") return cevap(await bildir(b.tablo, b.id));
    if (b.islem === "sifre") { await sifre(b.kimlik); return cevap({ tamam: true }); }
    if (b.islem === "toplu") return await toplu(req, b.konu, b.metin);
    if (b.islem === "temizle") return cevap(await temizle());
    if (b.islem === "durum") return cevap({ push: !!VAPID_PRIVATE, eposta: !!BREVO_KEY });
    return cevap({ hata: "Bilinmeyen işlem" }, 400);
  } catch (e) { console.error(e); return cevap({ hata: String(e) }, 500); }
});
