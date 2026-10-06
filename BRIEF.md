# BRIEF — Plateforme de gestion de salle de sport (CrossFit · Hyrox · Renfo · Run)

> Document de référence pour Claude Code. À lire en entier avant toute implémentation.
> Toujours commencer une nouvelle phase en **plan mode**, valider le plan, puis implémenter.
> Les décisions prises en cours de route sont consignées en **section 12**.

---

## 1. Contexte & objectifs

Une salle de sport multi-disciplines (CrossFit, Hyrox, renforcement, running club) veut remplacer son outil actuel (type Bsport) par sa propre plateforme.

**Deux produits :**

| Produit | Utilisateurs | Rôle |
|---|---|---|
| **App mobile adhérent** (iOS + Android) | Adhérents | Réserver des cours, gérer et payer son abonnement, voir ses paiements |
| **Back office web** | Gérants, coachs, staff accueil | Exploitation quotidienne + **vision 360°** de l'activité |

**Différenciation vs Bsport :** un *Hub 360°* qui agrège Gmail, WhatsApp, Pennylane et Stripe, avec un assistant Claude capable de répondre à des questions sur l'activité (« Combien de résiliations ce mois-ci et pourquoi ? », « Quels adhérents n'ont pas réservé depuis 3 semaines ? ») et de proposer des actions (relance, message, campagne).

**Critères de succès MVP :**
- Un adhérent peut s'inscrire, souscrire un abonnement, payer et réserver un cours en < 3 minutes.
- Un gérant pilote planning, abonnements et paiements sans autre outil.
- Le Hub 360° affiche une fiche adhérent unifiée (réservations, paiements, échanges email/WhatsApp).

---

## 2. Stack technique

| Couche | Choix | Remarques |
|---|---|---|
| App mobile | **Expo** (React Native, TypeScript, Expo Router) | Build & publication via **EAS Build / EAS Submit**, mises à jour OTA via **EAS Update** |
| Back office | **Next.js** (App Router, TypeScript) | Hébergé sur **Vercel** |
| UI back office | Tailwind CSS + shadcn/ui | Tables : TanStack Table ; calendrier : FullCalendar ou équivalent |
| UI mobile | **NativeWind** (Tailwind pour RN) — *décidé* | Mêmes classes que le back office ; tokens partagés via `packages/ui` |
| Backend / BDD | **Supabase** : Postgres, Auth, Storage, Realtime, Edge Functions, pg_cron | Row Level Security obligatoire sur toutes les tables |
| Paiements | **Stripe** : Billing (abonnements), Checkout / Payment Sheet, Customer Portal, webhooks | CB + prélèvement SEPA |
| Emails transactionnels | Resend (ou Postmark) + React Email | Distinct de Gmail (Gmail = boîte du gérant) |
| IA | **API Claude** (Anthropic) avec tool use | Assistant du Hub 360° |
| Intégrations | Gmail API, WhatsApp Business Cloud API (Meta), API Pennylane | Voir section 7 |
| Monorepo | **Turborepo** + pnpm | Partage des types et de la logique métier |
| Qualité | ESLint, Prettier, Vitest, Playwright (web), Maestro (mobile) | CI GitHub Actions |
| Monitoring | Sentry (web + mobile) | |

**Pourquoi Vercel :** pertinent pour le back office Next.js (déploiements de preview par PR, intégration native Supabase). Il n'héberge pas l'app mobile : celle-ci passe par EAS. Les traitements longs ou planifiés (synchros, webhooks) vivent dans Supabase Edge Functions + pg_cron, pas dans les fonctions Vercel.

**Paiement dans l'app mobile :** l'abonnement à une salle est un service consommé physiquement, donc Stripe est autorisé (pas d'obligation d'achat in-app Apple/Google). Le préciser dans les notes de revue App Store.

---

## 3. Architecture du repo

```
/
├── apps/
│   ├── mobile/            # Expo (adhérents)
│   └── backoffice/        # Next.js (gérants, coachs)
├── packages/
│   ├── shared/            # types, schémas Zod, logique métier (règles de réservation, crédits)
│   ├── supabase/          # client typé + types générés (supabase gen types)
│   └── ui/                # tokens de design partagés (couleurs, typo)
├── supabase/
│   ├── migrations/        # SQL versionné — seule source de vérité du schéma
│   ├── functions/         # Edge Functions (stripe-webhook, sync-gmail, sync-pennylane, whatsapp-webhook, ai-assistant…)
│   └── seed.sql           # données de démo réalistes
├── BRIEF.md
└── CLAUDE.md              # conventions de code (à générer en phase 0)
```

