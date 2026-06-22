-- Horodatage d'épinglage pour trier les questions épinglées chronologiquement.
alter table questions add column pinned_at timestamptz;

-- Mise à jour du RPC : stocke l'horodatage au moment du pin, null au unpin.
create or replace function control_set_question_pinned(
  p_slug text, p_pin text, p_question_id uuid, p_pinned boolean
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
  update questions
  set pinned = p_pinned,
      pinned_at = case when p_pinned then now() else null end
  where id = p_question_id and event_id = v_event_id;
end;
$$;
