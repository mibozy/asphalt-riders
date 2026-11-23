-- ASPHALT RIDERS · v3: mesaj düzenleme/silme, süreli konum, eşzamanlılık düzeltmeleri
-- Made By : İbrahim Boz

alter table mesajlar add column if not exists silinme timestamptz;          -- bu zamanda sunucudan tamamen silinir (süreli konum)
alter table mesajlar add column if not exists silindi boolean not null default false;   -- herkesten silindi
alter table mesajlar add column if not exists duzenlendi boolean not null default false;
create index if not exists mesajlar_silinme on mesajlar(silinme) where silinme is not null;

-- Gönderen sadece içeriği değiştirebilir; sohbet, gönderen ve tarih değişmez. Silinmiş mesaj düzenlenemez.
create or replace function public.mesaj_koru() returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if old.silindi then raise exception 'Silinmiş mesaj değiştirilemez'; end if;
    new.chat_id := old.chat_id; new.gonderen := old.gonderen; new.created_at := old.created_at;
    new.yanit := old.yanit; new.bahsedilen := old.bahsedilen; new.silindi := false;
  end if;
  return new;
end $$;
drop trigger if exists mesaj_koru on mesajlar;
create trigger mesaj_koru before update on mesajlar for each row execute function public.mesaj_koru();

-- Herkesten sil: gönderen kendi mesajını, 'sohbet' yetkilisi grupta herkesin mesajını silebilir
create or replace function public.mesaj_herkesten_sil(mid bigint) returns void language plpgsql security definer set search_path=public as $$
declare m record;
begin
  select ms.*, c.tip into m from mesajlar ms join chats c on c.id = ms.chat_id where ms.id = mid;
  if m is null then return; end if;
  if not (m.gonderen = auth.uid() or (m.tip = 'grup' and public.yetkili('sohbet'))) or not public.chat_uyesi(m.chat_id) then
    raise exception 'Yetki yok';
  end if;
  update mesajlar set silindi = true, sifreli = '{}'::jsonb, bahsedilen = '{}', silinme = null, updated_at = now() where id = mid;
  delete from tepkiler where mesaj_id = mid;
end $$;

-- Benden sil: sadece bu kullanıcıda gizlenir
create table if not exists public.gizlenen (
  uid uuid references profiles on delete cascade default auth.uid(),
  mesaj_id bigint references mesajlar on delete cascade,
  primary key (uid, mesaj_id)
);
alter table gizlenen enable row level security;
drop policy if exists "kendi" on gizlenen;
create policy "kendi" on gizlenen for all to authenticated using (uid = auth.uid()) with check (uid = auth.uid());

-- Süreli konumları sunucudan tamamen sil (her dakika)
select cron.schedule('sureli-mesaj-sil', '* * * * *', $$ delete from public.mesajlar where silinme is not null and silinme < now() $$);

-- Aynı anda iki kişi birbirine mesaj açarsa çakışmasın
create or replace function public.dm_ac(diger uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare k text; c uuid;
begin
  if not public.onayli() or not exists(select 1 from profiles where id = diger and onay) then raise exception 'Yetki yok'; end if;
  k := least(auth.uid()::text, diger::text) || ':' || greatest(auth.uid()::text, diger::text);
  insert into chats(tip, dm_key) values ('dm', k) on conflict (dm_key) do nothing returning id into c;
  if c is null then select id into c from chats where dm_key = k; end if;
  insert into chat_uyeler(chat_id, uid) values (c, auth.uid()), (c, diger) on conflict do nothing;
  return c;
end $$;

-- v4: e-postayla giriş + sohbet sessize alma
create or replace function public.giris_kullanici(kimlik text) returns text language sql stable security definer set search_path=public as $$
  select p.username from profiles p join iletisim i on i.uid = p.id where i.eposta = lower(trim(kimlik)) limit 1 $$;
revoke all on function public.giris_kullanici(text) from public;
grant execute on function public.giris_kullanici(text) to anon, authenticated;
create table if not exists public.sessiz (uid uuid references profiles on delete cascade default auth.uid(), chat_id uuid references chats on delete cascade, bitis timestamptz, primary key (uid, chat_id));
alter table sessiz enable row level security;
create policy "kendi" on sessiz for all to authenticated using (uid = auth.uid()) with check (uid = auth.uid());

-- v6: @herkes (sadece yönetici/kurucu, grup sohbetinde)
alter table mesajlar add column if not exists herkes boolean not null default false;
create or replace function public.herkes_kontrol() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.herkes and not (public.yonetici() and exists(select 1 from chats where id = new.chat_id and tip = 'grup')) then new.herkes := false; end if;
  return new;
end $$;
create trigger herkes_kontrol before insert on mesajlar for each row execute function public.herkes_kontrol();
