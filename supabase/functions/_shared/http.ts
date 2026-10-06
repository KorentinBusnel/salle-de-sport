/** Réponses JSON des Edge Functions (CORS ouvert : l'app mobile et le back office les appellent). */
export const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

/** Erreur métier : un code traduit par chaque app (BOOKING_ERROR_CODES). */
export function fail(error: string, status = 400): Response {
  return json({ error }, status);
}
