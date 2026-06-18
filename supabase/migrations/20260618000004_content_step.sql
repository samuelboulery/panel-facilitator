-- Slide interne du contenu dynamique (deck Google Slides) pilotée depuis l'IR.
-- L'EP traduit content_step en URL /embed positionnée (cf. src/shared/embed.ts) ;
-- seul canal régie→EP = screen_state, donc l'index vit ici.
alter table screen_state add column content_step int not null default 0;

-- update_screen_state : prise en charge de content_step (recopie du corps de
-- 20260611000006 + nouvelle colonne).
create or replace function update_screen_state(
  p_slug text,
  p_pin text,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  v_event_id := control_auth(p_slug, p_pin);
  if v_event_id is null then
    raise exception 'PIN invalide';
  end if;

  update screen_state set
    mode = coalesce((p_patch->>'mode')::screen_mode, mode),
    intro_slide_index = coalesce((p_patch->>'intro_slide_index')::int, intro_slide_index),
    main_content_id = case
      when p_patch ? 'main_content_id' then (p_patch->>'main_content_id')::uuid
      else main_content_id end,
    content_step = coalesce((p_patch->>'content_step')::int, content_step),
    overlay = case
      when p_patch ? 'overlay' then p_patch->'overlay'
      else overlay end,
    speakers_banner_visible = coalesce((p_patch->>'speakers_banner_visible')::boolean, speakers_banner_visible),
    qr_visible = coalesce((p_patch->>'qr_visible')::boolean, qr_visible),
    timer_started_at = case
      when p_patch ? 'timer_started_at' then (p_patch->>'timer_started_at')::timestamptz
      else timer_started_at end,
    updated_at = now()
  where event_id = v_event_id;
end;
$$;
