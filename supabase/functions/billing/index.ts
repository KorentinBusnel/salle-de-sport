import { createStripe } from "../_shared/stripe.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";
import { handleBilling } from "./handler.ts";

Deno.serve((request) =>
  handleBilling(request, {
    stripe: createStripe(),
    admin: adminClient(),
    user: userClient,
    apiVersion: "2025-08-27.basil",
    now: () => new Date(),
  }),
);
