# ASPHALT RIDERS · Üye Uygulaması

Ankara merkezli ASPHALT RIDERS motosiklet grubunun üye uygulaması (PWA).

- `index.html`, `style.css`, `js/` → uygulama
- `js/api.js` → **altyapı katmanı** (Supabase). Başka servise geçmek için sadece bu dosya değişir.
- `js/sifre.js` → uçtan uca şifreleme (ECDH P-256 + AES-GCM)
- `js/bildirim.js` → OneSignal web push
- `supabase/schema.sql` → veritabanı şeması

Yayın: Cloudflare Pages (main dalına her gönderimde otomatik).

Made By : İbrahim Boz
