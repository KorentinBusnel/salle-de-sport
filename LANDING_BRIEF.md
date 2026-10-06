# BRIEF — Landing page de lancement (v2) · SEO + visibilité dans les LLM

> Document de référence pour Claude Code, à déposer à la racine du projet existant.
> Il remplace `LANDING_BRIEF.md` (v1). La maquette validée sert de référence visuelle ; ce brief en décrit le contenu exact.
> **Commencer en plan mode** : explorer le projet existant, proposer où et comment intégrer la landing, attendre validation, puis implémenter.
>
> Décisions prises à l'implémentation (nom **Kettl**, app `apps/landing`, base de production, FAQ sans intégrations…) : `BRIEF.md` §12, 2026-10-06.

---

## 0. Avant de coder : s'adapter au projet existant

1. Lire la structure du repo, le `package.json`, la config Next.js / Vercel, le design system éventuel et `CLAUDE.md` s'il existe.
2. **Ne rien réinstaller ni restructurer sans validation.** Réutiliser le framework, le styling et les composants existants.
3. Proposer dans le plan :
   - l'emplacement de la landing (app dédiée `apps/landing` dans le monorepo, ou route `/` d'une app existante) ;
   - comment brancher le formulaire sur Supabase (table `waitlist`) et Resend ;
   - la liste des fichiers créés ou modifiés.
4. Si le projet n'est pas en Next.js (App Router), le signaler : les exigences SEO ci-dessous supposent un rendu côté serveur ou statique.

---

## 1. Objectif

Page unique de lancement. **Une seule action : laisser son email** (liste d'attente).

**Cible :** gérants et fondateurs de salles CrossFit, Hyrox, renforcement, running, studios indépendants, en France.

**Deux objectifs de découverte :**
- être bien classé sur Google pour les recherches de logiciel de gestion de salle de sport ;
- être compris et cité correctement par les assistants IA (ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews) quand on leur demande un outil de ce type.

---

## 2. Contenu exact (validé sur la maquette)

**Vouvoiement partout.** Textes centralisés dans un fichier de contenu (ex. `content/landing.ts`).

### 2.1 Header (sticky, fond `#fafaf9` translucide)
- Gauche : nom de la plateforme = logo. Serif (Fraunces 500, ~30 px), minuscules, suivi d'un point en couleur d'action. Ex. `spotter.`
- Droite : bouton « Rejoindre » (ancre vers le formulaire).
- Pas d'autres liens de navigation.

### 2.2 Hero (photo en fond)
- Carte pleine largeur (max 1392 px, rayon 16 px) avec **photo de salle de sport en fond** + voile sombre `linear-gradient(rgba(12,10,9,.55), rgba(12,10,9,.72))`. Texte blanc, centré.
- Badge : « Plusieurs salles déjà sur liste d'attente » (pastille en couleur d'action).
- **H1** : « Votre salle de sport, *augmentée* par l'IA. » (Fraunces 400, ~84 px, « augmentée » en italique).
- Sous-titre : « Optimisez la gestion de votre salle grâce à l'intelligence artificielle, pour vous concentrer là où ça compte. »
- Formulaire : champ email (placeholder `contact@votre-salle.fr`) + bouton « Rejoindre la liste » + case de consentement RGPD non pré-cochée avec lien Confidentialité.
- Encart blanc : « TARIF FONDATEUR · **99 €** / mois ».

### 2.3 Aperçu interactif du logiciel
Fenêtre type application (barre de titre avec 3 pastilles, nom · vue active, indicateur « En direct · N check-ins aujourd'hui » qui clignote, barre de progression d'auto-défilement).

Menu latéral « **Pilotage de votre salle** » :

