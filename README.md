# ASPHALT RIDERS · Üye Uygulaması

Ankara merkezli ASPHALT RIDERS motosiklet grubunun üye uygulaması (PWA).

- `index.html`, `style.css`, `js/` → uygulama
- `js/api.js` → **altyapı katmanı** (Supabase). Başka servise geçmek için sadece bu dosya değişir.
- `js/sifre.js` → uçtan uca şifreleme (ECDH P-256 + AES-GCM)
- `js/bildirim.js` + `sw.js` → telefon bildirimleri (standart Web Push)
- `supabase/functions/asphalt` → sunucu fonksiyonu: bildirim, e-posta (Brevo), şifre sıfırlama, 24 saatlik hikaye silme
- `supabase/schema.sql` → veritabanı şeması
- `version.json` → her güncellemede numarayı artır (telefonlardaki eski sürümü yeniler)

Yayın: GitHub Pages → https://mibozy.github.io/asphalt-riders/ (main dalına her gönderimde otomatik).

Made By : İbrahim Boz
