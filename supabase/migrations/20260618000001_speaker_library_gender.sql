-- Architecture : genre des speakers + bibliothèque réutilisable (people).
-- 1. gender_kind : accord du rôle (Animateur/Animatrice…) ; nullable → repli inclusif.
-- 2. people : roster global (pas d'event_id), réservé au backoffice (aucune
--    policy anon). Peuplé automatiquement par trigger dès qu'un speaker est
--    enregistré ; l'import recopie une fiche dans speakers (snapshot par event).
-- Pattern enum/trigger/RLS calqué sur 20260610000001_initial_schema.sql.

create type gender_kind as enum ('f', 'm');

alter table speakers add column gender gender_kind;

create table people (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  title text,
  company text,
  bio text,
  photo_url text,
  gender gender_kind,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Clé d'unicité par nom (insensible à la casse) pour l'upsert de capture.
create unique index people_name_uniq on people (lower(first_name), lower(last_name));

-- RLS : bibliothèque réservée à l'organisateur authentifié, jamais exposée à l'anon.
alter table people enable row level security;
create policy auth_all_people on people for all to authenticated using (true) with check (true);

-- Capture automatique : tout speaker enregistré alimente la bibliothèque
-- (latest-wins sur les champs profil).
create or replace function capture_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into people (first_name, last_name, title, company, bio, photo_url, gender)
  values (new.first_name, new.last_name, new.title, new.company, new.bio, new.photo_url, new.gender)
  on conflict (lower(first_name), lower(last_name)) do update set
    title = excluded.title,
    company = excluded.company,
    bio = excluded.bio,
    photo_url = excluded.photo_url,
    gender = excluded.gender,
    updated_at = now();
  return new;
end;
$$;

create trigger on_speaker_saved
  after insert or update on speakers
  for each row execute function capture_person();

-- Backfill des speakers déjà en base (no-op sur une base fraîche : le seed
-- s'exécute après les migrations et déclenche le trigger).
insert into people (first_name, last_name, title, company, bio, photo_url, gender)
select distinct on (lower(first_name), lower(last_name))
  first_name, last_name, title, company, bio, photo_url, gender
from speakers
order by lower(first_name), lower(last_name)
on conflict do nothing;
