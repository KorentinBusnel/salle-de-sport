# CLAUDE.md

Conventions de code et de travail pour ce dépôt. Le cahier des charges est `BRIEF.md`.

## Avant de coder

- Lire `BRIEF.md`, dont le journal des décisions (§12). Toute décision qui change le brief y est
  consignée (une ligne datée), dans le même commit ou juste après.
- Chaque nouvelle phase commence en **plan mode** : plan (fichiers, migrations, tâches) validé
  avant d'écrire du code.
- Ambiguïté métier (délais, pénalités, offres, rôles…) : **poser la question**, ne pas inventer
  de règle. Les questions ouvertes sont listées au §11 du brief.
- Interface et commits en **français**.

## Structure

```
apps/backoffice     Next.js 16 (App Router) + Tailwind v4 + shadcn/ui — équipe de la salle
apps/mobile         Expo SDK 57 + Expo Router + NativeWind 4 — adhérents
packages/shared     règles métier, schémas Zod, dates, i18n — TypeScript pur
packages/supabase   types générés + type du client
packages/ui         tokens de design (tokens.ts) et thème Tailwind v4 (theme.css)
supabase/           migrations, seed.sql, tests pgTAP (tests/database)
scripts/            dev-docker.sh, env-local.sh
```

## Commandes

```sh
pnpm install
pnpm lint | pnpm typecheck | pnpm test | pnpm format:check   # ce que la CI exécute
pnpm build                       # build du back office
pnpm docker:start                # session cloud : Docker n'est pas démarré d'office
pnpm db:start                    # Supabase local : migrations + seed
pnpm db:reset                    # base propre (migrations + seed)
pnpm db:test                     # tests RLS pgTAP
pnpm db:lint                     # lint SQL + advisors, échoue sur un avertissement
pnpm db:types                    # régénère packages/supabase/src/database.types.ts
pnpm env:local                   # écrit les .env.local des deux apps depuis Supabase local
pnpm dev                         # back office + Metro
```

En session cloud, démarrer Supabase sans les services inutiles :
`pnpm exec supabase start -x studio,imgproxy,logflare,vector,supavisor,mailpit`.

## Règles générales

- **TypeScript strict** partout (`tsconfig.base.json` : `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`). TypeScript est épinglé en `~6.0` :
  typescript-eslint ne supporte pas encore TS 7.
- **Imports de type** explicites (`import type`, règle ESLint `consistent-type-imports`).
- **Validation des entrées avec Zod** ; les schémas partagés vivent dans `packages/shared`.
- **Une règle métier est codée une seule fois** : dans `packages/shared` (affichage, validation)
  ou en SQL (tout ce qui touche capacité ou crédits). Jamais dupliquée entre mobile et web.
- **Textes affichés** : toujours via une clé de traduction (`t("planning.title")`), catalogue
  `messages/fr.ts` de chaque app, traducteur `createTranslator` de `packages/shared`.
- **Petits commits thématiques**, une PR par fonctionnalité. Lint, typecheck, tests et format
  doivent passer avant de pousser.

## Packages partagés

- Consommés **en source TypeScript** (pas de build) : `exports` pointe vers `src/index.ts`.
- `packages/shared` doit rester importable par les Edge Functions (**Deno**) : TypeScript pur,
  aucune dépendance Node, imports relatifs **avec l'extension `.ts`** (`./dates.ts`).
