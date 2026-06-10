-- Architecture : schéma initial (PLAN.md §3).
-- Source de vérité de l'état live : screen_state (une ligne par événement).
-- Sécurité : RLS partout. Lectures anonymes limitées à ce dont EP/IR/audience
-- ont besoin ; TOUTES les écritures live passent par des RPC SECURITY DEFINER
-- qui valident le contexte (PIN régie, fingerprint audience).

create extension if not exists pgcrypto;

-- ───────────────────────────── Tables ─────────────────────────────

create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  edition text,
  event_date date,
  start_at timestamptz,
  closing_message text,
  asso_slide_enabled boolean not null default false,
  asso_content jsonb,
  qr_url text,
  sponsor_scroll_speed int not null default 30,
  pin_hash text not null,
  screen_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

create table speakers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  title text,
  company text,
  bio text,
  photo_url text,
  is_host boolean not null default false,
  sort_order int not null default 0,
  hidden boolean not null default false
);

create table sponsors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  logo_url text not null,
  sort_order int not null default 0
);

create type content_kind as enum ('embed_gslides', 'embed_figma', 'image', 'video');

create table contents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  kind content_kind not null,
  url text not null,
  label text not null,
  sort_order int not null default 0
);

create type question_source as enum ('prepared', 'audience');
create type question_status as enum ('pending', 'displayed', 'done', 'archived');

create table questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  text varchar(300) not null,
  source question_source not null,
  status question_status not null default 'pending',
  author_name text,
  pinned boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create type poll_kind as enum ('poll', 'versus');
create type poll_status as enum ('draft', 'live', 'closed', 'archived');

-- Affichage des résultats sur l'EP selon kind (arbitrage utilisateur, PLAN.md D2) :
--   poll   → résultats agrégés EN TEMPS RÉEL pendant le vote
--   versus → résultats masqués pendant le vote, affichés À LA CLÔTURE
create table polls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  kind poll_kind not null,
  question text not null,
  options jsonb not null, -- [{id, label}]
  status poll_status not null default 'draft',
  show_results boolean not null default true,
  created_live boolean not null default false,
  sort_order int not null default 0
);

create table poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  option_id text not null,
  voter_fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (poll_id, voter_fingerprint)
);

create table definitions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  term text not null,
  definition text not null,
  sort_order int not null default 0
);

create table notes (
  event_id uuid primary key references events(id) on delete cascade,
  content_md text not null default '',
  updated_at timestamptz not null default now()
);

create type screen_mode as enum ('attente', 'intro', 'dynamique', 'outro');

