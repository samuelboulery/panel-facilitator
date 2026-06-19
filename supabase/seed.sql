-- Seed de démo — événement « demo », PIN 1234.
-- Snapshot de la DB locale (event « demo ») — régénéré le 2026-06-17.
-- Logos sponsors servis depuis public/demo-sponsors/ (root-relative) : committés
-- dans le repo, survivent à db reset et à un setup neuf, aucun upload storage requis.

insert into events (slug, title, subtitle, edition, event_date, start_at,
                    closing_message, asso_slide_enabled, qr_url, sponsor_scroll_speed, pin_hash, screen_token)
values (
  'demo',
  'L''IA va-t-elle remplacer les designers ?',
  'Table ronde design',
  'Édition 2026',
  current_date,
  now() + interval '30 minutes',
  'Merci à tous et à nos sponsors !',
  true,
  'http://localhost:5173/q/demo',
  60,
  extensions.crypt('1234', extensions.gen_salt('bf')),
  'demo-screen-token-dev-only'
);

with e as (select id from events where slug = 'demo')
insert into speakers (event_id, first_name, last_name, title, company, bio, is_host, gender, sort_order)
select e.id, s.* from e, (values
  ('Samuel', 'Boulery', 'System Designer & Référent IA', 'CBTW', 'Designer spécialisé en Design System en mission dans l''équipe Design System EDF et Référent IA pour les consultants Design CBTW', true, 'm'::gender_kind, 0),
  ('Victor', 'Storti', 'Head of UX Photoweb & Co-Founder Detach Instance', ' ex-Veepee / Bellecour / Photoweb / Detach Instance', 'Head of UX chez Photoweb, co-fondateur de Detach Instance et ex Principal UX/UI chez Veepee. J''explore les liens entre design, IA, produit et nouvelles méthodologies pour aider les équipes à concevoir des produits plus clairs, plus cohérents et plus impactants.', false, 'm'::gender_kind, 1),
  ('Camille', 'Ala', 'Senior Product Designer & AI Tech Lead', 'Devoteam', '', false, null::gender_kind, 2),
  ('Hugo', 'Douchet', 'Conseiller Stratégique Design System', 'Eat My Mind', '', false, 'm'::gender_kind, 3),
  ('Vincent', 'Perrier-Perrery', 'Responsable UX', 'Framatome', '', false, 'm'::gender_kind, 4)
) as s(first_name, last_name, title, company, bio, is_host, gender, sort_order);

with e as (select id from events where slug = 'demo')
insert into sponsors (event_id, name, logo_url, sort_order)
select e.id, s.* from e, (values
  ('CBTW', '/demo-sponsors/cbtw.webp', 0),
  ('Bellecour école', '/demo-sponsors/bellecour.webp', 1),
  ('Detach Instance', '/demo-sponsors/detach-instance.webp', 2)
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
  ('Alignement', 'Conformité du comportement d''un modèle avec les intentions humaines.', 6),
  ('skeuomorphisme', 'Le skeuomorphisme consiste à intégrer des éléments visuels ou fonctionnels d’un objet physique dans une interface numérique, comme un agenda qui imite la texture du cuir ou une icône de corbeille qui ressemble à une vraie poubelle.', 7),
  ('Design Token', 'Unité de valeur visuelle standardisée (couleur, typographie, espacement) servant de source unique et cohérente pour les décisions de design, facilitant la collaboration entre designers et développeurs.', 8)
) as d(term, definition, sort_order);

with e as (select id from events where slug = 'demo')
insert into questions (event_id, text, source, status, sort_order)
select e.id, q.* from e, (values
  ('Les juniors doivent-ils encore apprendre les fondamentaux ?', 'prepared'::question_source, 'pending'::question_status, 1),
  ('Comment garder une direction artistique singulière à l''ère des modèles ?', 'prepared'::question_source, 'pending'::question_status, 2),
  ('Question créée depuis IR ?', 'prepared'::question_source, 'pending'::question_status, 3),
  ('Quel est l''impact réel de l''IA générative sur vos workflows design ?', 'prepared'::question_source, 'pending'::question_status, 4)
) as q(text, source, status, sort_order);

with e as (select id from events where slug = 'demo')
insert into polls (event_id, kind, question, options, status, sort_order)
select e.id, p.* from e, (values
  ('poll'::poll_kind, 'RAG vs KAG',
   '[{"id":"rag","label":"RAG"},{"id":"kag","label":"KAG"}]'::jsonb,
   'draft'::poll_status, 0),
  ('poll'::poll_kind, 'IA vs Humain : qui designera vos produits en 2030 ?',
   '[{"id":"ia","label":"IA"},{"id":"humain","label":"Humain"},{"id":"duo","label":"Le duo"}]'::jsonb,
   'draft'::poll_status, 1),
  ('versus'::poll_kind, 'Pomme de terre vs Patate',
   '[{"id":"hugo","label":"Pomme de terre"},{"id":"vincent","label":"Patate"}]'::jsonb,
   'draft'::poll_status, 2)
) as p(kind, question, options, status, sort_order);
