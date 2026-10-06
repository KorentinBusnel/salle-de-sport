# salle-de-sport

Plateforme de gestion de salle de sport (CrossFit · Hyrox · Renfo · Run) : app mobile adhérent,
back office et Hub 360°. Le cahier des charges est dans [BRIEF.md](BRIEF.md).

## Démarrer en local

```sh
pnpm install
pnpm docker:start   # sessions cloud : le daemon Docker n'est pas lancé d'office
pnpm db:start       # Supabase local (migrations + données de démo)
pnpm db:reset       # repartir d'une base propre
pnpm db:test        # tests RLS (pgTAP)
```

## Comptes de démo

Créés par `supabase/seed.sql`, mot de passe commun `demo1234` (base locale et projet Supabase de
dev en ligne ; données fictives uniquement).

| Compte                                    | Rôle                              |
| ----------------------------------------- | --------------------------------- |
| `gerant@demo.local`                       | gérant                            |
| `admin@demo.local`                        | admin                             |
| `accueil@demo.local`                      | accueil                           |
| `coach1@demo.local` … `coach6@demo.local` | coachs                            |
| `adherent@demo.local`                     | adhérent avec abonnement illimité |

## Tester sur iPhone (Expo Go)

Pas besoin de compte Apple : l'app est publiée avec **EAS Update** (channel `preview`) et lit le
projet Supabase **de dev** en ligne (`https://yxxbflwosragyfwbdrix.supabase.co`).

1. Installer **Expo Go** depuis l'App Store (version compatible avec le **SDK 57**).
2. Scanner ce QR code avec l'appareil photo de l'iPhone, puis ouvrir dans Expo Go :
   <https://qr.expo.dev/eas-update?projectId=988f49db-e539-432d-87df-5e81a5e6770e&runtimeVersion=exposdk:57.0.0&channel=preview>
   — ou ouvrir directement le lien
   `exp://u.expo.dev/988f49db-e539-432d-87df-5e81a5e6770e?runtime-version=exposdk%3A57.0.0&channel-name=preview`.
3. Se connecter avec `adherent@demo.local` / `demo1234` (abonnement illimité, peut réserver), ou
   créer un compte : la fiche reste « en attente d'activation » jusqu'à ce que l'accueil l'active
   dans le back office (et, sans abonnement, que le gérant ajoute des crédits).

Republier après une modification (depuis `apps/mobile`, avec `EXPO_TOKEN` défini) :

```sh
npx eas-cli@latest update --branch preview --environment preview --platform all \
  --message "Ce qui change" --non-interactive
```

- `runtimeVersion` utilise la policy `sdkVersion` (→ `exposdk:57.0.0`) : c'est le seul runtime
  qu'Expo Go accepte. Changer de SDK impose de republier (et de mettre à jour Expo Go).
- `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` sont des variables EAS de
  l'environnement `preview` (valeurs publiques), injectées au moment de la publication.
- Seules les bibliothèques incluses dans Expo Go sont utilisables ; un module natif
  supplémentaire nécessitera un build de développement (compte Apple Developer).
- Le schéma du projet de dev se met à jour avec `pnpm exec supabase db push` une fois le projet
  lié (`supabase link`) — la connexion Postgres directe doit alors être autorisée par le réseau.

## Brancher Stripe (mode test)

Tout le code est prêt et testé contre `stripe-mock` ; il ne manque que les clés. Aucune clé Stripe
ne va dans le dépôt ni dans les apps (seule la clé **publiable** `pk_test_…` est publique).

1. Dans le tableau de bord Stripe (mode test), récupérer la clé secrète `sk_test_…` et la clé
   publiable `pk_test_…`.
2. Déployer les fonctions sur le projet de dev : `pnpm exec supabase functions deploy billing` et
   `pnpm exec supabase functions deploy stripe-webhook --no-verify-jwt`.
3. Créer un **webhook** Stripe vers `https://<projet>.supabase.co/functions/v1/stripe-webhook`,
   événements : `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`,
   `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`.
4. Enregistrer les secrets des fonctions :
   `pnpm exec supabase secrets set STRIPE_SECRET_KEY=… STRIPE_WEBHOOK_SECRET=…` (le `whsec_…`
   du webhook).
5. Ajouter `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` aux variables EAS de l'environnement `preview`,
   puis republier l'app : les boutons « Acheter » et « S'abonner » apparaissent.
6. Dans le back office, Paramètres › Offres : « Synchroniser avec Stripe » sur chaque offre (fait
   aussi au premier achat).

## Landing de lancement (kettl.ai)

Page publique `apps/landing` (cahier des charges : [LANDING_BRIEF.md](LANDING_BRIEF.md)).

```sh
pnpm --filter @salle/landing dev          # http://localhost:3001
pnpm --filter @salle/landing build && pnpm --filter @salle/landing check:html
```

En local, l'inscription écrit dans Supabase local si `SUPABASE_URL=http://127.0.0.1:54321` et
`SUPABASE_SERVICE_ROLE_KEY` (de `supabase status`) sont définies ; sans Resend, aucun email ne
part (avertissement dans les logs).

Mise en ligne :

1. **Supabase de production** : créer le projet (région UE, Paris de préférence), y appliquer
   toutes les migrations **sans seed** (API Management, comme pour le projet de dev ; renseigner
   `SUPABASE_PROD_PROJECT_REF` dans la session cloud).
2. **Vercel** : nouveau projet sur le dépôt, Root Directory `apps/landing`, domaine `kettl.ai`
   (plan Pro : usage commercial et événements de Web Analytics). Variables (Production) :
   `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` du projet de production (cette dernière en
   « Sensitive »), `RESEND_API_KEY`, `RESEND_FROM` (ex. `Kettl <bonjour@kettl.ai>`), et au besoin
   `NEXT_PUBLIC_SITE_URL`. Activer Web Analytics dans le projet.
3. **Resend** : vérifier le domaine `kettl.ai` (enregistrements DNS).
4. **Contenu** : compléter `apps/landing/content/legal.ts` (le build de production échoue tant
   qu'il reste un « À COMPLÉTER ») et remplacer la photo provisoire
   `apps/landing/assets/hero-provisoire.webp` par une photo HD sous licence, sans marque visible.
5. **Après déploiement** : Search Console et Bing Webmaster Tools (vérification par DNS, envoi de
   `https://kettl.ai/sitemap.xml`), test des résultats enrichis et validateur Schema.org,
   PageSpeed Insights (mobile et desktop), puis une vraie inscription (ligne en base, email reçu).
