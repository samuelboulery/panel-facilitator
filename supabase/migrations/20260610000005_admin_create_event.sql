-- Création d'événement depuis le backoffice. pin_hash est not null :
-- PIN provisoire « 0000 », à changer immédiatement via admin_set_pin.

create or replace function admin_create_event(p_slug text, p_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;
  insert into events (slug, title, pin_hash)
  values (p_slug, p_title, extensions.crypt('0000', extensions.gen_salt('bf')))
  returning id into v_id;
  return v_id;
end;
$$;
