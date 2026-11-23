-- ASPHALT RIDERS · Supabase şeması
-- Made By : İbrahim Boz

create extension if not exists pg_cron;

-- ===== PROFİLLER =====
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  ad text not null,
  motor text default '',
  plaka text default '',
  tel text default '',
  rol text not null default 'uye' check (rol in ('kurucu','yardimci','uye')),
  onay boolean not null default false,
  pubkey jsonb,
  created_at timestamptz default now()
);

create or replace function public.benim_rol() returns text language sql stable security definer set search_path=public as
$$ select case when onay then rol else null end from profiles where id = auth.uid() $$;
create or replace function public.onayli() returns boolean language sql stable security definer set search_path=public as
$$ select coalesce((select onay from profiles where id = auth.uid()), false) $$;
create or replace function public.yonetici() returns boolean language sql stable security definer set search_path=public as
$$ select coalesce(public.benim_rol() in ('kurucu','yardimci'), false) $$;

-- Kayıt olunca profil oluştur; ilk kayıt olan kurucu olur
create or replace function public.yeni_kullanici() returns trigger language plpgsql security definer set search_path=public as $$
declare ilk boolean;
begin
  select not exists(select 1 from profiles) into ilk;
  insert into profiles(id, username, ad, motor, plaka, tel, rol, onay)
  values (new.id, lower(new.raw_user_meta_data->>'username'), new.raw_user_meta_data->>'ad',
          coalesce(new.raw_user_meta_data->>'motor',''), coalesce(new.raw_user_meta_data->>'plaka',''),
          coalesce(new.raw_user_meta_data->>'tel',''),
          case when ilk then 'kurucu' else 'uye' end, ilk);
  if ilk then
    insert into chat_uyeler(chat_id, uid) values ('00000000-0000-0000-0000-000000000001', new.id);
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.yeni_kullanici();

alter table profiles enable row level security;
create policy "profil okuma" on profiles for select to authenticated using (id = auth.uid() or public.onayli());
create policy "kendi profilini guncelle" on profiles for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and rol = (select p.rol from profiles p where p.id = auth.uid()) and onay = (select p.onay from profiles p where p.id = auth.uid()));

