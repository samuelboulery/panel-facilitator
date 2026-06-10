-- Épinglage des questions depuis l'IR (maquettes : badge « Pin » bleu).
-- Même modèle d'auth que les autres mutations régie : PIN vérifié par RPC.

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
  update questions set pinned = p_pinned
  where id = p_question_id and event_id = v_event_id;
end;
$$;
