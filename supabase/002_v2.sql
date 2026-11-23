-- ASPHALT RIDERS · v2 güncellemesi
-- Profil fotoğrafı, e-posta, yönetici yetkileri, grup ayarları, susturma, bahsetme, bildirim altyapısı
-- Made By : İbrahim Boz

create extension if not exists pg_net with schema extensions;

-- ===== PROFİL =====
alter table profiles add column if not exists foto text;
alter table profiles add column if not exists yetkiler jsonb not null default '{}';
alter table profiles add column if not exists susturuldu boolean not null default false;

-- Kullanıcı kendi profilinde sadece motor/plaka/tel/foto/pubkey değiştirebilir
drop policy if exists "kendi profilini guncelle" on profiles;
create policy "kendi profilini guncelle" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create or replace function public.profil_koru() returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' then
    new.rol := old.rol; new.onay := old.onay; new.yetkiler := old.yetkiler;
    new.susturuldu := old.susturuldu; new.username := old.username; new.id := old.id;
  end if;
  return new;
end $$;
drop trigger if exists profil_koru on profiles;
create trigger profil_koru before update on profiles for each row execute function public.profil_koru();

-- E-posta ayrı tabloda: sadece sahibi ve kurucu görür
create table if not exists public.iletisim (
  uid uuid primary key references profiles on delete cascade default auth.uid(),
  eposta text not null check (eposta ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
alter table iletisim enable row level security;
drop policy if exists "oku" on iletisim; drop policy if exists "yaz" on iletisim;
create policy "oku" on iletisim for select to authenticated using (uid = auth.uid() or public.benim_rol() = 'kurucu');
create policy "yaz" on iletisim for all to authenticated using (uid = auth.uid()) with check (uid = auth.uid());

-- Kayıtta e-postayı da kaydet
create or replace function public.yeni_kullanici() returns trigger language plpgsql security definer set search_path=public as $$
declare ilk boolean;
begin
  select not exists(select 1 from profiles) into ilk;
  insert into profiles(id, username, ad, motor, plaka, tel, rol, onay)
  values (new.id, lower(new.raw_user_meta_data->>'username'), new.raw_user_meta_data->>'ad',
          coalesce(new.raw_user_meta_data->>'motor',''), coalesce(new.raw_user_meta_data->>'plaka',''),
          coalesce(new.raw_user_meta_data->>'tel',''),
          case when ilk then 'kurucu' else 'uye' end, ilk);
  if coalesce(new.raw_user_meta_data->>'eposta','') <> '' then
    insert into iletisim(uid, eposta) values (new.id, lower(new.raw_user_meta_data->>'eposta')) on conflict do nothing;
  end if;
  if ilk then
    insert into chat_uyeler(chat_id, uid) values ('00000000-0000-0000-0000-000000000001', new.id);
  end if;
  return new;
end $$;

-- ===== YETKİLER =====
-- yetki adları: duyuru (duyuru/etkinlik/anket), uye (başvuru onay), sohbet (grubu aç/kapat, susturma), aidat
create or replace function public.yetkili(y text) returns boolean language sql stable security definer set search_path=public as
$$ select coalesce((select onay and (rol = 'kurucu' or (rol = 'yardimci' and coalesce((yetkiler->>y)::boolean, false))) from profiles where id = auth.uid()), false) $$;

create or replace function public.rol_degistir(uid uuid, yeni text) returns void language plpgsql security definer set search_path=public as $$
begin
  if public.benim_rol() <> 'kurucu' then raise exception 'Sadece kurucu'; end if;
  if yeni not in ('yardimci','uye') then raise exception 'Geçersiz rol'; end if;
  update profiles set rol = yeni,
    yetkiler = case when yeni = 'yardimci' then '{"duyuru":true,"uye":true,"sohbet":true,"aidat":true}'::jsonb else '{}'::jsonb end
  where id = uid and rol <> 'kurucu';
end $$;

create or replace function public.yetki_ayarla(uid uuid, y jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
  if public.benim_rol() <> 'kurucu' then raise exception 'Sadece kurucu'; end if;
  update profiles set yetkiler = jsonb_build_object(
    'duyuru', coalesce((y->>'duyuru')::boolean,false), 'uye', coalesce((y->>'uye')::boolean,false),
    'sohbet', coalesce((y->>'sohbet')::boolean,false), 'aidat', coalesce((y->>'aidat')::boolean,false))
  where id = uid and rol = 'yardimci';
end $$;

create or replace function public.uye_onayla(uid uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.yetkili('uye') then raise exception 'Yetki yok'; end if;
  update profiles set onay = true where id = uid;
  insert into chat_uyeler(chat_id, uid) values ('00000000-0000-0000-0000-000000000001', uid) on conflict do nothing;
end $$;
create or replace function public.uye_reddet(uid uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.yetkili('uye') then raise exception 'Yetki yok'; end if;
  if (select onay from profiles where id = uid) then raise exception 'Onaylı üye silinemez'; end if;
  delete from auth.users where id = uid;
end $$;

-- Duyuru / etkinlik / anket: 'duyuru' yetkisi
drop policy if exists "yaz" on duyurular;   create policy "yaz" on duyurular   for insert to authenticated with check (public.yetkili('duyuru'));
drop policy if exists "sil" on duyurular;   create policy "sil" on duyurular   for delete to authenticated using (public.yetkili('duyuru'));
drop policy if exists "yaz" on etkinlikler; create policy "yaz" on etkinlikler for insert to authenticated with check (public.yetkili('duyuru'));
drop policy if exists "sil" on etkinlikler; create policy "sil" on etkinlikler for delete to authenticated using (public.yetkili('duyuru'));
drop policy if exists "yaz" on anketler;    create policy "yaz" on anketler    for insert to authenticated with check (public.yetkili('duyuru'));
drop policy if exists "sil" on anketler;    create policy "sil" on anketler    for delete to authenticated using (public.yetkili('duyuru'));
-- Aidat: 'aidat' yetkisi
drop policy if exists "yonet" on aidat_odeme;
create policy "yonet" on aidat_odeme for all to authenticated using (public.yetkili('aidat')) with check (public.yetkili('aidat'));

-- ===== GRUP SOHBETİ AYARLARI =====
alter table chats add column if not exists aciklama text not null default '';
alter table chats add column if not exists kapali boolean not null default false;

create or replace function public.grup_ayarla(yeni_aciklama text, yeni_kapali boolean) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.yetkili('sohbet') then raise exception 'Yetki yok'; end if;
  update chats set aciklama = coalesce(yeni_aciklama, aciklama), kapali = coalesce(yeni_kapali, kapali)
  where id = '00000000-0000-0000-0000-000000000001';
end $$;

create or replace function public.uye_sustur(uid uuid, durum boolean) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.yetkili('sohbet') then raise exception 'Yetki yok'; end if;
  update profiles set susturuldu = durum where id = uid and rol <> 'kurucu' and id <> auth.uid();
end $$;

create or replace function public.gonderebilir(c uuid) returns boolean language sql stable security definer set search_path=public as $$
  select case when ch.tip = 'dm' then true
              else public.yetkili('sohbet') or (not ch.kapali and not coalesce((select susturuldu from profiles where id = auth.uid()), true)) end
  from chats ch where ch.id = c $$;

alter table mesajlar add column if not exists bahsedilen uuid[] not null default '{}';
drop policy if exists "gonder" on mesajlar;
create policy "gonder" on mesajlar for insert to authenticated
  with check (gonderen = auth.uid() and public.chat_uyesi(chat_id) and public.gonderebilir(chat_id));

-- ===== BİLDİRİM ALTYAPISI =====
create table if not exists public.push_abonelik (
  endpoint text primary key,
  uid uuid not null references profiles on delete cascade default auth.uid(),
  p256dh text not null, auth text not null,
  created_at timestamptz default now()
);
alter table push_abonelik enable row level security;
drop policy if exists "kendi" on push_abonelik;
create policy "kendi" on push_abonelik for all to authenticated using (uid = auth.uid()) with check (uid = auth.uid());

create table if not exists public.bildirim_log (anahtar text primary key, created_at timestamptz default now());
alter table bildirim_log enable row level security;  -- sadece sunucu fonksiyonu erişir

create or replace function public.bildirim_tetikle() returns trigger language plpgsql security definer set search_path=public, extensions as $$
begin
  perform net.http_post(
    url := 'https://tqzbdxhrocflizwzpmeg.supabase.co/functions/v1/asphalt',
    body := jsonb_build_object('islem', 'bildir', 'tablo', TG_TABLE_NAME, 'id', new.id),
    headers := '{"Content-Type":"application/json"}'::jsonb);
  return new;
end $$;
drop trigger if exists bildir on duyurular;   create trigger bildir after insert on duyurular   for each row execute function public.bildirim_tetikle();
drop trigger if exists bildir on etkinlikler; create trigger bildir after insert on etkinlikler for each row execute function public.bildirim_tetikle();
drop trigger if exists bildir on anketler;    create trigger bildir after insert on anketler    for each row execute function public.bildirim_tetikle();
drop trigger if exists bildir on mesajlar;    create trigger bildir after insert on mesajlar    for each row execute function public.bildirim_tetikle();

-- Hikaye dosyalarını her saat sunucudan tamamen sil
select cron.unschedule('hikaye-temizle');
select cron.schedule('hikaye-temizle', '7 * * * *', $$
  delete from public.hikayeler where created_at < now() - interval '24 hours';
  select net.http_post(url := 'https://tqzbdxhrocflizwzpmeg.supabase.co/functions/v1/asphalt',
    body := '{"islem":"temizle"}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb);
$$);
select cron.schedule('bildirim-log-temizle', '30 3 * * *', $$ delete from public.bildirim_log where created_at < now() - interval '7 days' $$);

-- ===== PROFİL FOTOĞRAFLARI =====
insert into storage.buckets (id, name, public) values ('avatar', 'avatar', false) on conflict do nothing;
drop policy if exists "medya oku" on storage.objects;
drop policy if exists "medya yukle" on storage.objects;
drop policy if exists "medya sil" on storage.objects;
create policy "medya oku" on storage.objects for select to authenticated using (bucket_id in ('medya','hikaye','avatar') and public.onayli());
create policy "medya yukle" on storage.objects for insert to authenticated with check (bucket_id in ('medya','hikaye','avatar') and public.onayli() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "medya sil" on storage.objects for delete to authenticated using (bucket_id in ('medya','hikaye','avatar') and (storage.foldername(name))[1] = auth.uid()::text);

-- Grup ayarları canlı güncellensin
alter publication supabase_realtime add table chats;
