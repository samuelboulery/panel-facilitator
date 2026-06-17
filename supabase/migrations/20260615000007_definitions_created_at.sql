-- Rate-limit define-term : la fonction edge compte les définitions créées dans
-- la dernière minute pour un event afin de plafonner les appels LLM (anti-burn
-- de crédits LLM par un acteur muni d'un PIN valide). Nécessite un
-- horodatage de création sur definitions.
alter table definitions add column created_at timestamptz not null default now();
