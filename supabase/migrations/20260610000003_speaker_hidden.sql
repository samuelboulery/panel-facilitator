-- Masquage d'un speaker depuis l'IR sans backoffice (PRD 5.3.4 — désistement).
-- La table speakers rejoint la publication realtime : l'EP recalcule la
-- séquence intro et les bandeaux en live.

create or replace function control_set_speaker_hidden(
  p_slug text, p_pin text, p_speaker_id uuid, p_hidden boolean
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
  update speakers set hidden = p_hidden
  where id = p_speaker_id and event_id = v_event_id;
end;
$$;

alter publication supabase_realtime add table speakers;
