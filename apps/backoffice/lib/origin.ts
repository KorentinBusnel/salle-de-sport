import "server-only";
import { headers } from "next/headers";

/**
 * Origine du back office telle que le navigateur l'a demandée (derrière le proxy de Vercel :
 * `x-forwarded-*`) : adresse de retour après Stripe Checkout.
 */
export async function appOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = list.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}