- Dates : toujours dans le fuseau de la salle (`gyms.timezone`), via `zonedDayRange` ; les
  journées de 23 h / 25 h (changement d'heure) sont testées.
- Design : `packages/ui/src/tokens.ts` est la source (couleurs en hex : NativeWind refuse
  oklch). `theme.css` (Tailwind v4, back office) le reflète — un test échoue s'ils divergent, un
  autre si un couple de couleurs passe sous le contraste WCAG AA. Le mobile injecte les mêmes
  tokens dans `tailwind.config.ts` (NativeWind 4 = Tailwind v3) sous les mêmes noms. Utiliser les
  **rôles sémantiques** (`bg-primary`, `text-muted-foreground`, `border-input`, `bg-card`…) plutôt
  que les teintes brutes ; rayons `rounded-sm` à `rounded-4xl` et ombres `shadow-border` /
  `shadow-border-hover` définis dans les tokens (le mobile passe les ombres en `style.boxShadow` :
  NativeWind ignore les ombres multiples).
- Langage visuel : Watermelon UI (MIT, `THIRD_PARTY_NOTICES.md`) et le skill
  `.claude/skills/make-interfaces-feel-better` (appui `scale(0.96)`, pas de `transition-all`,
  `tabular-nums` sur les nombres, cibles de 40 px). Ne pas copier les fichiers Watermelon tels
  quels (Vite, hugeicons, `next-themes`, pas de `"use client"`) : primitives par le CLI shadcn,
  compositions recopiées et adaptées.
- Tons des statuts (`BOOKING_STATUS_TONE`, `MEMBER_STATUS_TONE`, `TONE_CLASSES`) et phase d'une
  séance : `packages/shared/src/display.ts`, utilisés par les deux apps (Tailwind scanne ce dossier).
- Pluriels : `{count, plural, =0 {…} one {# …} other {# …}}` dans les catalogues.

## Base de données (Supabase)

- **Schéma uniquement via `supabase/migrations`**, jamais de modification manuelle. Après chaque
  migration : `pnpm db:reset`, `pnpm db:types`, `pnpm db:test`, `pnpm db:lint`. La CI vérifie que
  les types commités sont à jour.
- **Multi-salles** : chaque table métier a `gym_id` et `unique (id, gym_id)` ; les clés étrangères
  entre tables métier sont **composites** `(x_id, gym_id)` pour interdire tout lien entre salles.
- **RLS sur toutes les tables**, sans exception (un test pgTAP le vérifie). Pour chaque table :
  `revoke all` puis `grant` explicites à `anon` / `authenticated`, puis les policies.
- Les contrôles d'accès qui lisent d'autres tables passent par des fonctions
  `security definer set search_path = ''` du schéma **`private`** (non exposé par l'API), par
  exemple `private.is_gym_manager(gym_id)`. Cela évite les récursions entre policies.
- **Une policy par action** (`select`, `insert`, `update`, `delete`) : pas de `for all` qui
  chevauche une policy de lecture (avertissement de performance des advisors).
- Rôles (`gym_roles`) : `member`, `coach`, `staff` (accueil), `manager`, `admin`. Finances
  visibles par le gérant/admin et par l'adhérent pour les siennes uniquement. Seul un `admin`
  attribue le rôle `admin`.
- **Chaque nouvelle table** a ses tests dans `supabase/tests/database/` : au minimum, un adhérent
  ne voit pas les données d'un autre, et une salle ne voit pas celles d'une autre. Les tests
  créent leurs propres données dans une transaction annulée et ne dépendent pas du seed.
- Réserver, annuler, pointer, promouvoir : **uniquement via les fonctions** `book_session`,
  `cancel_booking`, `set_attendance`, `cancel_session` (verrou `for update` sur la séance). Aucune
  écriture directe sur `bookings` pour `authenticated`. `supabase/tests/concurrency.sh` (lancé par
  `pnpm db:test` et en CI) vérifie l'absence de surréservation.
- De même, créer une fiche, changer son statut, ajouter ou retirer des crédits : **uniquement via**
  `create_member`, `set_member_status`, `adjust_credits` (pas d'insert sur `members` ni
  `credit_ledger`, `update` limité aux colonnes de coordonnées).
- **Stratégies** de la salle (`gyms.settings`, miroir `gymSettingsSchema`) : lues en SQL par
  `private.gym_setting_int` / `gym_setting_bool`, désactivées par défaut. Le back office masque
  une action désactivée (`getGymSettings`, `lib/settings.ts`), la base la refuse
  (`strategy_disabled`).
- Erreurs métier SQL : `raise exception '<code>'` ; tout code doit figurer dans
  `BOOKING_ERROR_CODES` (`packages/shared`, un test le vérifie) et être traduit dans chaque app.
- **File d'envoi** `outbound_messages` : tout message aux adhérents passe par
  `private.enqueue_message` (clé `dedupe_key` pour l'idempotence), qui l'ajoute aussi aux
  `interactions`. Pas d'envoi réel : un job `pg_cron` passe les messages `queued` → `logged`.
  Avis aux inscrits d'une séance : `private.notify_session_members`.
- Compteurs `class_sessions.booked_count` / `waitlist_count` : tenus par trigger, ne jamais les
  écrire à la main ; ils sont publiés en Realtime (places en direct dans l'app).
- `supabase/seed.sql` est **déterministe** (`pg_temp.rnd`, UUID dérivés de clés) et relatif à la
  date du reset. Comptes de démo : mot de passe `demo1234`, données fictives uniquement.
- Projet Supabase **de dev en ligne** : la connexion Postgres directe est bloquée depuis les
  sessions cloud ; appliquer les migrations via l'API Management et les enregistrer dans
  `supabase_migrations.schema_migrations` (voir `BRIEF.md` §12).

## Secrets et variables d'environnement

- **Aucun secret côté client.** Seules les variables `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` (URL et
  clé anon, filtrées par la RLS) atteignent le navigateur ou l'app. Clés Stripe, Anthropic, Meta,
  Google, Pennylane, `service_role` : Edge Functions ou code serveur Next.js uniquement.
- Toute variable lue dans le code est documentée dans **`.env.example`** (racine) ; `pnpm env:check`
  le vérifie, en CI aussi.
- Les valeurs réelles vont dans la configuration de l'environnement (session cloud, Vercel, EAS,
  `supabase secrets set`), **jamais dans le dépôt**. Les `.env.local` sont ignorés par git.
- Lecture des variables publiques : accès littéraux (`process.env.NEXT_PUBLIC_X`), validés par
  Zod dans `lib/env.ts` de chaque app.

## Back office (Next.js 16)

- Cette version diffère des connaissances habituelles : lire la doc embarquée
  `apps/backoffice/node_modules/next/dist/docs/` avant d'utiliser une API Next.
- `middleware` est renommé **`proxy.ts`** : il rafraîchit la session Supabase (`getClaims()`) et
  redirige vers `/login`.
- Client Supabase serveur : `lib/supabase/server.ts` (cookies via `@supabase/ssr`). Autorisation :
  `requireTeamContext()` (`lib/auth.ts`) ; la RLS reste la vraie barrière.
- Composants : shadcn/ui (`components/ui`), variables branchées sur les tokens dans
  `app/globals.css`. Ajouter un composant : `pnpm dlx shadcn@latest add <nom>` dans
  `apps/backoffice`.
- `typecheck` lance `next typegen` (génère `next-env.d.ts`, ignoré par git) avant `tsc`.
- Mutations : Server Actions + Zod, appel des fonctions SQL, puis `redirect(withFlash(...))`
  (`lib/flash.ts`, `count` pour un pluriel) : `FlashToast` l'affiche en toast puis le retire de
  l'URL (`Flash` ne sert plus que de repli `<noscript>`). Formulaires à erreurs par champ :
  `useActionState` + `Field`/`FieldError`, `noValidate` pour des messages en français. Boutons
  d'envoi : `SubmitButton` (état d'envoi). Action irréversible : `ConfirmDialog`. Actions rapides
  sans rechargement (pointage) : Server Action qui renvoie `{ error }` puis `refresh()`.
- Coque : `components/app-sidebar.tsx` (entrées filtrées par rôle), `PageHeader`, `metadata` par
  page. Rôle insuffisant : `requireRole` renvoie à l'accueil avec un message.
- Tailles tactiles : `pointer-coarse:` dans les variantes (bouton, champ, select) ; le rendu bureau
  ne change pas. Lectures au fil de la frappe : Route Handler (`app/api/…`), pas de Server Action. Identifiants : **`z.guid()`**, pas `z.uuid()` (les UUID
  du seed, dérivés d'un hash, ne respectent pas la version RFC exigée par `z.uuid()`).
- Heure courante dans un Server Component : `currentTime()` (`lib/clock.ts`) ; la règle « pureté »
  du React Compiler refuse `Date.now()` dans le rendu.

## App mobile (Expo)

- SDK 57 : installer les dépendances avec **`npx expo install`** (versions alignées sur le SDK).
- Pièges pnpm connus : `react-native-css-interop`, `babel-preset-expo` et
  `@babel/plugin-transform-react-jsx` doivent rester des dépendances **directes** de l'app, sinon
  Metro ou `eas update` échouent.
- La CI vérifie les bundles iOS et Android (`npx expo export --platform ios|android`).
- Test sur iPhone sans compte Apple : **Expo Go + EAS Update**, channel `preview`,
  `runtimeVersion` en policy `sdkVersion` (seul runtime accepté par Expo Go). Commande de
  publication dans le README. N'utiliser que des modules natifs inclus dans Expo Go tant qu'il
  n'y a pas de build installable sur iPhone.
- Development build iOS : simulateur uniquement (`eas.json`, profil `development`).
- UI : `components/ui.tsx` (Button, Card, StatusPill, Gauge, RollingNumber, Skeleton,
  EmptyState) et `components/toast.tsx` (`useToast`, retour haptique) ; `Notice` pour les états
  durables seulement. Police système (pas d'Inter sur mobile). Les vues `Animated.*` ne reçoivent
  pas les classes NativeWind : style animé seul, classes sur une vue enfant.
- Navigation : `Stack.Protected` dans `app/_layout.tsx` (connexion → onboarding → onglets) ;
  état de l'adhérent partagé par `MemberProvider` (`lib/member.tsx`), à rafraîchir après chaque
  action. Confirmations : `confirmAsync` (`Alert` ne fait rien sur le web).
- Tests navigateur de l'export web : les onglets ont le rôle `tab`, et un écran empilé garde le
  précédent dans le DOM (cibler le dernier champ).

## Outillage : pièges connus

- `eslint-plugin-react` 7.x (inclus dans les configs Next et Expo) plante sous ESLint 10 en
  détectant la version de React : la version est fixée dans `settings.react.version` de chaque
  `eslint.config.mjs`.
- `turbo` génère un `AGENTS.md` s'il détecte un agent : désactivé (`agentGuidance: false`). Next
  16 fait de même en `next dev` : désactivé par `agentRules: false` dans `next.config.ts`.
- Vercel : le framework est fixé dans `apps/backoffice/vercel.json` ; les variables
  `NEXT_PUBLIC_*` ne doivent pas être marquées « Sensitive ».
- `BRIEF.md` est exclu de Prettier (document rédigé à la main).
- Docker en session cloud : `pnpm docker:start` gère le `docker.pid` périmé laissé par un
  redémarrage du conteneur. Après un redémarrage, certains conteneurs Supabase (Realtime) peuvent
  manquer : `supabase stop` puis `supabase start`.
- `expo export` en local : la session cloud définit `EXPO_PUBLIC_SUPABASE_URL` (projet en ligne),
  qui l'emporte sur `.env.local`. Charger `.env.local` dans le shell et ajouter `--clear` (le
  cache Metro garde les valeurs inlinées).
- Ne pas utiliser `pkill -f <motif>` dans une commande qui contient ce motif : il tue son propre
  shell. Viser le nom exact du processus (`pgrep -x next-server`).
