// Architecture : génération de définition courte par LLM (DeepSeek deepseek-chat).
// Modèle non-raisonnant volontaire : un modèle « reasoning » consomme tout le
// budget de tokens en reasoning_content et renvoie un content vide → 502.
// Edge Function = seule détentrice de DEEPSEEK_API_KEY — jamais côté client.
// Auth : PIN de session vérifié via control_auth avant tout appel modèle.
// API DeepSeek = format OpenAI-compatible → simple fetch, pas de SDK.
import { createClient } from "npm:@supabase/supabase-js@2";

const SYSTEM_PROMPT =
  "Tu écris des définitions courtes pour l'écran d'une table ronde design devant une audience de designers et de curieux. " +
  "Réponds UNIQUEMENT par la définition : 1 à 2 phrases, claires, accessibles, sans jargon inutile, en français. " +
  "Pas de préambule, pas de répétition du terme en tête de phrase.";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let payload: { slug?: string; pin?: string; term?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corps JSON invalide" }, 400);
  }

  const { slug, pin, term } = payload;
  if (!slug || !term?.trim() || term.length > 60) {
    return json({ error: "Paramètres invalides (slug, term ≤ 60 car.)" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Deux chemins d'auth pour la même génération :
  //  - IR (anon) : PIN de session vérifié en base, comme toutes les mutations live.
  //  - Backoffice : JWT organisateur (verify_jwt=false au gateway → vérifié ici).
  let eventId: string | null = null;
  if (pin) {
    const { data, error: authError } = await supabase.rpc("control_auth", {
      p_slug: slug,
      p_pin: pin,
    });
    if (!authError) eventId = (data as string | null) ?? null;
  } else {
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const authed = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await authed.auth.getUser();
      if (user) {
        const { data: ev } = await supabase
          .from("events")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        eventId = (ev as { id: string } | null)?.id ?? null;
      }
    }
  }
  if (!eventId) {
    return json({ error: "Authentification refusée" }, 401);
  }

  // Rate-limit : plafonne les générations LLM par event (un PIN valide ne doit
  // pas pouvoir brûler des crédits DeepSeek en boucle). 10 définitions / minute.
  const RATE_LIMIT = 10;
  const { count, error: countError } = await supabase
    .from("definitions")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if (countError) {
    console.error("[define-term] comptage rate-limit échoué :", countError);
    return json({ error: "Service indisponible" }, 503);
  }
  if ((count ?? 0) >= RATE_LIMIT) {
    return json({ error: "Trop de définitions générées — patientez une minute" }, 429);
  }

  let definition: string;
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("DEEPSEEK_API_KEY")!}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 300,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Définis : ${term.trim()}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const data = await res.json();
    definition = (data?.choices?.[0]?.message?.content ?? "").trim();
    if (!definition) throw new Error("Réponse vide");
  } catch (err) {
    console.error("[define-term] appel DeepSeek échoué :", err);
    return json({ error: "Génération impossible — réessayer" }, 502);
  }

  const { data: maxRow } = await supabase
    .from("definitions")
    .select("sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: inserted, error: insertError } = await supabase
    .from("definitions")
    .insert({
      event_id: eventId,
      term: term.trim(),
      definition,
      sort_order: ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[define-term] insertion échouée :", insertError);
    return json({ error: "Enregistrement impossible" }, 500);
  }

  return json({ definition: inserted });
});