**Principes :**
- Toute règle métier (annulation tardive, décompte de crédits, liste d'attente) est codée **une seule fois** dans `packages/shared` ou en SQL, jamais dupliquée entre mobile et web.
- Les opérations qui modifient la capacité ou les crédits (réserver, annuler, promouvoir depuis la liste d'attente) sont des **fonctions Postgres transactionnelles** avec verrou sur la session, pour éviter les surréservations en cas de requêtes simultanées. `packages/shared` porte la logique d'affichage et de validation côté client.
- Les Edge Functions tournent sous **Deno** : `packages/shared` doit rester du TypeScript pur, sans dépendance propre à Node, pour pouvoir y être importé.
- Les secrets (Stripe, Anthropic, Meta, Google, Pennylane) ne sont **jamais** côté client : uniquement Edge Functions ou routes serveur Next.js.
- Prévoir le **multi-salles** dès le schéma (`gym_id` sur les tables métier), même si une seule salle au lancement.

---

## 4. Modèle de données (première version)

| Table | Champs clés |
|---|---|
| `gyms` | nom, adresse, fuseau, paramètres (délai d'annulation, pénalités) |
| `profiles` | lien `auth.users`, téléphone, date de naissance, contact d'urgence |
| *rôles par salle* | table de liaison profil × salle × rôle (`member`, `coach`, `staff`, `manager`, `admin`) : un même profil peut avoir des rôles différents selon la salle. `staff` = accueil (cf. §6). Nom et forme exacte à fixer dans le plan de phase 0 |
| `members` | salle, profil (**facultatif** : un prospect venu par email ou WhatsApp n'a pas de compte), prénom, nom, email, téléphone, statut (prospect, actif, suspendu, résilié), source d'acquisition, `stripe_customer_id`, tags |
| `coaches` | profil, disciplines, taux horaire, statut (salarié / freelance) |
| `disciplines` | CrossFit, Hyrox, Renfo, Run… couleur, description |
| `rooms` | salle / zone, capacité |
| `class_templates` | discipline, coach par défaut, jour, heure, durée, capacité — sert à générer les récurrences |
| `class_sessions` | occurrence datée : template, coach, salle, capacité, statut (planifiée, annulée) |
| `bookings` | session, membre, statut (confirmée, liste d'attente, annulée, no-show, présent), horodatages |
| `plans` | offre, **type** (abonnement récurrent / carnet / séance unique), prix, `stripe_price_id`, disciplines incluses, engagement ; pour un carnet : nombre de crédits et durée de validité |
| `subscriptions` | membre, plan, `stripe_subscription_id`, statut, dates (abonnements récurrents uniquement) |
| `credit_ledger` | membre, mouvement (+ achat de carnet, + renouvellement, − réservation, + recrédit sur annulation, − expiration), référence (paiement, réservation). Le solde de crédits = somme des mouvements |
| `payments` | membre, montant, statut, `stripe_invoice_id`, date, moyen de paiement |
| `coach_availabilities` / `coach_shifts` | planning coach, remplacements |
| `interactions` | journal unifié du CRM : type (email, WhatsApp, appel, note), sens, résumé, lien vers la source |
| `campaigns` | emailing / WhatsApp : segment, contenu, statut, statistiques |
| `accounting_entries` | données Pennylane synchronisées (CA, charges, factures fournisseurs) |
| `integrations` | jetons OAuth chiffrés (Supabase Vault), état de synchro |
| `audit_log` | qui a fait quoi, quand |

**RLS :**
- Un `member` ne lit que ses propres données et le planning public.
- Un `coach` lit ses sessions, la liste des inscrits de ses cours et son planning.
- Un `staff` (accueil) lit et gère réservations et fiches adhérents de sa salle, sans données financières.
- Un `manager` lit et écrit tout ce qui concerne sa salle.

---

## 5. App mobile adhérent (Expo)

### Parcours prioritaires
1. **Onboarding** : inscription (email magic link + Sign in with Apple / Google), profil, acceptation CGV et décharge de responsabilité.
2. **Abonnement** : catalogue d'offres → paiement via Stripe Payment Sheet → abonnement actif immédiatement (cas du SEPA : voir §11).
3. **Planning** : vue semaine filtrable par discipline / coach, places restantes en temps réel (Supabase Realtime).
4. **Réservation** : réserver, annuler (règle du délai), liste d'attente avec promotion automatique, ajout au calendrier du téléphone.
5. **Mon compte** : abonnement en cours, crédits restants, historique des paiements et factures PDF, mise à jour du moyen de paiement (Stripe Customer Portal), pause / résiliation selon les règles du plan.
6. **Notifications push** (Expo Notifications) : rappel avant le cours, place libérée en liste d'attente, échec de paiement.

### V2 (hors MVP)
Check-in par QR code, suivi des performances (benchmarks CrossFit, temps Hyrox, allures running), parrainage, boutique.

---

## 6. Back office web (Next.js)

### Modules classiques
| Module | Fonctions |
|---|---|
| **Dashboard** | KPIs du jour : réservations, taux de remplissage, nouveaux adhérents, paiements échoués, MRR |
| **Planning des cours** | Vue calendrier semaine / jour, création de cours récurrents, glisser-déposer, annulation avec notification des inscrits |
| **Réservations** | Liste des inscrits par cours, pointage des présences, no-shows, ajout manuel d'un adhérent |
| **Coachs** | Fiches, disciplines, disponibilités, planning, remplacements, heures réalisées (export pour la paie) |
| **Abonnements & offres** | Création des plans (synchronisés avec Stripe Products / Prices), gestion des abonnements, pauses, remboursements, codes promo |
| **Paiements** | Liste, filtres, relance des impayés (dunning Stripe + relance manuelle) |
| **CRM** | Fiches adhérents et prospects, pipeline (lead → essai → abonné → résilié), tags, segments dynamiques |
| **Emailing** | Campagnes vers un segment, modèles, automatisations (bienvenue, relance inactifs, anniversaire, fin d'engagement) |
| **Paramètres** | Salle, règles de réservation, rôles et accès staff, intégrations |

### Rôles
- **Gérant / admin** : accès complet.
- **Coach** : son planning, ses cours, pointage des présences, fiches de ses adhérents (lecture seule, sans données financières).
- **Accueil** (rôle `staff`, optionnel) : réservations et fiches adhérents, sans finances.

---

## 7. Hub 360° — la différenciation

Objectif : une seule vue qui réunit tout ce qui se passe autour d'un adhérent et de la salle, avec un assistant Claude pour interroger et agir.

### 7.1 Connecteurs
| Source | Mécanisme | Ce qu'on récupère | Ce qu'on peut faire |
|---|---|---|---|
| **Stripe** | Webhooks → Edge Function `stripe-webhook` | Abonnements, factures, paiements, échecs | Relancer, rembourser (avec validation humaine) |
| **Gmail** | OAuth Google (scopes minimum) + Gmail API, synchro périodique / push Pub/Sub | Fils d'échange avec adhérents et prospects, rattachés par adresse email | Créer un brouillon de réponse |
| **WhatsApp** | WhatsApp Business Cloud API (Meta) + webhook entrant | Messages entrants / sortants rattachés par numéro | Envoyer un message (modèles approuvés hors fenêtre 24 h) |
| **Pennylane** | API Pennylane, synchro quotidienne via pg_cron | CA, charges, factures fournisseurs, trésorerie | Lecture seule au MVP |

Tous les échanges sont normalisés dans `interactions` et rattachés à la fiche adhérent → **timeline unifiée**. Un échange avec une adresse ou un numéro inconnu crée une fiche `members` au statut prospect.

**Point d'attention Gmail :** les scopes de lecture Gmail sont classés « restreints » par Google. Une application publique doit passer une vérification avec audit de sécurité ; en mode test, les jetons de rafraîchissement expirent au bout de 7 jours. Si la salle utilise Google Workspace, une application de type « interne » au domaine échappe à ces contraintes. → dépend de la question « boîte partagée ou individuelle » (§11).

### 7.2 Assistant Claude
- Edge Function `ai-assistant` appelant l'API Claude avec **tool use**.
- Outils exposés à Claude (fonctions serveur, jamais d'accès SQL libre) : `search_members`, `get_member_timeline`, `get_kpis(period)`, `get_class_fill_rate`, `get_churn_list`, `get_financials(period)`, `draft_email`, `draft_whatsapp`, `create_segment`.
- **Toute action sortante** (envoi d'email, WhatsApp, remboursement) passe par une **validation humaine** dans l'interface : Claude prépare, le gérant valide.
- Cas d'usage cibles :
  - « Résume-moi la semaine » → remplissage, nouveaux adhérents, résiliations, impayés, messages non traités.
  - « Qui risque de partir ? » → adhérents sans réservation depuis X jours, baisse de fréquence, échec de paiement.
  - « Marge du mois ? » → croisement Stripe (revenus) × Pennylane (charges) × heures coachs.
  - Fiche adhérent : résumé automatique de l'historique et suggestion de prochaine action.
- **Brief hebdomadaire** automatique (pg_cron, lundi matin) envoyé au gérant.
- **Barre de requête en langage naturel** (« Demander… », façon Claude) dans le back office : accessible depuis la barre du haut et par ⌘K, le gérant pose sa question (« Combien de no-shows ce mois-ci sur le CrossFit de 18 h 30 ? », « Qui n'est pas venu depuis 3 semaines ? ») et reçoit une réponse rédigée en streaming, avec liens vers les fiches et pages concernées. Elle s'appuie sur les mêmes outils serveur que l'assistant (jamais de SQL libre), respecte le rôle de l'utilisateur (RLS) et toute action sortante reste soumise à validation.

### 7.3 Données & conformité
- Jetons OAuth chiffrés dans Supabase Vault.
- Ne transmettre à Claude que les données nécessaires à la question ; journaliser les appels dans `audit_log`.
- RGPD : consentement marketing distinct (email / WhatsApp), export et suppression des données d'un adhérent, durée de conservation définie, registre des traitements.

---

## 8. Stripe — règles d'implémentation

- Un `Customer` Stripe par adhérent, créé à l'inscription.
- Les `Products` / `Prices` sont créés depuis le back office et synchronisés (Stripe = source de vérité pour la facturation, Supabase = miroir).
- Abonnements récurrents → Stripe Billing. **Carnets et séances uniques → paiement unique** (Payment Sheet / Checkout en mode paiement), qui alimente `credit_ledger`.
- Webhooks à traiter a minima : `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`, `checkout.session.completed`, `payment_intent.succeeded`.
- Webhooks **idempotents** (stocker l'`event.id` traité).
- Moyens de paiement : CB + SEPA Direct Debit. Un prélèvement SEPA n'est confirmé qu'après plusieurs jours ouvrés et peut échouer après coup (voir §11).
- Customer Portal Stripe pour la mise à jour du moyen de paiement et le téléchargement des factures.
- Tout développer en **mode test** avec Stripe CLI pour les webhooks en local.

---

## 9. Phasage

État au 2026-10-06 (✅ fait · ◐ en partie · ☐ à faire). Ordre revu le 2026-10-04 puis le 2026-10-06 (cf. §12).

| Phase | Contenu | État | Livrable |
|---|---|---|---|
| **0 — Fondations** | Monorepo, Supabase (projet de dev), schéma initial + RLS, seed, CI, déploiement Vercel du back office, build EAS de dev, `CLAUDE.md` | ✅ | Squelette qui tourne de bout en bout |
| **1 — Cœur réservation** | Planning, cours récurrents, réservation / annulation / liste d'attente (mobile + back office), Auth | ✅ | Un adhérent réserve un cours créé par le gérant |
| **2 — Back office complet** | Coachs et leurs heures, CRM, segments, emailing et automatisations (file d'envoi sans envoi réel), indicateurs ; refonte Watermelon UI et salle paramétrable par le gérant (3 PR) | ✅ | Le gérant n'a plus besoin de l'ancien outil pour l'exploitation |
| **3 — Hub 360°** | ✅ assistant Claude, barre de requête ⌘K, digest du jour, timeline interne (réservations, notes, messages de la file). ☐ connecteurs **Gmail, WhatsApp, Pennylane, Qonto** et envoi réel des emails (Resend) : en attente des comptes et accès (§11) | ◐ | Vision 360° + assistant |
| **4 — Paiements** | Offres et abonnements synchronisés avec Stripe, Payment Sheet (mobile) et Checkout, webhooks idempotents, crédits des carnets dans `credit_ledger`, historique et factures, Customer Portal, impayés et relances, MRR et paiements échoués dans les indicateurs | ☐ | Parcours abonnement → paiement → réservation complet |
| **5 — App adhérent complète** | Filtres du planning (discipline, coach), ajout au calendrier du téléphone, onboarding et compte (abonnement, crédits, paiements), notifications push (rappel, place libérée, échec de paiement : demande un *development build*, Expo Go ne reçoit plus les push sur Android) | ☐ | Les parcours prioritaires du §5 de bout en bout |
| **6 — Mise en production** | Tests E2E (Playwright, Maestro), Sentry, RGPD (export et suppression d'un adhérent, durées de conservation, registre), migration des données de l'ancien outil, projet Supabase de production, publication App Store / Play Store | ☐ | Lancement |

Chaque phase se termine par : tests verts, seed à jour, démo des parcours, mise à jour de ce brief si une décision a changé.

**Ce qui bloque :** phase 4 → types d'offres, engagement, validité des carnets, règle SEPA, compte Stripe (mode test) ; phase 3 (connecteurs) → comptes Meta Business et WhatsApp, Gmail (Workspace ?), accès Pennylane et Qonto ; phase 6 → identité de l'app, textes CGV et décharge, export de l'ancien outil, comptes Apple Developer et Google Play.

---

## 10. Consignes de travail pour Claude Code

1. **Planifier avant de coder** : pour chaque phase, proposer un plan (fichiers, migrations, tâches), attendre validation.
2. **Migrations SQL** uniquement via `supabase/migrations`, jamais de modification manuelle du schéma. Régénérer les types après chaque migration.
3. **RLS testées** : chaque nouvelle table a ses policies et un test qui vérifie qu'un membre ne voit pas les données d'un autre.
4. **TypeScript strict** partout ; validation des entrées avec Zod (partagé dans `packages/shared`).
5. **Pas de secret côté client.** Variables d'environnement documentées dans `.env.example`. Aucun secret commité dans le dépôt.
6. **Petits commits** thématiques, une PR par fonctionnalité.
7. **Données de démo** réalistes : ~150 adhérents, 6 coachs, 4 disciplines, 3 mois d'historique de réservations et paiements.
8. Interface en **français** ; prévoir l'i18n (clés de traduction) sans traduire au MVP.
9. En cas d'ambiguïté métier, **poser la question** plutôt que d'inventer une règle.

---

## 11. Questions ouvertes

Aucune ne bloque la phase 0 (le schéma reste générique : règles de réservation dans les paramètres de la salle, statut coach en champ, `gym_id` partout). Chacune est à trancher au début de la phase indiquée.

- [x] *(phase 1)* Une seule salle ou plusieurs sites à court terme ? → **une seule salle** (cf. §12, 2026-10-05).
- [x] *(phase 1)* Règles de réservation : délai d'annulation, pénalité no-show, nombre max de réservations simultanées ? → annulation libre, délai de 2 h indicatif, aucune pénalité, 5 réservations à venir au plus (cf. §12, 2026-10-05).
- [x] *(phase paiements)* Types d'offres : illimité, carnets, séance unique / essai, tarifs réduits (cf. §12, 2026-10-06). Durée d'engagement et validité des carnets réglées par offre par le gérant.
- [x] *(phase paiements)* **SEPA** : accès dès la souscription, suspension si le prélèvement est rejeté (cf. §12, 2026-10-06).
- [x] *(back office complet)* Coachs salariés ou freelances ? → **tous freelances** : export des heures valorisées, base de leur facture (cf. §12).
- [ ] *(back office / mise en production)* Remplace-t-on totalement Bsport ? Si oui, quelles données migrer et sous quel format d'export ?
- [ ] *(phase Hub)* Numéro WhatsApp Business dédié disponible et compte Meta Business vérifié ?
- [ ] *(phase Hub)* Gmail : boîte partagée de la salle ou boîtes individuelles des gérants ? La salle est-elle sur Google Workspace (cf. §7.1) ?
- [ ] *(phase Hub)* Budget de fonctionnement mensuel visé (Supabase, Vercel, EAS, API Claude, WhatsApp) ?
- [ ] *(phase connecteurs)* Accès API **Qonto** (lecture seule) et **Pennylane** disponibles ? Durée de conservation des emails, messages et opérations bancaires lus par l'assistant ?
- [ ] *(dès que possible)* Charte graphique / identité de la salle disponible ? À défaut, palette provisoire dans `packages/ui`.
- [x] *(phase 1, suite)* Retardataires, fenêtre de pointage, retour à « confirmé », retrait de crédits, suspension, création de fiche à l'accueil → **stratégies réglables par le gérant** dans Paramètres (cf. §12).
- [ ] *(paramétrage, plus tard)* Le gérant doit-il pouvoir changer le **fuseau horaire**, **désactiver des modules** (CRM, emailing, Hub), définir ses **étapes de CRM** et ses **sources d'acquisition**, une **liste de motifs d'annulation**, de **nouveaux déclencheurs d'automatisation**, l'**horizon de réservation** (4 semaines aujourd'hui) ? Digest planifié chaque matin et clé API saisie dans l'interface ? Rémunération des coachs salariés ou au forfait ? Invitations de l'équipe par email ? Droits de l'accueil sur l'historique d'un adhérent ? (cf. §12, 2026-10-05).

---

## 12. Journal des décisions

| Date | Décision |
|---|---|
| 2026-10-04 | **Environnement de dev** : sessions Claude Code dans le cloud (claude.ai/code) sur un dépôt GitHub. Le poste local n'a ni Node, ni Git, ni Docker, ni droits admin. |
| 2026-10-04 | **Supabase** : vérifier en début de phase 0 si Docker est disponible dans l'environnement cloud (Supabase local). À défaut, utiliser un projet Supabase en ligne dédié au développement, distinct de la production. |
| 2026-10-04 | **Docker (vérifié, phase 0)** : disponible dans la session cloud, mais le daemon ne démarre pas seul — `dockerd` doit être lancé à chaque session (`scripts/dev-docker.sh`). Les images Supabase (`public.ecr.aws`) sont téléchargeables. → **Supabase local** retenu pour le développement ; pas de projet en ligne nécessaire en phase 0. |
| 2026-10-04 | **UI mobile** : NativeWind. |
| 2026-10-04 | **Comptes** : GitHub existe. Supabase, Vercel et Expo (EAS) sont à créer pendant la phase 0. Les clés sont saisies dans la configuration de l'environnement cloud, jamais dans le dépôt. |
| 2026-10-04 | **Modèle de données** : rôles portés par salle (profil × salle × rôle), ajout du rôle `staff` (accueil), `members` utilisable sans compte (prospects), `plans.type` (récurrent / carnet / séance), registre `credit_ledger`, réservations via fonctions Postgres transactionnelles. |
| 2026-10-04 | **Schéma initial (phase 0)** : table des rôles nommée `gym_roles`. Écarts et précisions par rapport au §4 : la rémunération des coachs est isolée dans `coach_compensations` (réservée au gérant et au coach concerné) pour que la fiche `coaches` reste publique dans le planning ; disciplines des coachs et des offres en tables de liaison (`coach_disciplines`, `plan_disciplines`) ; table `stripe_events` pour l'idempotence des webhooks ; clés étrangères composites `(x_id, gym_id)` pour interdire tout rattachement entre salles. Planning, disciplines, coachs et offres actives sont lisibles sans compte (`anon`). Abonnements et paiements ne sont écrits que côté serveur (miroir de Stripe). |
| 2026-10-04 | **Rôles `manager` / `admin`** : mêmes droits sur la salle, sauf que seul un `admin` peut attribuer ou retirer le rôle `admin`. *À confirmer* si une autre distinction est souhaitée. |
| 2026-10-04 | **Back office (phase 0)** : Next.js 16 — la convention `middleware` y est renommée `proxy.ts` (rafraîchissement de session Supabase). Connexion de l'équipe par email + mot de passe ; un profil sans rôle d'équipe voit « Accès réservé à l'équipe ». shadcn/ui (style `radix-nova`) branché sur les tokens de `packages/ui` via `theme.css`. `eslint-plugin-react` 7.x (inclus dans la config Next) n'est pas encore compatible ESLint 10 : version de React fixée dans la config ESLint pour contourner. |
| 2026-10-04 | **App mobile (phase 0)** : Expo SDK 57 (React Native 0.86, React 19.2), Expo Router, NativeWind **4** (stable, sur Tailwind v3 ; la v5 compatible Tailwind v4 est encore en release candidate). Les tokens de `packages/ui` sont injectés dans `tailwind.config.ts` sous les mêmes noms que dans le back office, d'où des classes identiques. Premier écran : planning public des 7 prochains jours (lecture anonyme). Avec pnpm, `react-native-css-interop` doit être une dépendance directe de l'app. Bundles Android et web vérifiés ; non testé sur un appareil réel ni un simulateur. |
| 2026-10-04 | **Test iOS sans compte Apple** : l'app est testée sur iPhone via **Expo Go** + **EAS Update** (QR code). Le bundle iOS est vérifié. Le téléphone ne peut pas joindre le Supabase local de la session cloud : un **projet Supabase en ligne dédié au dev** est donc créé dès la phase 0 (données de démo uniquement), en complément du Supabase local. Compte Apple Developer reporté : requis plus tard pour un build iOS installable, les notifications push et l'App Store. |
| 2026-10-04 | **Projet Supabase de dev en ligne** (`https://yxxbflwosragyfwbdrix.supabase.co`, région eu-west-1) : migrations et données de démo appliquées via l'API Management (la connexion Postgres directe est bloquée par le proxy de la session cloud), versions enregistrées dans `supabase_migrations` pour garder `supabase db push` utilisable. **App publiée via EAS Update**, channel `preview`, runtime `exposdk:57.0.0` (policy `sdkVersion`, seule acceptée par Expo Go) ; projet Expo `@korentinb/salle-de-sport`, variables `EXPO_PUBLIC_SUPABASE_*` stockées dans l'environnement EAS `preview`. Avec pnpm, `babel-preset-expo` et `@babel/plugin-transform-react-jsx` (utilisé par le preset NativeWind) doivent être des dépendances directes de l'app : `eas update` lance Expo CLI sans le `NODE_PATH` des scripts pnpm. |
| 2026-10-04 | **Test sur appareil réel** : l'app s'ouvre sur iPhone dans Expo Go (QR code EAS Update, channel `preview`) et affiche le planning public depuis le projet Supabase de dev. |
| 2026-10-04 | **Identifiant de l'app (provisoire)** : `com.korentinb.salledesport` (iOS `bundleIdentifier` et Android `package`), requis par EAS Build. Modifiable tant que rien n'est publié sur l'App Store / Play Store ; *à confirmer* avant la phase 5 (nom de marque de la salle). Development build iOS limité au simulateur tant qu'il n'y a pas de compte Apple Developer. |
| 2026-10-04 | **Conventions** : `CLAUDE.md` créé (conventions de code, base de données, secrets, pièges connus de l'outillage). `.env.example` racine : référence de toutes les variables, actuelles et prévues par phase ; `pnpm env:check` (exécuté en CI) échoue si le code lit une variable non documentée. |
| 2026-10-05 | **Règles de réservation (phase 1)** : une seule salle dans les interfaces. Annulation libre jusqu'au début du cours, crédit toujours rendu ; « 2 h avant » n'est qu'une recommandation affichée ; aucune pénalité (absences seulement comptées). Au plus **5 réservations à venir** (confirmées + attente), réglable par la salle (`gyms.settings`). Seul un adhérent **actif** réserve ; une inscription crée une fiche `prospect` que l'accueil active. Sans abonnement récurrent actif, une réservation consomme 1 crédit (le gérant peut en ajouter en attendant les paiements). Liste d'attente avec promotion automatique du premier éligible. |
| 2026-10-05 | **Connexion des adhérents** : email + mot de passe (8 caractères min.). Apple / Google plus tard. CGV et décharge acceptées à l'inscription (`profiles.terms_accepted_at`, `waiver_accepted_at`) ; **textes à fournir**. Confirmation d'email désactivée sur le projet Supabase **de dev** uniquement (Expo Go) : à réactiver avec un code OTP avant la production. Mot de passe oublié : à faire (modèle d'email à code). |
| 2026-10-05 | **Réservation (implémentation)** : écritures uniquement via `book_session`, `cancel_booking`, `set_attendance`, `cancel_session`, `generate_sessions`, `join_gym` (verrou sur la séance, test de concurrence en CI). Compteurs de places tenus par trigger et publiés en Realtime. Séances générées chaque nuit sur 4 semaines (pg_cron). Planning du back office : grille maison plutôt que FullCalendar (rendu serveur dans le fuseau de la salle, sans dépendance). |
| 2026-10-04 | **Refonte UX (design system Watermelon UI, MIT)** : primitives ajoutées par le CLI shadcn officiel (style `radix-nova`, icônes lucide) ; des dashboards Watermelon on reprend la composition (barre latérale « inset », cartes KPI, listes, pastilles « soft ») et les règles de finition (`.claude/skills/make-interfaces-feel-better`, appui `scale(0.96)`, ombres en couches, `tabular-nums`, cibles de 40 px sur écran tactile). Mention de licence dans `THIRD_PARTY_NOTICES.md`. Pas de hugeicons, `next-themes` ni `motion` ; pas de mode sombre pour l'instant. |
| 2026-10-04 | **Palette** : on garde l'orange (le lime de Watermelon n'est pas lisible avec du texte blanc), corrigé au niveau **WCAG AA** : `brand-600` `#c2410c`, texte secondaire `#66666f`, bordure des champs `#86868f`, statuts `success` `#167536` / `warning` `#a14a08` / `danger` `#c0201f`. Couche `semantic` (noms shadcn) dans `tokens.ts`, mêmes classes sur le web et le mobile ; un test vérifie les contrastes. Toujours provisoire en attendant la charte (§11). |
| 2026-10-04 | **Back office** : navigation en barre latérale repliable ; retours d'action en toasts (le message reste porté par l'URL et retiré après affichage) ; vue Jour du planning par défaut sur tablette ; pointage en contrôle segmenté optimiste ; confirmation avant toute annulation. **Recherche d'adhérents** par la fonction `search_members` (RLS, nom complet sans accents, téléphone tous formats). |
| 2026-10-04 | **App mobile** : police système (SF Pro / Roboto, proches d'Inter) plutôt qu'Inter, qui demanderait une famille par graisse et un écran de démarrage ; Inter reste la police du back office. Toasts avec retour haptique (`expo-haptics`, inclus dans Expo Go). |
| 2026-10-04 | **Phasage revu** : back office complet (ex-phase 3) → Hub 360° (ex-phase 4) → paiements Stripe (ex-phase 2) → mise en production. Le Hub gagne une **barre de requête en langage naturel** pour le gérant (§7.2). Tout ce qui dépend de Stripe (MRR, offres, relances, « fin d'engagement ») attend la phase paiements. |
| 2026-10-04 | **Back office complet — décisions** : coachs **tous freelances** (heures réalisées × taux horaire, export CSV par coach). **Pas d'envoi d'email réel** pour l'instant : campagnes, automatisations et avis aux inscrits passent par une file d'envoi journalisée (`outbound_messages`), à brancher plus tard sur un service (Resend ou Brevo). Une séance **déplacée** (glisser-déposer) garde ses réservations et ses inscrits sont prévenus. Les questions ouvertes de la phase 1 deviennent des **stratégies réglables** par le gérant : tolérance de retard pour l'accueil, ouverture du pointage, retour à « confirmé », retrait de crédits, suspension par l'accueil, création de fiche à l'accueil (désactivées par défaut). |
| 2026-10-04 | **Stratégies — précisions de mise en œuvre** : un retardataire n'est inscrit que s'il reste une place (pas de liste d'attente sur une séance commencée) et jamais après la fin du cours ; un retrait de crédits ne fait pas passer le solde sous zéro ; « suspension par l'accueil » couvre aussi la réactivation d'une fiche suspendue (l'activation d'un prospect reste ouverte à l'accueil) ; résilier ou réactiver une fiche résiliée reste réservé au gérant. Création de fiche : doublon (même email, ou même téléphone tous formats) signalé, création possible après confirmation. Fiches et crédits ne s'écrivent plus que par fonctions SQL. |
| 2026-10-04 | **Coachs** : la séance (`class_sessions.coach_id`) fait foi pour les heures réalisées (séances terminées, non annulées, durée × taux horaire du moment) ; `coach_shifts` trace les remplacements. Un remplaçant est proposé selon ses disponibilités hebdomadaires, ses autres séances et ses disciplines, sans blocage : le gérant tranche. Export CSV « ; » en UTF-8 (Excel français), synthèse ou détail par coach. Seed : tous les coachs passés en freelance. |
| 2026-10-04 | **Déplacement de séance** : glisser-déposer dans la vue semaine (gérant, séances à venir, pas de 15 min), ou « Déplacer la séance » (date + heure) sur la fiche, au clavier et sur tablette. Même durée, réservations conservées, inscrits prévenus avec l'ancien et le nouveau créneau ; ils peuvent annuler librement (crédit rendu). Le chevauchement du coach est signalé dans la confirmation, sans blocage. Une séance commencée ne se déplace pas. |
| 2026-10-04 | **CRM** : fiche adhérent `/adherents/[id]` (Historique : échanges, notes, messages et séances suivies — gérant seulement, comme la RLS du CRM ; Réservations ; Profil : coordonnées, tags, consentements marketing). Pipeline déduit : Prospects → **Essai** (prospect ayant déjà réservé, ou portant le tag « essai », posé par « Démarrer l'essai ») → Actifs → Suspendus → Résiliés. Segments dynamiques combinés en ET (statut, tags, inactivité, discipline, crédits, date de fiche, anniversaire, consentement email), avec le nombre de destinataires joignables par email marketing. |
| 2026-10-04 | **Emailing (sans envoi réel)** : modèles à variables `{prenom}`, `{nom}`, `{salle}` (rendus en SQL, aperçu sur un vrai adhérent) ; campagne = segment + copie du modèle, envoyée ou programmée, **seuls les adhérents ayant consenti à l'email** (et ayant une adresse) sont mis en file, les autres comptés comme exclus. Automatisations : **bienvenue** à l'activation (message de service, sans condition de consentement, une fois par adhérent), **relance des inactifs** (N jours, une fois par période d'inactivité) et **anniversaire** (une fois par an), toutes deux marketing donc soumises au consentement ; passage quotidien `pg_cron`. Démo : trois modèles et automatisations désactivées. |
| 2026-10-04 | **Indicateurs et équipe** : page `/indicateurs` (7, 30, 90 jours ou période libre ≤ 1 an) calculée par `gym_kpis` : nouvelles fiches et part active, remplissage (global, par discipline, carte jour × heure), présence, adhérents « à risque » (séances des 30 derniers jours ≤ moitié des 30 précédents, au moins 2), heures et coût des coachs. Équipe dans Paramètres : ajout d'un rôle à un **compte existant** par son email (un coach reçoit sa fiche), retrait ; on ne retire pas son propre rôle de gérant ; l'invitation par email attendra le service d'envoi. |
| 2026-10-04 | **Paramétrage « à la Notion »** : catalogue (disciplines avec durée et places par défaut, salles), cours récurrents et fiche séance **éditables en place** (clic sur la valeur). **Plusieurs coachs par cours**, chacun payé la durée complète. Places : refus sous le nombre d'inscrits, une hausse promeut la liste d'attente, jamais au-delà de la capacité de la salle. Séance d'un cours récurrent : choix « cette séance » (elle devient personnalisée) ou « cette séance et les suivantes » (cours mis à jour, séances personnalisées épargnées). Jour ou heure d'un cours changés : les séances à venir sans réservation sont régénérées au nouveau créneau, celles déjà réservées gardent l'ancien. Planning : durée réglable en tirant le bord d'une séance, séance ponctuelle créée d'un clic sur un créneau vide. Inscrits prévenus si la fin ou les coachs changent. |
| 2026-10-04 | **Navigation du back office** en trois blocs filtrés par rôle : **Quotidien** (Aujourd'hui, Hub 360°, Planning, Indicateurs), **Opérations** (Adhérents, Pipeline, Segments, Emailing, Messages, Coachs, Cours récurrents), **Paramètres** (une entrée, onglets Général, Stratégies, Catalogue, Équipe, Intégrations ; `/catalogue` y redirige). Le **pipeline** se manipule en glisser-déposer (ou « Déplacer vers… » au clavier) : Prospect ⇄ Essai (tag « essai », retour refusé si l'adhérent a déjà réservé), vers Actif, Actif ⇄ Suspendu, vers Résilié avec confirmation ; les autres transitions sont refusées. |
| 2026-10-04 | **Hub 360° (premier lot)** : assistant Claude (Sonnet 5.5, `ANTHROPIC_MODEL` pour changer) servi par une **Route Handler Next.js** (`/api/assistant`, streaming, session de l'utilisateur) plutôt qu'une Edge Function. Réservé au gérant. Outils en **lecture seule** passant par la RLS (adhérents, fiche, indicateurs, statistiques de séances, inactifs, planning, heures des coachs, segments) ; il **propose** messages et segments, le gérant **valide** avant tout envoi ou création. Conversations conservées par utilisateur ; appels journalisés (`audit_log`, sans le contenu). **Brief de la semaine** généré à la demande depuis le Hub (pas de cron ni de clé `service_role` tant que l'envoi d'emails au gérant n'existe pas). **Message direct** validé depuis l'assistant : relance individuelle (50 destinataires au plus), sans condition de consentement marketing, comme un message de service. Connecteurs **Gmail, WhatsApp et Pennylane reportés** (questions §11 ouvertes) ; données financières indisponibles avant Stripe. |
| 2026-10-05 | **Accueil orienté action** (maquette « Coque du back office » validée) : titre « N actions vous attendent », **brief du jour** du gérant en une ou deux phrases à l'impératif avec au plus deux boutons, puis **Opérations** (remplissage et relance de la séance la moins pleine, focus cours d'essai, permanence à l'accueil, séances du jour), **Clients** (nouveaux venus à leur 1re ou 2e séance, CRM à compléter : fiches sans email ou téléphone, messages dont le dernier échange vient de l'adhérent, prospects venus ces 7 jours) et **Finance** (impayés : échecs de prélèvement depuis le dernier paiement réussi ou abonnement en retard ; factures fournisseurs en attente de Pennylane). Coque : Paramètres en pied de barre, fil d'Ariane, **un seul champ ⌘K** (adhérents et assistant), « + Nouveau ». |
| 2026-10-05 | **Hub 360° par catégorie** : l'assistant prépare à la demande un **digest du jour** (`daily_digests`, remplace le brief hebdomadaire) : brief + synthèse et actions pour Opérations, Clients et Finance. Chaque action ouvre l'assistant sur une demande préparée qui aboutit à une proposition validée une par une ; « Ignorer » l'écarte pour la journée. Sources lues : réservations, paiements, échanges et CRM ; **Gmail, WhatsApp, Qonto (ajouté) et Pennylane affichés « à connecter »**, connecteurs dans une phase dédiée. Pas de génération automatique le matin tant qu'il n'y a ni cron ni clé `service_role` côté assistant. |
| 2026-10-05 | **Permanences à l'accueil** (`desk_shifts`) : tout membre de l'équipe (accueil, coach, gérant) peut être affecté ; le gérant les planifie depuis l'accueil ou le planning (ligne « Accueil »). Plage attendue : 30 min avant la première séance du jour jusqu'à 30 min après la dernière ; un trou d'au moins 15 min est signalé « à couvrir ». |
| 2026-10-05 | **Note « à savoir »** (`member_care_notes`, texte libre de 500 caractères, sans catégorie médicale) : écrite par l'accueil ou le gérant, lue par eux et par les coachs d'une séance du jour ou à venir où l'adhérent est inscrit, jamais par l'adhérent ni l'app. Son contenu n'est jamais transmis à l'assistant (seulement sa présence). |
| 2026-10-05 | **Watermelon UI appliqué, sans changer de socle** : les composants du registre Watermelon (`ui.watermelon.sh/r`) sont écrits pour la variante Base UI de shadcn ; ils sont **recomposés à la main sur nos primitives Radix** (tableaux, combobox, dates, tags, réglages, toasts, menus, jauges…), jamais installés par le CLI depuis leur URL. Animations en **CSS + View Transitions de React** ; `motion`, hugeicons et next-themes restent exclus ; seule nouvelle dépendance : le calendrier shadcn (`react-day-picker` + `date-fns`, locale fr, semaine du lundi). **Toast « Annuler » (10 s)** à la place d'une confirmation pour les actions réversibles ; confirmation gardée pour annuler une séance, envoyer une campagne, résilier un adhérent et supprimer. Livraison en trois PR (socle et paramétrage, opérations, pilotage). |
| 2026-10-05 | **Salle paramétrable par le gérant** (écran Paramètres en sections, chaque valeur enregistrée aussitôt avec « Annuler ») : **identité** (nom, adresse, téléphone, email, logo dans le bucket public `gym-assets`) et **horaires d'ouverture** sur `gyms` (lisibles sans compte) ; fuseau affiché en lecture seule. **Réglages internes** dans `gym_private_settings` (équipe en lecture, gérant par `update_gym_settings`) : marge et écart signalé des permanences, créneau proposé, fenêtre des essais à rappeler (7 j), fenêtre et minimum des adhérents « à risque » (30 j, 2 séances), plafond d'ajout ou de retrait de crédits (50), taille des listes du CRM (50), seuil « peu remplie » (50 %) — mêmes défauts qu'avant, lus par les fonctions SQL. Les horaires fixent la **plage du planning** et la **présence attendue à l'accueil** ; la règle « 30 min autour des séances » ne sert plus qu'un jour sans horaires. **Accueil composable** : blocs (brief, Opérations, Clients, Finance) affichés et ordonnés par rôle, pastilles de la barre latérale par rôle. Disciplines **ordonnées** par le gérant. |
| 2026-10-05 | **Jours de fermeture** (`gym_closures`) : une **alerte pour le gérant** si des cours sont prévus ce jour-là ; les cours restent possibles. **Séance peu remplie** : une **étiquette seulement**, sans action proposée, sous le seuil réglable (50 % par défaut) ; la relance de la séance la moins pleine disparaît de l'accueil. Alerte et étiquette affichées avec la refonte du planning et de l'accueil (PR 2). |
| 2026-10-05 | **Back office fluide** : la coque n'attend plus que l'équipe de l'utilisateur ; les pastilles (une fonction SQL légère `nav_counts`) arrivent à part. Squelette de la forme de chaque page, fil d'Ariane avec le titre de la fiche, indice d'attente des liens, transition courte entre sections (aucune animation au rafraîchissement ni sous « réduire les animations »). |
| 2026-10-06 | **Accueil (PR 2)** : chaque bloc se charge à part (une erreur reste locale au bloc) ; « Voir les N autres » remplace les listes à défilement. **Données vivantes** : l'accueil est relu toutes les 60 s quand l'onglet est visible, au retour sur l'onglet et peu après chaque changement des séances de la salle (Realtime) ; c'est toute la page qui est relue côté serveur (l'affichage précédent reste en place, sans squelette), plus simple qu'un rafraîchissement bloc par bloc. **Checklist de mise en route** du gérant (adresse et contact, logo, horaires, disciplines, cours récurrents, équipe), masquée une fois tout fait. Note « à savoir » modifiable en popover depuis les essais du jour. L'alerte « jour de fermeture » couvre les 14 jours à venir. |
| 2026-10-06 | **Planning (PR 2)** : un clic sur une séance ouvre son **aperçu** (panneau : places, inscrits) ; Ctrl ou ⌘-clic ouvre la fiche. Un clic sur un créneau vide ouvre la **création rapide** ancrée au créneau (discipline, heure, coachs, salle ; durée et places de la discipline) ; « + Nouveau › Séance » ouvre le même formulaire. Glisser-déposer : la séance **reste à sa nouvelle place** pendant la confirmation et revient si la base refuse ; aussi **au clavier** (Espace, flèches, Espace) avec annonces en français ; « Annuler » seulement si personne n'a été prévenu. Jours fermés grisés (fermeture, ou jour sans horaires quand la salle en a saisi), heures fermées ombrées. Légende cliquable en filtre, mini-calendrier. Permanences : un seul dialogue, suppression rattrapable par « Annuler » ; plus de trou signalé les jours passés. |
| 2026-10-06 | **Fiche séance et cours récurrents** : « Tous présents » en un appel (`set_attendance_many`, mêmes règles que le pointage unitaire, dans une transaction) ; « Annuler » proposé seulement si la stratégie « pointage modifiable » est active. Une inscription apparaît aussitôt dans la liste, refus expliqué. Déplacement depuis la fiche avec **aperçu** (inscrits prévenus, coach occupé) avant confirmation. Cours récurrents : **« Dupliquer »** crée une copie inactive ; avant de changer jour, heure ou période d'un cours, ou de le désactiver, **aperçu des séances à venir** recréées, supprimées ou gardées (`template_change_preview`) ; génération des séances sur une période choisie (raccourcis vers l'avenir). |
| 2026-10-06 | **Adhérents** : tableau triable (nom, statut, crédits), 25 / 50 / 100 lignes, colonnes et densité **mémorisées dans le navigateur**, recherche au fil de la frappe combinable avec le statut et une étiquette. **Actions en lot** : activer les inscriptions, ajouter une étiquette (accueil et gérant), **export CSV réservé au gérant et journalisé** (`audit_log`, « ; », UTF-8) ; **pas d'envoi de message en masse depuis la liste** (consentement : les envois passent par l'emailing). Suspendre et réactiver se rattrapent par « Annuler » ; résilier reste confirmé. Solde de crédits calculé en SQL (`search_members`, gérant seulement). |
| 2026-10-06 | **Fiche adhérent** : onglets chargés à part ; coordonnées modifiées sur place ; étiquettes enregistrées à chaque changement. **Consentements** : un accord part aussitôt (« Annuler » le retire), un retrait attend 10 s (« Annuler » garde l'accord et sa date d'origine) ; **tout changement de consentement est journalisé** par la base (`audit_log`, action `member.consent`), y compris depuis l'app. Pipeline : « Annuler » quand le retour est permis, refus du retour expliqué. Segments : critères appliqués au fil de la saisie, **un seul comptage** (le nombre de joignables par email n'est plus compté à part : une icône le signale dans l'aperçu, et l'emailing compte les exclus à l'envoi). |
| 2026-10-06 | **Palette ⌘K (PR 3)** pour tous les rôles : Récents (pages et fiches ouvertes depuis la palette, **mémorisés dans le navigateur par compte**, jamais partagés entre comptes d'un poste d'accueil), Adhérents, Aller à, Réglages (liens vers chaque section des Paramètres, gérant), Actions (« Nouveau ») ; la question à l'assistant passe **après** les résultats (Entrée ouvre d'abord la page ou la fiche trouvée). **Hub** en deux volets : changer de conversation ne recharge pas la page ; **« Arrêter »** interrompt la réponse (modèle compris) et garde le texte reçu ; les propositions de l'assistant sont **modifiables avant validation** (destinataires retirables, objet, message, nom du segment) ; la barre « Demander » du haut ouvre une nouvelle conversation dans le volet. |
| 2026-10-06 | **Emailing (PR 3)** : campagnes en tableau à lignes dépliables, création et modification dans un panneau (segment avec son audience joignable, modèle copié, programmation facultative à l'heure de la salle) ; **envoi confirmé avec la case « Je comprends »**, suppression confirmée, retour en brouillon rattrapable par « Annuler ». Modèles : variables insérées au curseur, **aperçu en direct sur l'adhérent choisi** (rendu SQL, comme à l'envoi), suppression confirmée. Messages : recherche (objet, adresse), filtres adhérent, origine, statut appliqués aussitôt, détail dans un panneau. |
| 2026-10-06 | **Coachs, heures, indicateurs (PR 3)** : mois au choix et tri par colonne ; disponibilités d'un coach dans l'**éditeur hebdomadaire** enregistré sur place (seules les plages permanentes, sans date de fin, sont remplacées) ; heures en lignes dépliables, total collant, export par coach. Indicateurs : période à raccourcis, **variation par rapport à la période précédente de même durée** obtenue en appelant `gym_kpis` deux fois (pas de migration : la fonction reste la seule source des calculs) ; « adhérents à risque » sans variation (indicateur instantané). |
| 2026-10-06 | **Plan global mis à jour** (§9) après la refonte Watermelon UI (PR 1 à 3) : phases 0 à 2 terminées, Hub 360° en partie (assistant fait, connecteurs externes en attente d'accès). Une phase **« App adhérent complète »** est ajoutée entre les paiements et la mise en production, car l'app mobile n'a pas évolué depuis la phase 1 (planning, réservation, compte de base). Ordre **validé** : paiements, app adhérent, connecteurs du Hub dès que les accès arrivent, mise en production. |
| 2026-10-06 | **Paiements — premières réponses** : la salle vend des **abonnements illimités**, des **carnets de séances**, des **séances uniques / essais** et des **tarifs réduits**. **SEPA : accès aux cours dès la souscription** ; un prélèvement rejeté plus tard fait passer l'abonnement en impayé et suspend l'accès. **Pas encore de compte Stripe** : la phase est développée contre un faux Stripe (mêmes événements que l'API), le branchement réel viendra avec les clés de test dans la configuration de l'environnement. |
| 2026-10-06 | **Paiements — règles** : tarifs réduits par **offres à part** (public visé, mention « justificatif à présenter », vérifié à l'accueil) **et par codes promo** ; une offre peut être **limitée à certaines disciplines** (la base refuse la réservation hors offre) ; **ventes sur place de tout type** enregistrées dans le back office (espèces, terminal, autre), y compris des abonnements suivis hors Stripe et renouvelés à la main ; l'adhérent **résilie seul** depuis l'app après la fin de l'engagement (effet en fin de période), les pauses passent par le gérant. Par défaut, l'accueil n'enregistre une vente que si une stratégie l'y autorise (validé le 2026-10-06, avec le passage d'un prospect qui achète au statut actif). Livraison en 3 PR : socle sans Stripe (offres, accès par discipline, expiration des crédits, ventes manuelles, promo, page Paiements, indicateurs), puis Stripe (Edge Functions `stripe-webhook` et `billing`, Payment Sheet), puis impayés et relances. |
| 2026-10-06 | **Facturation, socle (PR A, sans Stripe)** : **crédits par lots** (un achat ou un ajout manuel = un lot, lié à son offre et à sa date de fin) ; une réservation débite le lot qui **expire le premier parmi ceux qui couvrent la discipline**, une annulation le recrédite dans le même lot, un retrait manuel puise dans l'ordre d'expiration ; le **restant d'un lot échu expire** chaque nuit (écriture `expiration`, le solde reste la somme du registre). Un abonnement **suivi à la main** (vente sur place) donne accès jusqu'à la fin de sa période ; non renouvelé, il passe en **impayé** (accès suspendu, listé à l'accueil), arrêté, il se termine à la fin de la période payée. **Un prospect qui achète devient actif.** Code promo : pourcentage ou montant, limité à des offres, une date de fin et un nombre d'utilisations (comptées sur les paiements). Indicateurs : CA de la période, revenu mensuel récurrent (abonnements en cours, tarif annuel ramené au mois), paiements échoués. Page **Paiements** (gérant) avec export CSV journalisé. App : compte (offre, période, crédits par lot), paiements, catalogue des offres (achat en ligne avec Stripe, PR B). |
