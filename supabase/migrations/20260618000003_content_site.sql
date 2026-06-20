-- Nouveau type de contenu dynamique : « site web » (embed_site).
-- Iframe vers toute URL https valide — la whitelist de domaines (embed.ts) ne
-- s'applique qu'aux embeds Google Slides / Figma ; le site est saisi par
-- l'organisateur au backoffice (frontière de confiance = admin, jamais public).
--
-- `alter type … add value` doit vivre seul dans sa migration : la nouvelle
-- valeur d'enum n'est utilisable qu'après commit de la transaction.
alter type content_kind add value if not exists 'embed_site';
