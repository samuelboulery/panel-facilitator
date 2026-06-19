-- Grants manquants : les policies RLS existent mais le rôle authenticated
-- n'avait pas de GRANT au niveau table → "permission denied for table events".
-- anon reçoit SELECT sur les tables exposées aux surfaces publiques (EP, IR, audience).

grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on table events      to authenticated;
grant select, insert, update, delete on table speakers    to authenticated;
grant select, insert, update, delete on table sponsors    to authenticated;
grant select, insert, update, delete on table contents    to authenticated;
grant select, insert, update, delete on table definitions to authenticated;
grant select, insert, update, delete on table questions   to authenticated;
grant select, insert, update, delete on table polls       to authenticated;
grant select, insert, update, delete on table poll_votes  to authenticated;
grant select, insert, update, delete on table notes       to authenticated;
grant select, insert, update, delete on table screen_state to authenticated;

grant select on events_public to anon;

-- RLS : anon peut lire events via la vue events_public (colonnes sensibles
-- pin_hash/screen_token non exposées car pas de GRANT SELECT sur events à anon).
create policy anon_read_events on events for select to anon using (true);
grant select on table speakers     to anon;
grant select on table sponsors     to anon;
grant select on table contents     to anon;
grant select on table definitions  to anon;
grant select on table questions    to anon;
grant select on table polls        to anon;
grant select on table poll_votes   to anon;
grant select on table notes        to anon;
grant select on table screen_state to anon;
