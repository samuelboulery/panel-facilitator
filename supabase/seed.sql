-- Seed de démo — événement « demo », PIN 1234.
-- Données inspirées des maquettes IR (définitions IA, sondage « IA vs Humain »…).

insert into events (slug, title, subtitle, edition, event_date, start_at,
                    closing_message, asso_slide_enabled, qr_url, pin_hash, screen_token)
values (
  'demo',
  'L''IA va-t-elle remplacer les designers ?',
  'Table ronde design',
  'Édition 2026',
  current_date,
  now() + interval '30 minutes',
  'Merci à tous et à nos sponsors !',
  false,
  'http://localhost:5173/q/demo',
  extensions.crypt('1234', extensions.gen_salt('bf')),
  'demo-screen-token-dev-only'
);

with e as (select id from events where slug = 'demo')
insert into speakers (event_id, first_name, last_name, title, company, bio, is_host, sort_order)
select e.id, s.* from e, (values
  ('Camille', 'Durand', 'Animatrice', 'Design Collective', 'Anime des tables rondes design depuis 2019.', true, 0),
  ('Hugo', 'Martin', 'Lead Product Designer', 'Studio Nord', 'Spécialiste des design systems.', false, 1),
  ('Vincent', 'Lopez', 'Directeur Artistique', 'Agence Pixel', '15 ans de direction artistique.', false, 2),
  ('Léa', 'Bernard', 'UX Researcher', 'LabUX', 'Recherche utilisateur et IA générative.', false, 3)
) as s(first_name, last_name, title, company, bio, is_host, sort_order);

with e as (select id from events where slug = 'demo')
insert into sponsors (event_id, name, logo_url, sort_order)
select e.id, s.* from e, (values
  ('Figma', 'https://placehold.co/200x80?text=Figma', 0),
  ('Supabase', 'https://placehold.co/200x80?text=Supabase', 1),
  ('Vercel', 'https://placehold.co/200x80?text=Vercel', 2)
) as s(name, logo_url, sort_order);

with e as (select id from events where slug = 'demo')
insert into definitions (event_id, term, definition, sort_order)
select e.id, d.* from e, (values
  ('LLM', 'Large Language Model — modèle de langage entraîné sur de vastes corpus de texte.', 0),
  ('MCP', 'Model Context Protocol — protocole standardisant la connexion entre modèles et outils.', 1),
  ('Token', 'Unité élémentaire de texte traitée par un modèle de langage.', 2),
  ('Fine-tuning', 'Spécialisation d''un modèle pré-entraîné sur un jeu de données ciblé.', 3),
  ('Hallucination', 'Production par un modèle d''une information plausible mais fausse.', 4),
  ('RAG', 'Retrieval-Augmented Generation — génération enrichie par recherche documentaire.', 5),
  ('Alignement', 'Conformité du comportement d''un modèle avec les intentions humaines.', 6)
) as d(term, definition, sort_order);

with e as (select id from events where slug = 'demo')
insert into questions (event_id, text, source, status, sort_order)
select e.id, q.* from e, (values
  ('Quel est l''impact réel de l''IA générative sur vos workflows design ?', 'prepared'::question_source, 'pending'::question_status, 0),
  ('Les juniors doivent-ils encore apprendre les fondamentaux ?', 'prepared'::question_source, 'pending'::question_status, 1),
  ('Comment garder une direction artistique singulière à l''ère des modèles ?', 'prepared'::question_source, 'pending'::question_status, 2)
) as q(text, source, status, sort_order);

with e as (select id from events where slug = 'demo')
insert into polls (event_id, kind, question, options, status, sort_order)
select e.id, p.* from e, (values
  ('poll'::poll_kind, 'IA vs Humain : qui designera vos produits en 2030 ?',
   '[{"id":"ia","label":"IA"},{"id":"humain","label":"Humain"},{"id":"duo","label":"Le duo"}]'::jsonb,
   'draft'::poll_status, 0),
  ('poll'::poll_kind, 'RAG vs KAG',
   '[{"id":"rag","label":"RAG"},{"id":"kag","label":"KAG"}]'::jsonb,
   'draft'::poll_status, 1),
  ('versus'::poll_kind, 'Hugo vs Vincent',
   '[{"id":"hugo","label":"Hugo"},{"id":"vincent","label":"Vincent"}]'::jsonb,
   'draft'::poll_status, 2)
) as p(kind, question, options, status, sort_order);
