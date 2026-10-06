import { assert, assertEquals } from "@std/assert";
import Stripe from "stripe";
import { handleBilling } from "../billing/handler.ts";
import { handleWebhook } from "../stripe-webhook/handler.ts";
import { fakeSupabase } from "./fake_supabase.ts";

// stripe-mock (docker run -p 12111:12111 stripe/stripe-mock) : faux Stripe, mêmes réponses que l'API.
const base = Deno.env.get("STRIPE_API_BASE") ?? "http://localhost:12111";
const url = new URL(base);
const stripe = new Stripe("sk_test_123", {
  httpClient: Stripe.createFetchHttpClient(),
  host: url.hostname,
  port: Number(url.port),
  protocol: "http",
});
const crypto = Stripe.createSubtleCryptoProvider();

// Les réponses de stripe-mock sont des gabarits : le secret de confirmation d'une facture y est
// vide. On le complète comme le ferait l'API réelle.
const create = stripe.subscriptions.create.bind(stripe.subscriptions);
stripe.subscriptions.create = (async (...args: Parameters<typeof create>) => {
  const subscription = await create(...args);
  const invoice = subscription.latest_invoice as unknown as {
    confirmation_secret?: { client_secret: string };
  };
  if (invoice?.confirmation_secret) invoice.confirmation_secret.client_secret = "pi_123_secret_456";
  return subscription;
}) as typeof stripe.subscriptions.create;

const context = (type: "recurring" | "pack") => ({
  member: {
    id: "m1",
    gym_id: "g1",
    email: "ana@test.local",
    name: "Ana Abel",
    stripe_customer_id: null,
  },
  plan: {
    id: "p1",
    name: type === "pack" ? "Carnet 10" : "Illimité",
    type,
    price_cents: type === "pack" ? 18000 : 7900,
    currency: "eur",
    billing_interval: type === "pack" ? null : "month",
    credits: type === "pack" ? 10 : null,
    stripe_product_id: null,
    stripe_price_id: null,
  },
  final_cents: type === "pack" ? 16000 : 7900,
  promo: null,
});

