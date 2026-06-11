// Architecture : génération de définition courte par LLM (Claude Haiku 4.5).
// Edge Function = seule détentrice de ANTHROPIC_API_KEY — jamais côté client.
// Auth : PIN de session vérifié via control_auth avant tout appel modèle.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

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
  if (!slug || !pin || !term?.trim() || term.length > 60) {
    return json({ error: "Paramètres invalides (slug, pin, term ≤ 60 car.)" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth régie : même mécanisme que toutes les mutations live.
  const { data: eventId, error: authError } = await supabase.rpc("control_auth", {
    p_slug: slug,
    p_pin: pin,
  });
  if (authError || !eventId) {
    return json({ error: "PIN invalide" }, 401);
  }

  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

  let definition: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      system:
        "Tu écris des définitions courtes pour l'écran d'une table ronde design devant une audience de designers et de curieux. " +
        "Réponds UNIQUEMENT par la définition : 1 à 2 phrases, claires, accessibles, sans jargon inutile, en français. " +
        "Pas de préambule, pas de répétition du terme en tête de phrase.",
      messages: [{ role: "user", content: `Définis : ${term.trim()}` }],
    });
    const block = message.content.find((b) => b.type === "text");
    definition = block?.type === "text" ? block.text.trim() : "";
    if (!definition) throw new Error("Réponse vide");
  } catch (err) {
    console.error("[define-term] appel Anthropic échoué :", err);
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
