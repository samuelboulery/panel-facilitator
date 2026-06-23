-- Restaure les privilèges baseline du role `service_role` sur le schéma public.
-- Absents dans cette stack (seul anon/authenticated avaient des GRANT), ce qui
-- faisait échouer en 42501 tout client service_role en accès table direct.
-- Premier cas concret : l'Edge Function `define-term` (count rate-limit + insert
-- de la définition) — les autres mutations passent par des RPC SECURITY DEFINER
-- et n'étaient donc pas affectées. service_role bypasse la RLS : seuls les GRANT
-- table manquaient.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all routines in schema public to service_role;

-- Tables/séquences créées par de futures migrations héritent des mêmes droits.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on routines to service_role;
