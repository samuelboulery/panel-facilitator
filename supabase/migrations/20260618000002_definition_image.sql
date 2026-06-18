-- Image optionnelle par définition (uploadée côté backoffice uniquement).
-- Affichée sur l'EP dans l'overlay définition quand renseignée.
alter table definitions add column image_url text;