| # | Étape | Sous-rubriques | Contenu de la vue |
|---|---|---|---|
| 01 | Quotidien | Cours du jour · Check-in · Messages | Cours du jour avec barres de remplissage, « À traiter » (WhatsApp 3, Gmail 2), carte assistant « Une place s'est libérée à 19:00… » + bouton Prévenir |
| 02 | Dashboard | KPIs · Tendances · Alertes | 4 cartes : Remplissage 82 % (courbe), Adhérents actifs 248, Risque de départ 7, Emails prioritaires 5 ; bandeau assistant |
| 03 | Opérations | Planning · Coachs · Paiements | Planning de la semaine (un créneau « Coach à remplacer »), Paiements échoués 2, Heures coachs 86 h |
| 04 | CRM | Adhérents · Segments · Campagnes | Segments (Inactifs 21 j · 7, Fin d'engagement · 4, Prospects · 12) + tableau (Camille R., Thomas L., Inès M.) |
| 05 | Marketplace | Produits · Services · Devis | Réassort rapide (boissons, whey, serviettes), devis ménage, BAT t-shirts |
| — | Intégrations (6) | — | Stripe, Pennylane, Gymlib, Gmail, WhatsApp, Google Agenda, statut « Connecté » |

**Comportement :**
- Défilement automatique toutes les 4 s ; un clic sur une étape l'arrête.
- Animations : cartes en cascade, barres qui se remplissent, courbe qui se dessine, compteur de check-ins qui augmente. Tout désactivé si `prefers-reduced-motion`.
- **Important pour le SEO** : le texte de toutes les vues doit être présent dans le HTML rendu côté serveur (onglets accessibles, pas de contenu généré uniquement en JavaScript après chargement).

### 2.4 Rappel final (carte blanche)
- Eyebrow « TARIF FONDATEUR », H2 « Prenez votre place *avant* le lancement. »
- « **99 € / mois** pour les premières salles inscrites. Plusieurs salles ont déjà rejoint la liste. »
- Même formulaire email.

### 2.5 FAQ (nouveau, recommandé pour Google et les LLM)
Section courte, 5 questions, en `<details>`/`<summary>` ou titres H3 visibles. Réponses factuelles de 1 à 3 phrases :
1. Qu'est-ce que [NOM] ? → logiciel de gestion pour salles de sport, assisté par IA, avec marketplace d'achats.
2. Pour quelles salles ? → CrossFit, Hyrox, renforcement, running, studios indépendants.
3. Combien ça coûte ? → tarif fondateur 99 € / mois pour les premières salles inscrites.
4. Quand sera-t-il disponible ? → lancement prévu début 2027, accès prioritaire pour la liste d'attente.
5. Avec quels outils s'intègre-t-il ? → Stripe, Pennylane, Gymlib, Gmail, WhatsApp, Google Agenda.

> Ne rien affirmer qui ne soit pas vrai au lancement (pas de faux chiffres clients, pas d'avis inventés).

### 2.6 Footer
Nom-logo, « Contact → », Mentions légales, Confidentialité (pages simples `/mentions-legales`, `/confidentialite`).

---

## 3. Design

Référence : `design/DESIGN.md` (style « warm stone », accent indigo).

| Token | Valeur |
|---|---|
| Fond de page | `#fafaf9` |
| Cartes | `#ffffff`, bordure `#e7e5e4` |
| Texte | `#292524` · secondaire `#79716b` · tertiaire `#a6a09b` |
| Action (unique) | `#615fff`, survol `#4f39f6` |
| Décoratif | terracotta `#d97757` (traits, icônes) ; vert `#5ea500`, teal `#22b8cd` en contours de statut uniquement |
| Typo | Fraunces (titres serif), Geist (texte), Geist Mono (libellés, chiffres) via `next/font` |
| Formes | boutons 8 px (texte en majuscules, 600, +0.04em), champs 12 px, cartes 8–16 px |
| Ombre | uniquement sur la fenêtre du logiciel |

**Photo du hero :** fichier haute définition (≥ 2 400 px de large), sans logo de marque visible, licence d'usage commercial vérifiée. Servie avec `next/image` (`priority`, `sizes`, AVIF/WebP), texte alternatif descriptif.

---

## 4. SEO Google

### Technique
- Rendu **statique ou serveur** (Next.js App Router, page `export const dynamic = 'force-static'` si possible).
- `lang="fr"`, un seul `<h1>`, hiérarchie H2/H3 cohérente, HTML sémantique (`header`, `main`, `section`, `footer`, `nav`).
- **Metadata API** de Next.js :
  - `title` (≤ 60 caractères) : « [NOM] — Logiciel de gestion de salle de sport avec IA »
  - `description` (≤ 155 caractères) : « Planning, réservations, paiements, CRM et marketplace réunis, avec un assistant IA. Tarif fondateur 99 €/mois. Rejoignez la liste d'attente. »
  - `alternates.canonical`, Open Graph et Twitter Card, image OG générée (`opengraph-image.tsx`, 1200 × 630).
- `app/sitemap.ts` et `app/robots.ts`.
- **Core Web Vitals** : LCP < 2,5 s (photo hero optimisée et préchargée), CLS < 0,1 (dimensions réservées), INP < 200 ms. Lighthouse ≥ 95 sur les 4 axes.
- Polices auto-hébergées via `next/font` (pas d'appel bloquant à Google Fonts).

### Données structurées (JSON-LD dans `<head>`)
- `Organization` : nom, url, logo, email de contact.
- `SoftwareApplication` : `name`, `applicationCategory: "BusinessApplication"`, `operatingSystem: "Web, iOS, Android"`, `description`, `offers` (`price: "99"`, `priceCurrency: "EUR"`, description « tarif fondateur, par mois »).
- `FAQPage` reprenant exactement les questions/réponses visibles de la section 2.5.
- `WebSite` avec le nom de la marque.
- Valider avec le **test des résultats enrichis** de Google et le validateur Schema.org.

### Mots-clés à couvrir naturellement (sans bourrage)
logiciel de gestion de salle de sport · logiciel box CrossFit · gestion salle Hyrox · réservation de cours salle de sport · CRM salle de sport · alternative française pour salles indépendantes.

---

## 5. Visibilité dans les LLM (GEO)

Les assistants IA citent surtout des pages **lisibles sans JavaScript, factuelles et sans ambiguïté**.

1. **Contenu factuel et autoportant** : la page doit dire clairement, en texte, *ce qu'est le produit, pour qui, combien, quand, avec quoi il s'intègre*. Phrases simples, chiffres exacts, nom de marque répété de façon cohérente.
2. **FAQ en langage naturel** (section 2.5) : c'est le format le plus repris par les assistants.
3. **`/llms.txt`** à la racine : fichier Markdown qui résume le produit pour les modèles (titre, résumé d'une phrase, sections « Produit », « Tarif », « Intégrations », « Lancement », liens vers la page et la FAQ). C'est une convention proposée, encore peu officielle : utile, sans garantie qu'un moteur donné l'exploite.
4. **`robots.txt`** : autoriser explicitement les robots des moteurs de recherche IA si l'on veut être cité, par exemple `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Claude-SearchBot`, `Claude-User`, en plus de `Googlebot` et `Bingbot`. Décider séparément si l'on autorise les robots d'entraînement (`GPTBot`, `ClaudeBot`, `Google-Extended`) : les bloquer n'empêche pas d'apparaître dans la recherche Google. **Vérifier la liste à jour des user-agents dans la documentation de chaque éditeur avant la mise en ligne.**
5. **Données structurées** identiques au contenu visible (section 4) : elles aident aussi les modèles à extraire prix et catégorie.
6. **Bing Webmaster Tools** en plus de Google Search Console : l'index Bing alimente plusieurs assistants.
7. Pas de texte important dans des images ou des canvas ; textes alternatifs descriptifs.

---

## 6. Formulaire liste d'attente

Inchangé par rapport à la v1 :
- Table Supabase `waitlist` (email unique en minuscules, consentement, `source`, `utm_campaign`, `created_at`), RLS sans accès anonyme, insertion via Server Action.
- Validation Zod, honeypot + limite de débit, états chargement / succès / erreur / déjà inscrit.
- Email de confirmation via Resend.
- Capture des UTM.

---

## 7. Analytics

Vercel Analytics ou Plausible (sans cookies, donc sans bandeau). Événements : vue de page, clic étape de l'aperçu, envoi du formulaire, succès d'inscription.

---

## 8. Critères d'acceptation

- [ ] Rendu fidèle à la maquette sur desktop (1440 px) et mobile (390 px).
- [ ] Le texte de toutes les vues de l'aperçu est présent dans le HTML source (vérifier avec `curl`).
- [ ] Lighthouse ≥ 95 sur Performance, Accessibilité, Bonnes pratiques et SEO.
- [ ] JSON-LD valide (test des résultats enrichis sans erreur).
- [ ] `/sitemap.xml`, `/robots.txt` et `/llms.txt` accessibles.
- [ ] Inscription testée de bout en bout en production (ligne en base + email reçu).
- [ ] Animations coupées avec `prefers-reduced-motion`.

---

## 9. À fournir avant de lancer Claude Code

- [ ] Nom définitif de la plateforme et domaine
- [ ] Photo du hero en haute définition, libre de droits commerciaux
- [ ] Email de contact réel et informations des mentions légales
- [ ] Choix sur les robots d'entraînement IA (autoriser ou bloquer)
