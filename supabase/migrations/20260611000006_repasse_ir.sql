-- Repasse IR (feedback utilisateur) :
--   - définitions à usage unique (used) + temps réel + création par RPC
--   - timer de durée manuel (screen_state.timer_started_at)
--   - création de question préparée depuis l'IR
--   - réordonnancement persisté des listes (questions/définitions/polls)

alter table definitions add column used boolean not null default false;
alter table screen_state add column timer_started_at timestamptz;

alter publication supabase_realtime add table definitions;

-- update_screen_state : prise en charge de timer_started_at (nullable explicite).
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
    timer_started_at = case
      when p_patch ? 'timer_started_at' then (p_patch->>'timer_started_at')::timestamptz
      else timer_started_at end,
    updated_at = now()
  where event_id = v_event_id;
end;
$$;

-- Question préparée créée depuis l'IR (bouton « + » de la section Questions).
create or replace function control_create_question(
  p_slug text, p_pin text, p_text text
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
  if length(trim(p_text)) = 0 or length(p_text) > 300 then
    raise exception 'Question invalide (1 à 300 caractères)';
  end if;
  insert into questions (event_id, text, source, status,
    sort_order)
  values (v_event_id, trim(p_text), 'prepared', 'pending',
    coalesce((select max(sort_order) + 1 from questions where event_id = v_event_id), 0))
  returning id into v_id;
  return v_id;
end;
$$;

-- Définition marquée « utilisée » au lancement — affichée une seule fois par événement.
create or replace function control_set_definition_used(
  p_slug text, p_pin text, p_definition_id uuid, p_used boolean
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
  update definitions set used = p_used
  where id = p_definition_id and event_id = v_event_id;
end;
$$;

-- Réordonnancement persisté (drag & drop IR). Whitelist stricte des tables —
-- jamais de SQL dynamique sur un nom de table fourni par le client.
create or replace function control_reorder(
  p_slug text, p_pin text, p_table text, p_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_id uuid;
  v_index int := 0;
begin
  v_event_id := control_auth(p_slug, p_pin);
  if v_event_id is null then raise exception 'PIN invalide'; end if;

  foreach v_id in array p_ids loop
    case p_table
      when 'questions' then
        update questions set sort_order = v_index
        where id = v_id and event_id = v_event_id;
      when 'definitions' then
        update definitions set sort_order = v_index
        where id = v_id and event_id = v_event_id;
      when 'polls' then
        update polls set sort_order = v_index
        where id = v_id and event_id = v_event_id;
      else
        raise exception 'Table non autorisée';
    end case;
    v_index := v_index + 1;
  end loop;
end;
$$;
