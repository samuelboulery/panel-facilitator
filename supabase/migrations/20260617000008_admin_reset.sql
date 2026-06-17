-- Réinitialisation d'une table ronde depuis le backoffice : remet l'état « déjà
-- lancé à l'écran » à zéro sans toucher au contenu configuré (définitions,
-- sondages, questions préparées restent). Global ou par section.
-- Auth : organisateur authentifié (même garde que admin_set_pin). SECURITY DEFINER
-- car le reset touche plusieurs tables de façon atomique (un seul appel).

create or replace function admin_reset_round(
  p_event_id uuid,
  p_scope text,
  p_delete_audience boolean default false,
  p_delete_adhoc boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;
  if p_scope not in ('all', 'definitions', 'questions', 'polls', 'votes') then
    raise exception 'Scope invalide : %', p_scope;
  end if;

  -- Définitions : repassent « disponibles » dans la régie.
  if p_scope in ('all', 'definitions') then
    update definitions set used = false where event_id = p_event_id and used;
  end if;

  -- Questions : préparées repassées en attente ; publiques supprimées (option) ou
  -- elles aussi remises en attente.
  if p_scope in ('all', 'questions') then
    if p_delete_audience then
      delete from questions where event_id = p_event_id and source = 'audience';
    end if;
    update questions
    set status = 'pending', pinned = false
    where event_id = p_event_id and (status <> 'pending' or pinned);
  end if;

  -- Sondages (kind='poll') : ad-hoc supprimés (option, cascade sur poll_votes),
  -- configurés repassés en brouillon, votes effacés.
  if p_scope in ('all', 'polls') then
    if p_delete_adhoc then
      delete from polls where event_id = p_event_id and kind = 'poll' and created_live;
    end if;
    delete from poll_votes
    where poll_id in (select id from polls where event_id = p_event_id and kind = 'poll');
    update polls set status = 'draft' where event_id = p_event_id and kind = 'poll';
  end if;

  -- Votes versus (kind='versus') : même logique.
  if p_scope in ('all', 'votes') then
    if p_delete_adhoc then
      delete from polls where event_id = p_event_id and kind = 'versus' and created_live;
    end if;
    delete from poll_votes
    where poll_id in (select id from polls where event_id = p_event_id and kind = 'versus');
    update polls set status = 'draft' where event_id = p_event_id and kind = 'versus';
  end if;

  -- Écran (reset global) : ferme l'overlay live et stoppe le timer. L'EP réagit via
  -- postgres_changes sur screen_state.
  if p_scope = 'all' then
    update screen_state
    set overlay = null, timer_started_at = null, updated_at = now()
    where event_id = p_event_id;
  end if;
end;
$$;
