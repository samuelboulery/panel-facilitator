-- Validation explicite des définitions générées par LLM.
-- La génération insère désormais un brouillon (validated=false) : invisible dans
-- la liste IR tant que la régie n'a pas validé via la modale de revue. Le
-- rate-limit DeepSeek reste adossé aux inserts de `definitions` (cf. define-term).
-- Les lignes existantes (default true) restent visibles.
alter table definitions add column validated boolean not null default true;

-- Validation d'un brouillon : le rend visible dans la liste IR.
create or replace function control_validate_definition(
  p_slug text, p_pin text, p_definition_id uuid
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
  update definitions set validated = true
  where id = p_definition_id and event_id = v_event_id;
end;
$$;

-- Abandon d'un brouillon (« Annuler la définition ») : supprime la ligne.
create or replace function control_delete_definition(
  p_slug text, p_pin text, p_definition_id uuid
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
  delete from definitions
  where id = p_definition_id and event_id = v_event_id;
end;
$$;
