import { createStripe } from "../_shared/stripe.ts";
import { adminClient } from "../_shared/supabase.ts";
import { handleWebhook } from "./handler.ts";

// Appelé par Stripe, sans jeton Supabase (verify_jwt = false dans config.toml) : la signature
// du webhook fait foi.
Deno.serve((request) =>
  handleWebhook(request, {
    stripe: createStripe(),
    admin: adminClient(),
    secret: Deno.env.get("STRIPE_WEBHOOK_SECRET"),
  }),
);
