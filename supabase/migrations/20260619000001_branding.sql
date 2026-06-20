-- Profils de branding (backoffice) : palette + image de fond nommées,
-- enregistrées par événement. V1 : stockage seul — aucune surface ne les
-- consomme encore (application des couleurs à faire ensuite).

create table branding_profiles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  bg_color text not null default '#000000',
  text_color text not null default '#ffffff',
  accent_color text not null default '#2563eb',
  bg_image_url text,
  created_at timestamptz not null default now()
);

alter table branding_profiles enable row level security;

-- Backoffice uniquement : un compte organisateur authentifié a tous les droits.
-- Pas de lecture anon (pas encore exposé aux surfaces).
create policy auth_all_branding_profiles on branding_profiles
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on table branding_profiles to authenticated;
