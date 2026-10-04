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
