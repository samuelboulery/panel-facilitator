-- Backoffice : stockage des images (photos speakers, logos sponsors) et
-- gestion du PIN de session (hash toujours côté serveur, jamais côté client).

-- Bucket média : lecture publique (l'EP affiche les images), écriture
-- réservée à l'organisateur authentifié.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy media_public_read on storage.objects
  for select using (bucket_id = 'media');

create policy media_auth_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

create policy media_auth_update on storage.objects
  for update to authenticated using (bucket_id = 'media');

create policy media_auth_delete on storage.objects
  for delete to authenticated using (bucket_id = 'media');

-- Mise à jour du PIN par l'organisateur : hash bcrypt côté Postgres.
create or replace function admin_set_pin(p_event_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;
  if p_pin !~ '^\d{4,8}$' then
    raise exception 'PIN invalide (4 à 8 chiffres)';
  end if;
  update events
  set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
  where id = p_event_id;
end;
$$;