-- Yönetici işlemleri
create or replace function public.uye_onayla(uid uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.yonetici() then raise exception 'Yetki yok'; end if;
  update profiles set onay = true where id = uid;
  insert into chat_uyeler(chat_id, uid) values ('00000000-0000-0000-0000-000000000001', uid) on conflict do nothing;
end $$;
create or replace function public.uye_reddet(uid uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.yonetici() then raise exception 'Yetki yok'; end if;
  if (select onay from profiles where id = uid) then raise exception 'Onaylı üye silinemez'; end if;
  delete from auth.users where id = uid;
end $$;
create or replace function public.rol_degistir(uid uuid, yeni text) returns void language plpgsql security definer set search_path=public as $$
begin
  if public.benim_rol() <> 'kurucu' then raise exception 'Sadece kurucu'; end if;
  if yeni not in ('yardimci','uye') then raise exception 'Geçersiz rol'; end if;
  update profiles set rol = yeni where id = uid and rol <> 'kurucu';
end $$;

-- ===== DUYURULAR =====
create table public.duyurular (
  id bigint generated always as identity primary key,
  baslik text not null, metin text not null, pin boolean default false,
  yazan uuid references profiles on delete set null default auth.uid(),
  created_at timestamptz default now()
);
alter table duyurular enable row level security;
create policy "oku" on duyurular for select to authenticated using (public.onayli());
create policy "yaz" on duyurular for insert to authenticated with check (public.yonetici());
create policy "sil" on duyurular for delete to authenticated using (public.yonetici());

-- ===== ETKİNLİKLER =====
create table public.etkinlikler (
  id bigint generated always as identity primary key,
  baslik text not null, tarih date not null, saat text not null, yer text not null,
  rota text default '', harita text default '',
  yazan uuid references profiles on delete set null default auth.uid(),
  created_at timestamptz default now()
);
alter table etkinlikler enable row level security;
create policy "oku" on etkinlikler for select to authenticated using (public.onayli());
create policy "yaz" on etkinlikler for insert to authenticated with check (public.yonetici());
create policy "sil" on etkinlikler for delete to authenticated using (public.yonetici());

create table public.katilim (
  etkinlik_id bigint references etkinlikler on delete cascade,
  uid uuid references profiles on delete cascade default auth.uid(),
  durum text check (durum in ('evet','hayir')),
  primary key (etkinlik_id, uid)
);
alter table katilim enable row level security;
create policy "oku" on katilim for select to authenticated using (public.onayli());
create policy "yaz" on katilim for all to authenticated using (uid = auth.uid()) with check (uid = auth.uid() and public.onayli());

-- ===== ANKETLER =====
create table public.anketler (
  id bigint generated always as identity primary key,
  soru text not null, secenekler jsonb not null, coklu boolean default false, bitis timestamptz not null,
  yazan uuid references profiles on delete set null default auth.uid(),
  created_at timestamptz default now()
);
alter table anketler enable row level security;
create policy "oku" on anketler for select to authenticated using (public.onayli());
create policy "yaz" on anketler for insert to authenticated with check (public.yonetici());
create policy "sil" on anketler for delete to authenticated using (public.yonetici());

create table public.oylar (
  anket_id bigint references anketler on delete cascade,
  uid uuid references profiles on delete cascade default auth.uid(),
  secenek int not null,
  primary key (anket_id, uid, secenek)
);
alter table oylar enable row level security;
create policy "oku" on oylar for select to authenticated using (public.onayli());
create policy "oy ver" on oylar for insert to authenticated with check (uid = auth.uid() and public.onayli()
  and exists(select 1 from anketler a where a.id = anket_id and a.bitis > now()));
create policy "oy geri al" on oylar for delete to authenticated using (uid = auth.uid());

-- ===== AİDAT =====
create table public.aidat_ayar (id int primary key default 1 check (id = 1), aktif boolean default false, tutar numeric default 0);
insert into aidat_ayar default values;
alter table aidat_ayar enable row level security;
create policy "oku" on aidat_ayar for select to authenticated using (public.onayli());
create policy "kurucu" on aidat_ayar for update to authenticated using (public.benim_rol() = 'kurucu');

create table public.aidat_odeme (
  uid uuid references profiles on delete cascade, ay text not null,
  primary key (uid, ay)
);
alter table aidat_odeme enable row level security;
create policy "oku" on aidat_odeme for select to authenticated using (uid = auth.uid() or public.yonetici());
create policy "yonet" on aidat_odeme for all to authenticated using (public.yonetici()) with check (public.yonetici());

-- ===== SOHBET (içerik uçtan uca şifreli) =====
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  tip text not null check (tip in ('grup','dm')),
  ad text, dm_key text unique,
  created_at timestamptz default now()
);
create table public.chat_uyeler (
  chat_id uuid references chats on delete cascade,
  uid uuid references profiles on delete cascade,
  son_okuma timestamptz default now(),
  primary key (chat_id, uid)
);
create or replace function public.chat_uyesi(c uuid) returns boolean language sql stable security definer set search_path=public as
$$ select public.onayli() and exists(select 1 from chat_uyeler where chat_id = c and uid = auth.uid()) $$;

alter table chats enable row level security;
alter table chat_uyeler enable row level security;
create policy "oku" on chats for select to authenticated using (public.chat_uyesi(id));
create policy "oku" on chat_uyeler for select to authenticated using (public.chat_uyesi(chat_id));
create policy "okundu" on chat_uyeler for update to authenticated using (uid = auth.uid()) with check (uid = auth.uid());

insert into chats(id, tip, ad) values ('00000000-0000-0000-0000-000000000001', 'grup', 'ASPHALT RIDERS');

create or replace function public.dm_ac(diger uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare k text; c uuid;
begin
  if not public.onayli() or not exists(select 1 from profiles where id = diger and onay) then raise exception 'Yetki yok'; end if;
  k := least(auth.uid()::text, diger::text) || ':' || greatest(auth.uid()::text, diger::text);
  select id into c from chats where dm_key = k;
  if c is null then
    insert into chats(tip, dm_key) values ('dm', k) returning id into c;
    insert into chat_uyeler(chat_id, uid) values (c, auth.uid()), (c, diger);
  end if;
  return c;
end $$;

create table public.mesajlar (
  id bigint generated always as identity primary key,
  chat_id uuid references chats on delete cascade not null,
  gonderen uuid references profiles on delete set null default auth.uid(),
  sifreli jsonb not null,          -- {iv, ct, spk, keys:{uid:...}}  sunucu içeriği okuyamaz
  yanit bigint,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on mesajlar(chat_id, id);
alter table mesajlar enable row level security;
create policy "oku" on mesajlar for select to authenticated using (public.chat_uyesi(chat_id));
create policy "gonder" on mesajlar for insert to authenticated with check (gonderen = auth.uid() and public.chat_uyesi(chat_id));
create policy "guncelle" on mesajlar for update to authenticated using (gonderen = auth.uid()) with check (gonderen = auth.uid());

create table public.tepkiler (
  mesaj_id bigint references mesajlar on delete cascade,
  uid uuid references profiles on delete cascade default auth.uid(),
  emoji text not null,
  chat_id uuid not null,
  primary key (mesaj_id, uid)
);
alter table tepkiler enable row level security;
create policy "oku" on tepkiler for select to authenticated using (public.chat_uyesi(chat_id));
create policy "yaz" on tepkiler for all to authenticated using (uid = auth.uid()) with check (uid = auth.uid() and public.chat_uyesi(chat_id));

-- ===== HİKAYELER (24 saat) =====
create table public.hikayeler (
  id bigint generated always as identity primary key,
  uid uuid references profiles on delete cascade default auth.uid(),
  yol text not null,
  created_at timestamptz default now()
);
create table public.hikaye_goren (
  hikaye_id bigint references hikayeler on delete cascade,
  uid uuid references profiles on delete cascade default auth.uid(),
  primary key (hikaye_id, uid)
);
alter table hikayeler enable row level security;
alter table hikaye_goren enable row level security;
create policy "oku" on hikayeler for select to authenticated using (public.onayli() and created_at > now() - interval '24 hours');
create policy "paylas" on hikayeler for insert to authenticated with check (uid = auth.uid() and public.onayli());
create policy "sil" on hikayeler for delete to authenticated using (uid = auth.uid());
create policy "oku" on hikaye_goren for select to authenticated using (uid = auth.uid() or exists(select 1 from hikayeler h where h.id = hikaye_id and h.uid = auth.uid()));
create policy "gordum" on hikaye_goren for insert to authenticated with check (uid = auth.uid() and public.onayli());

select cron.schedule('hikaye-temizle', '17 * * * *', $$ delete from public.hikayeler where created_at < now() - interval '25 hours' $$);

-- ===== DOSYA DEPOSU =====
insert into storage.buckets (id, name, public) values ('medya', 'medya', false), ('hikaye', 'hikaye', false), ('genel', 'genel', true)
on conflict do nothing;
create policy "medya oku" on storage.objects for select to authenticated using (bucket_id in ('medya','hikaye') and public.onayli());
create policy "medya yukle" on storage.objects for insert to authenticated with check (bucket_id in ('medya','hikaye') and public.onayli() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "medya sil" on storage.objects for delete to authenticated using (bucket_id in ('medya','hikaye') and (storage.foldername(name))[1] = auth.uid()::text);

-- ===== CANLI GÜNCELLEME =====
alter publication supabase_realtime add table mesajlar, tepkiler, chat_uyeler, duyurular, etkinlikler, katilim, anketler, oylar, hikayeler, profiles;
