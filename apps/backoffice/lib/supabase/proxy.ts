import { createServerClient } from "@supabase/ssr";
import type { Database } from "@salle/supabase";
import { type NextRequest, NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/login"];

/**
 * Rafraîchit la session Supabase à chaque navigation et redirige vers /login
 * les visiteurs non connectés.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  // Ne rien exécuter entre la création du client et getClaims() : c'est cet appel
  // qui vérifie le jeton et le renouvelle si besoin.
  const { data, error } = await supabase.auth.getClaims();
  const isPublic = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Cookie de session présent mais refusé : on l'indique au lieu d'un retour muet à /login.
    if (request.cookies.getAll().some(({ name }) => name.startsWith("sb-"))) {
      console.error("Session Supabase refusée", error?.name, error?.message);
      url.searchParams.set("motif", "session");
    }
    return NextResponse.redirect(url);
  }

  // Déjà connecté : la page de connexion renvoie à l'accueil (sauf motif à afficher).
  if (
    data?.claims &&
    request.nextUrl.pathname === "/login" &&
    !request.nextUrl.searchParams.has("motif")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