function post(body: unknown, auth = "Bearer jeton") {
  return new Request("http://localhost/billing", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const deps = (
  user: ReturnType<typeof fakeSupabase>,
  admin: ReturnType<typeof fakeSupabase>,
  now = new Date(),
) => ({
  stripe,
  admin: admin.client,
  user: () => user.client,
  apiVersion: "2025-08-27.basil",
  now: () => now,
});

Deno.test("sans clé Stripe : non configuré, sans erreur", async () => {
  const user = fakeSupabase({ userId: "u1" });
  const response = await handleBilling(post({ action: "cancel" }), {
    ...deps(user, user),
    stripe: null,
  });
  assertEquals(response.status, 503);
  assertEquals((await response.json()).error, "stripe_not_configured");
});

Deno.test("sans jeton : refusé", async () => {
  const user = fakeSupabase({ userId: null });
  const response = await handleBilling(post({ action: "cancel" }), deps(user, user));
  assertEquals(response.status, 401);
});

Deno.test("carnet : paiement immédiat, client créé et gardé sur la fiche", async () => {
  const user = fakeSupabase({
    userId: "u1",
    rpc: { billing_checkout_context: { data: context("pack"), error: null } },
  });
  const admin = fakeSupabase({});
  const response = await handleBilling(
    post({ action: "payment_sheet", planId: "84000000-0000-0000-0000-000000000002" }),
    deps(user, admin),
  );
  assertEquals(response.status, 200);
  const body = await response.json();
  assert(body.clientSecret, "secret de paiement");
  assert("ephemeralKey" in body, "clé éphémère (sans valeur dans stripe-mock)");
  assertEquals(body.amountCents, 16000);
  assertEquals(body.allowsDelayedPaymentMethods, false, "pas de SEPA pour un carnet");
  assertEquals(admin.calls.updates[0]?.table, "members");
});

Deno.test("abonnement : prix créé à la volée, abonnement synchronisé dans la base", async () => {
  const user = fakeSupabase({
    userId: "u1",
    rpc: { billing_checkout_context: { data: context("recurring"), error: null } },
  });
  const admin = fakeSupabase({});
  const response = await handleBilling(
    post({ action: "payment_sheet", planId: "84000000-0000-0000-0000-000000000001" }),
    deps(user, admin),
  );
  assertEquals(response.status, 200);
  assert(
    admin.calls.updates.some((u) => u.table === "plans"),
    "offre liée à son prix Stripe",
  );
  assert(
    admin.calls.rpc.some((c) => c.fn === "sync_stripe_subscription"),
    "miroir immédiat",
  );
});

Deno.test("achat refusé par la base : code métier renvoyé", async () => {
  const user = fakeSupabase({
    userId: "u1",
    rpc: { billing_checkout_context: { data: null, error: { message: "already_subscribed" } } },
  });
  const response = await handleBilling(
    post({ action: "payment_sheet", planId: "84000000-0000-0000-0000-000000000001" }),
    deps(user, user),
  );
  assertEquals(response.status, 400);
  assertEquals((await response.json()).error, "already_subscribed");
});

Deno.test("résiliation : refusée pendant l'engagement, acceptée ensuite", async () => {
  const sub = {
    id: "s1",
    stripe_subscription_id: "sub_123",
    commitment_ends_at: "2027-01-01T00:00:00Z",
  };
  const user = fakeSupabase({ userId: "u1", tables: { subscriptions: sub } });
  const admin = fakeSupabase({});
  const during = await handleBilling(
    post({ action: "cancel" }),
    deps(user, admin, new Date("2026-10-06T10:00:00Z")),
  );
  assertEquals((await during.json()).error, "commitment_running");
  const after = await handleBilling(
    post({ action: "cancel" }),
    deps(user, admin, new Date("2027-02-01T10:00:00Z")),
  );
  assertEquals(after.status, 200);
  assert(admin.calls.rpc.some((c) => c.fn === "sync_stripe_subscription"));
});

Deno.test("synchronisation d'une offre : réservée au gérant", async () => {
  const plan = { ...context("recurring").plan, gym_id: "g1" };
  const member = fakeSupabase({
    userId: "u1",
    tables: { plans: plan, gym_roles: [{ role: "member" }] },
  });
  const refused = await handleBilling(
    post({ action: "sync_plan", planId: "84000000-0000-0000-0000-000000000001" }),
    deps(member, member),
  );
  assertEquals(refused.status, 403);
  const manager = fakeSupabase({
    userId: "u2",
    tables: { plans: plan, gym_roles: [{ role: "manager" }] },
  });
  const admin = fakeSupabase({});
  const ok = await handleBilling(
    post({ action: "sync_plan", planId: "84000000-0000-0000-0000-000000000001" }),
    deps(manager, admin),
  );
  assertEquals(ok.status, 200);
  assertEquals(admin.calls.updates[0]?.table, "plans");
});

Deno.test("webhook : signature exigée, événement transmis à la base", async () => {
  const secret = "whsec_test";
  const admin = fakeSupabase({ rpc: { apply_stripe_event: { data: "pack", error: null } } });
  const payload = JSON.stringify({
    id: "evt_1",
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_1", payment_method_types: ["card"], metadata: { kind: "pack" } } },
  });
  const bad = await handleWebhook(
    new Request("http://localhost/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=faux" },
      body: payload,
    }),
    { stripe, admin: admin.client, secret },
  );
  assertEquals(bad.status, 400);
  const signature = await stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
    cryptoProvider: crypto,
  });
  const good = await handleWebhook(
    new Request("http://localhost/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: payload,
    }),
    { stripe, admin: admin.client, secret },
  );
  assertEquals(good.status, 200);
  const call = admin.calls.rpc[0];
  assertEquals(call?.fn, "apply_stripe_event");
  assertEquals((call?.args as { p_method: string }).p_method, "card");
});

Deno.test("webhook : erreur de la base → 500 (Stripe renverra l'événement)", async () => {
  const secret = "whsec_test";
  const admin = fakeSupabase({
    rpc: { apply_stripe_event: { data: null, error: { message: "boom" } } },
  });
  const payload = JSON.stringify({
    id: "evt_2",
    type: "invoice.paid",
    data: { object: { id: "in_1" } },
  });
  const signature = await stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
    cryptoProvider: crypto,
  });
  const response = await handleWebhook(
    new Request("http://localhost/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: payload,
    }),
    { stripe, admin: admin.client, secret },
  );
  assertEquals(response.status, 500);
});
