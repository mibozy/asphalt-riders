# ASPHALT RIDERS · Üye Uygulaması

Ankara merkezli ASPHALT RIDERS motosiklet grubunun üye uygulaması (PWA).

- `index.html`, `style.css`, `js/` → uygulama
- `js/api.js` → **altyapı katmanı** (Supabase). Başka servise geçmek için sadece bu dosya değişir.
- `js/sifre.js` → uçtan uca şifreleme (ECDH P-256 + AES-GCM)
- `js/bildirim.js` → OneSignal web push
- `supabase/schema.sql` → veritabanı şeması
- `version.json` → her güncellemede numarayı artır (telefonlardaki eski sürümü yeniler)

Yayın: GitHub Pages → https://mibozy.github.io/asphalt-riders/ (main dalına her gönderimde otomatik).

Made By : İbrahim Boz
