-- L'EP (rôle anon, accès par token d'URL) doit lire le branding pour appliquer
-- la palette et l'image de fond. Lecture seule, données non sensibles (couleurs).
create policy anon_read_branding_profiles on branding_profiles for select to anon using (true);
grant select on table branding_profiles to anon;