create table screen_state (
  event_id uuid primary key references events(id) on delete cascade,
  mode screen_mode not null default 'attente',
  intro_slide_index int not null default 0,
  main_content_id uuid references contents(id) on delete set null,
  overlay jsonb, -- {type: poll|question|definition, id} | null
  speakers_banner_visible boolean not null default true,
  qr_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ─────────────────────── Vue publique des événements ───────────────────────
-- events contient pin_hash et screen_token : jamais exposés à l'anon.
-- Les surfaces lisent events_public.

create view events_public with (security_invoker = off) as
  select id, slug, title, subtitle, edition, event_date, start_at,
         closing_message, asso_slide_enabled, asso_content, qr_url,
         sponsor_scroll_speed
  from events;

-- ───────────────────────────── RLS ─────────────────────────────

alter table events enable row level security;
alter table speakers enable row level security;
alter table sponsors enable row level security;
alter table contents enable row level security;
alter table questions enable row level security;
alter table polls enable row level security;
alter table poll_votes enable row level security;
alter table definitions enable row level security;
alter table notes enable row level security;
alter table screen_state enable row level security;

-- Lecture anonyme : contenu nécessaire à l'EP, l'IR et l'audience.
-- (events : aucune policy anon → lecture uniquement via events_public.)
create policy anon_read_speakers on speakers for select using (true);
create policy anon_read_sponsors on sponsors for select using (true);
create policy anon_read_contents on contents for select using (true);
create policy anon_read_questions on questions for select using (true);
create policy anon_read_polls on polls for select using (true);
create policy anon_read_poll_votes on poll_votes for select using (true);
create policy anon_read_definitions on definitions for select using (true);
create policy anon_read_notes on notes for select using (true);
create policy anon_read_screen_state on screen_state for select using (true);

-- Backoffice : un compte organisateur authentifié a tous les droits.
create policy auth_all_events on events for all to authenticated using (true) with check (true);
create policy auth_all_speakers on speakers for all to authenticated using (true) with check (true);
create policy auth_all_sponsors on sponsors for all to authenticated using (true) with check (true);
create policy auth_all_contents on contents for all to authenticated using (true) with check (true);
create policy auth_all_questions on questions for all to authenticated using (true) with check (true);
create policy auth_all_polls on polls for all to authenticated using (true) with check (true);
create policy auth_all_poll_votes on poll_votes for all to authenticated using (true) with check (true);
create policy auth_all_definitions on definitions for all to authenticated using (true) with check (true);
create policy auth_all_notes on notes for all to authenticated using (true) with check (true);
create policy auth_all_screen_state on screen_state for all to authenticated using (true) with check (true);

-- ───────────────────────────── RPCs ─────────────────────────────
-- Toutes SECURITY DEFINER : les écritures anon passent exclusivement par ici.

-- Vérifie le PIN de l'IR. Retourne l'event_id si OK, sinon null.
create or replace function control_auth(p_slug text, p_pin text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from events
  where slug = p_slug
    and pin_hash = crypt(p_pin, pin_hash);
$$;

-- Mutation de l'état écran par la régie (authentifiée par PIN à chaque appel —
-- l'IR garde le PIN en session côté client ; V1 mono-opérateur).
create or replace function update_screen_state(
  p_slug text,
  p_pin text,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  v_event_id := control_auth(p_slug, p_pin);
  if v_event_id is null then
    raise exception 'PIN invalide';
  end if;

  update screen_state set
    mode = coalesce((p_patch->>'mode')::screen_mode, mode),
    intro_slide_index = coalesce((p_patch->>'intro_slide_index')::int, intro_slide_index),
    main_content_id = case
      when p_patch ? 'main_content_id' then (p_patch->>'main_content_id')::uuid
      else main_content_id end,
    overlay = case
      when p_patch ? 'overlay' then p_patch->'overlay'
      else overlay end,
    speakers_banner_visible = coalesce((p_patch->>'speakers_banner_visible')::boolean, speakers_banner_visible),
    qr_visible = coalesce((p_patch->>'qr_visible')::boolean, qr_visible),
    updated_at = now()
  where event_id = v_event_id;
end;
$$;

-- Soumission d'une question par l'audience (QR code). Jamais affichée
-- automatiquement : status 'pending' jusqu'à validation régie.
create or replace function submit_question(
  p_slug text,
  p_text text,
  p_author_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_id uuid;
begin
  select id into v_event_id from events where slug = p_slug;
  if v_event_id is null then
    raise exception 'Événement inconnu';
  end if;
  if length(trim(p_text)) = 0 or length(p_text) > 300 then
    raise exception 'Question invalide (1 à 300 caractères)';
  end if;

  insert into questions (event_id, text, source, status, author_name)
  values (v_event_id, trim(p_text), 'audience', 'pending', nullif(trim(p_author_name), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Vote audience sur un sondage/vote en cours. Anti double-vote par fingerprint.
create or replace function cast_vote(
  p_poll_id uuid,
  p_option_id text,
  p_fingerprint text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poll polls%rowtype;
begin
  select * into v_poll from polls where id = p_poll_id;
  if v_poll.id is null then
    raise exception 'Sondage inconnu';
  end if;
  if v_poll.status <> 'live' then
    raise exception 'Le vote est fermé';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_poll.options) o
    where o->>'id' = p_option_id
  ) then
    raise exception 'Option inconnue';
  end if;

  insert into poll_votes (poll_id, option_id, voter_fingerprint)
  values (p_poll_id, p_option_id, p_fingerprint)
  on conflict (poll_id, voter_fingerprint) do nothing;
end;
$$;

-- Mutations régie sur les entités live (questions, sondages) — PIN obligatoire.
create or replace function control_update_question_status(
  p_slug text, p_pin text, p_question_id uuid, p_status question_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  v_event_id := control_auth(p_slug, p_pin);
  if v_event_id is null then raise exception 'PIN invalide'; end if;
  update questions set status = p_status
  where id = p_question_id and event_id = v_event_id;
end;
$$;

create or replace function control_set_poll_status(
  p_slug text, p_pin text, p_poll_id uuid, p_status poll_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  v_event_id := control_auth(p_slug, p_pin);
  if v_event_id is null then raise exception 'PIN invalide'; end if;
  update polls set status = p_status
  where id = p_poll_id and event_id = v_event_id;
end;
$$;

-- Sondage/vote créé à la volée depuis l'IR (PRD 5.4.7 « créés en live »).
create or replace function control_create_poll(
  p_slug text, p_pin text, p_kind poll_kind, p_question text, p_options jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_id uuid;
begin
  v_event_id := control_auth(p_slug, p_pin);
  if v_event_id is null then raise exception 'PIN invalide'; end if;
  insert into polls (event_id, kind, question, options, status, created_live)
  values (v_event_id, p_kind, p_question, p_options, 'draft', true)
  returning id into v_id;
  return v_id;
end;
$$;

-- Notes de l'animateur, sauvegardées en continu depuis l'IR.
create or replace function control_save_notes(
  p_slug text, p_pin text, p_content_md text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  v_event_id := control_auth(p_slug, p_pin);
  if v_event_id is null then raise exception 'PIN invalide'; end if;
  insert into notes (event_id, content_md, updated_at)
  values (v_event_id, p_content_md, now())
  on conflict (event_id) do update
  set content_md = excluded.content_md, updated_at = now();
end;
$$;

-- L'EP valide son token d'association (URL /screen/:slug?k=...).
create or replace function screen_auth(p_slug text, p_token text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from events where slug = p_slug and screen_token = p_token;
$$;

-- ─────────────────────── Realtime ───────────────────────
-- Tables émettant des changements vers les clients (EP, IR).

alter publication supabase_realtime add table screen_state;
alter publication supabase_realtime add table polls;
alter publication supabase_realtime add table poll_votes;
alter publication supabase_realtime add table questions;

-- Une ligne screen_state est créée automatiquement avec chaque événement.
create or replace function create_screen_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into screen_state (event_id) values (new.id);
  insert into notes (event_id) values (new.id);
  return new;
end;
$$;

create trigger on_event_created
  after insert on events
  for each row execute function create_screen_state();
