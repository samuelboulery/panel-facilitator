-- Profil de branding « actif » par événement : l'EP applique celui-ci (et non
-- plus le premier par défaut). FK nullable, mise à null si le profil est supprimé.
alter table events
  add column branding_profile_id uuid references branding_profiles(id) on delete set null;

-- La vue publique doit exposer la colonne pour que l'EP (anon) la lise.
drop view events_public;
create view events_public with (security_invoker = off) as
  select id, slug, title, subtitle, edition, event_date, start_at,
         closing_message, asso_slide_enabled, asso_content, qr_url,
         sponsor_scroll_speed, branding_profile_id
  from events;
grant select on events_public to anon;
