// Textes du site vitrine. Toute chaîne affichée passe par une clé : `t("hero.cta")`.
// Règles du skill landing-page-design (vérifiées par lib/messages.test.ts) : aucun trait d'union
// (pas de « Puis-je », « rendez-vous », « e-mail »), pas de mots creux, majuscule en début de
// phrase seulement. {brand} est rempli par t() avec le nom de lib/site.ts.
export const fr = {
  meta: {
    title: "{brand} · La gestion de salle de sport avec l'IA native",
    description:
      "Planning, réservations, paiements et relation adhérent pour toutes les salles et toutes les activités, avec un assistant IA qui prépare le travail. Essai gratuit, sans carte bancaire.",
  },
  nav: {
    label: "Navigation principale",
    home: "{brand}, accueil",
    skip: "Aller au contenu",
    adaptable: "Pour toutes les salles",
    features: "Fonctionnalités",
    how: "Comment ça marche",
    faq: "Questions",
    cta: "Commencez gratuitement",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
  },
  hero: {
    announce: "La salle de sport à l'ère de l'IA agentique",
    title: "Gérez votre salle avec l'IA native de {brand}.",
    subtitle:
      "{brand} s'adapte à toutes les salles et à toutes les activités : planning, réservations, paiements et relation adhérent dans un seul outil, avec un assistant IA qui prépare le travail et vous laisse valider.",
    start: "Commencez gratuitement",
    contact: "Nous contacter",
    note: "Essai gratuit, sans carte bancaire.",
    count:
      "{count, plural, one {# salle gère déjà son activité} other {# salles gèrent déjà leur activité}} avec {brand}",
    backofficeAlt:
      "Page Aujourd'hui du back office {brand} : séances du jour, essais à accueillir, permanence et impayés.",
    appAlt: "Planning de la semaine dans l'app adhérent {brand}, avec les places restantes.",
  },
  problem: {
    beforeLabel: "Aujourd'hui",
    title: "Votre salle tient sur quatre outils",
    bookings: "Les réservations dans une app, les paiements dans une autre.",
    hours: "Les heures des coachs recopiées dans un tableur chaque fin de mois.",
    unpaid: "Les impayés repérés trop tard et relancés un par un sur WhatsApp.",
    questions: "« Qui n'est pas venu depuis trois semaines ? » reste sans réponse.",
    afterLabel: "Avec {brand}",
    solutionTitle: "Tout part du même planning",
    solution:
      "Une réservation débite le bon crédit. Un prélèvement rejeté suspend l'accès et prévient l'adhérent. Les heures des coachs se comptent à partir des séances réalisées.",
    solutionBookings: "Réservations, paiements et crédits dans la même base",
    solutionTeam: "Un accès par rôle : gérant, accueil, coach",
    solutionApp: "Une app pour vos adhérents : planning, réservation, paiement",
  },
  adaptable: {
    eyebrow: "Pour toutes les salles",
    title: "Un outil qui s'adapte à votre salle, pas l'inverse",
    subtitle:
      "Box CrossFit, studio de yoga, club de boxe ou salle d'escalade : vous décrivez vos activités, vos offres et vos règles, {brand} suit.",
    activitiesTitle: "Toutes vos activités",
    activitiesBody:
      "Vous créez vos disciplines, avec leur couleur, leur durée et leurs places : yoga, boxe, pilates, escalade, CrossFit, running…",
    offersTitle: "Vos offres",
    offersBody:
      "Abonnements avec ou sans engagement, carnets, séances à l'unité, tarifs réduits, codes promo, offres réservées à certaines disciplines.",
    rulesTitle: "Vos règles de réservation",
    rulesBody:
      "Réservations à venir autorisées, liste d'attente, retardataires, ouverture du pointage : chaque stratégie s'active dans les paramètres.",
    teamTitle: "Votre équipe",
    teamBody:
      "Gérant, accueil et coachs ont chacun leurs accès, plusieurs coachs par cours, permanences de l'accueil planifiées.",
    hoursTitle: "Votre calendrier",
    hoursBody:
      "Horaires d'ouverture, jours de fermeture et salles : le planning et l'accueil suivent votre calendrier.",
    messagesTitle: "Vos messages",
    messagesBody:
      "Modèles d'emails, campagnes et automatisations : bienvenue, relance des inactifs, anniversaire.",
  },
  benefits: {
    eyebrow: "Fonctionnalités",
    title: "Ce que {brand} change dans votre semaine",
    subtitle:
      "Un back office pour l'équipe, une app pour les adhérents, une seule base de données entre les deux.",
    classes: {
      title: "Des cours pleins, jamais surréservés",
      body: "Vos adhérents voient les places restantes en direct dans l'app. Quand une place se libère, la liste d'attente promeut le premier inscrit éligible.",
      point1: "Deux réservations simultanées ne prennent jamais la même place.",
      point2: "Une séance déplacée au planning prévient ses inscrits.",
      point3: "Pointage des présences en un geste, « Tous présents » compris.",
      alt: "Planning de la semaine dans le back office, séances colorées par discipline avec leur remplissage.",
    },
    payments: {
      title: "Des impayés traités avant la fin du mois",
      body: "Abonnements par carte ou prélèvement SEPA, carnets de séances et séances à l'unité, payés dans l'app avec Stripe.",
      point1: "Un prélèvement rejeté suspend les réservations jusqu'au règlement.",
      point2: "Relances automatiques à J+3 et J+7, réglables.",
      point3: "Ventes sur place enregistrées : espèces, terminal ou autre.",
      alt: "Page Paiements du back office : encaissements, statuts et filtres.",
    },
    members: {
      title: "Chaque adhérent connu dès la porte",
      body: "La fiche résume ancienneté, séances des 30 derniers jours, taux de présence et crédits restants. L'accueil voit l'essentiel, sans les finances.",
      point1: "Note « à savoir » partagée avec l'accueil et les coachs du jour.",
      point2: "Historique des échanges, des réservations et des paiements.",
      point3: "Campagnes email aux seuls adhérents qui ont donné leur accord.",
      alt: "Fiche adhérent : bandeau de synthèse, coordonnées et historique.",
    },
    coaches: {
      title: "Les heures des coachs calculées pour vous",
      body: "Chaque séance terminée compte pour ses coachs : durée multipliée par le taux horaire, avec plusieurs coachs par cours si besoin.",
      point1: "Export CSV par coach, prêt pour leur facture.",
      point2: "Disponibilités et remplacements dans le même planning.",
      point3: "Permanences de l'accueil planifiées, créneaux non couverts signalés.",
      alt: "Heures réalisées par coach sur le mois, avec le montant à facturer.",
    },
    assistant: {
      title: "Vos questions, répondues en une phrase",
      body: "Demandez « Qui n'est pas venu depuis trois semaines ? » : l'assistant lit vos données avec vos droits, répond avec les fiches concernées et prépare la relance.",
      point1: "Rien ne part sans votre validation.",
      point2: "Un brief du jour : opérations, clients et finances.",
      point3: "Les notes « à savoir » ne lui sont jamais transmises.",
    },
  },
  assistantDemo: {
    caption: "Exemple d'échange avec l'assistant {brand}",
    question: "Qui n'est pas venu depuis trois semaines ?",
    answer:
      "7 adhérents actifs n'ont rien réservé depuis 21 jours. Les trois absences les plus longues :",
    member1: "Léa Fontaine",
    member1Last: "dernière séance le 2 octobre",
    member2: "Hugo Marchand",
    member2Last: "dernière séance le 29 septembre",
    member3: "Sarah Benali",
    member3Last: "dernière séance le 27 septembre",
    proposal: "Message proposé à 7 adhérents",
    proposalSubject: "On vous garde une place cette semaine",
    edit: "Modifier",
    validate: "Valider l'envoi",
  },
  tagline: {
    line1: "Vos coachs coachent.",
    line2: "Votre accueil accueille.",
    line3: "{brand} s'occupe du reste.",
  },
  how: {
    eyebrow: "Comment ça marche",
    title: "Trois étapes avant la première réservation",
    step: "Étape {n}",
    step1Title: "Créez votre salle",
    step1Body:
      "Demandez votre essai gratuit : nous ouvrons votre accès, vous saisissez horaires, disciplines, cours et offres. Les séances se génèrent sur quatre semaines.",
    step2Title: "Invitez votre équipe",
    step2Body:
      "Gérant, accueil et coachs ont chacun leur accès. L'accueil ne voit pas les finances, un coach voit ses cours et ses inscrits.",
    step3Title: "Ouvrez les réservations",
    step3Body:
      "Vos adhérents créent leur compte, paient leur abonnement et réservent depuis l'app.",
  },
  faq: {
    eyebrow: "Questions",
    title: "Questions fréquentes",
    subtitle: "Une autre question ? Choisissez « Poser une question » dans le formulaire plus bas.",
    activityQ: "Ça marche pour mon activité ?",
    activityA:
      "Oui. Les disciplines sont les vôtres : yoga, boxe, pilates, escalade, danse, CrossFit, running… Chacune a sa couleur, sa durée et ses places par défaut, et une offre peut viser certaines disciplines seulement.",
    appQ: "Mes adhérents ont besoin d'une application ?",
    appA: "Oui. Dans l'app {brand}, ils réservent, rejoignent une liste d'attente, paient leur abonnement ou un carnet et suivent leurs crédits. Le planning reste consultable sans compte.",
    paymentsQ: "Quels moyens de paiement sont acceptés ?",
    paymentsA:
      "En ligne avec Stripe : carte bancaire, Apple Pay, Google Pay et prélèvement SEPA pour les abonnements. Les ventes sur place (espèces, terminal) s'enregistrent dans le back office.",
    rejectedQ: "Et si un prélèvement est rejeté ?",
    rejectedA:
      "L'abonnement passe en impayé et les réservations sont suspendues jusqu'au règlement. {brand} relance l'adhérent à J+3 et J+7 et l'invite à mettre à jour son moyen de paiement ; l'accueil peut aussi le relancer à la main.",
    offersQ: "Quelles offres sont possibles ?",
    offersA:
      "Abonnements illimités avec ou sans engagement, carnets avec date de validité, séances à l'unité ou d'essai, offres réservées à certaines disciplines, tarifs réduits et codes promo.",
    coachesQ: "Comment sont comptées les heures des coachs ?",
    coachesA:
      "À partir des séances réalisées : durée multipliée par le taux horaire, pour chaque coach d'un cours. L'export CSV par coach sert de base à leur facture.",
    assistantQ: "L'assistant agit seul ?",
    assistantA:
      "Non. Il lit les données avec les droits du gérant, propose des messages et des segments, et rien ne part sans validation. Les notes « à savoir » ne lui sont jamais transmises.",
    rolesQ: "Qui voit quoi dans l'équipe ?",
    rolesA:
      "Le gérant voit tout. L'accueil gère réservations, fiches adhérents et relances d'impayés, sans accès aux finances de la salle. Un coach voit son planning, ses cours et ses inscrits.",
    dataQ: "Mes données restent à moi ?",
    dataA:
      "Oui. Les adhérents et les paiements s'exportent en CSV à tout moment, et chaque export est inscrit au journal.",
    marketplaceQ: "À quoi sert la marketplace ?",
    marketplaceA:
      "C'est un catalogue de matériel, de consommables et de services négociés pour les salles du réseau, avec des prix par palier et des achats groupés : plus les salles s'engagent, plus le prix baisse.",
    priceQ: "Combien coûte {brand} ?",
    priceA:
      "L'essai est gratuit, sans carte bancaire. Ensuite, le tarif dépend de la taille de votre salle : nous vous le communiquons avant toute facturation.",
  },
  start: {
    eyebrow: "Commencer",
    title: "Créez votre salle sur {brand}",
    body: "Laissez vos coordonnées : nous ouvrons votre accès et vous aidons à paramétrer la salle. Une question avant de vous lancer ? Choisissez « Poser une question ».",
    free: "Essai gratuit, sans carte bancaire",
    export: "Vos données restent exportables en CSV",
    contactOnly: "Vos coordonnées servent uniquement à vous recontacter",
  },
  form: {
    kind: "Votre demande",
    kinds: {
      trial: "Créer ma salle",
      contact: "Poser une question",
    },
    fullName: "Nom et prénom",
    gymName: "Nom de la salle",
    email: "Email",
    phone: "Téléphone",
    city: "Ville",
    membersBand: "Nombre d'adhérents",
    currentTool: "Outil actuel",
    message: "Message",
    optional: "facultatif",
    choose: "Choisir",
    bands: {
      under_100: "Moins de 100",
      "100_to_300": "De 100 à 300",
      "300_to_600": "De 300 à 600",
      over_600: "Plus de 600",
    },
    emailPlaceholder: "nom@salle.fr",
    toolPlaceholder: "Bsport, Deciplus, tableur…",
    messagePlaceholder: "Disciplines, nombre de sites, ce qui vous prend le plus de temps…",
    questionPlaceholder: "Votre question",
    submit: {
      trial: "Créer ma salle",
      contact: "Envoyer ma question",
    },
    pending: "Envoi en cours…",
    privacyBefore: "Vos informations servent uniquement à vous recontacter. Voir la",
    privacyLink: "politique de confidentialité",
    errors: {
      fullName: "Indiquez votre nom (2 caractères au moins).",
      gymName: "Indiquez le nom de votre salle.",
      email: "Saisissez un email valide, par exemple nom@salle.fr.",
      phone: "Saisissez un numéro valide ou laissez le champ vide.",
      city: "Indiquez la ville de votre salle.",
      membersBand: "Choisissez le nombre d'adhérents.",
      currentTool: "80 caractères au plus.",
      message: "Écrivez votre message, en 1000 caractères au plus.",
      form: "Vérifiez les champs signalés.",
      tooMany: "Trop de demandes en peu de temps. Réessayez dans une heure.",
      unavailable: "L'envoi n'a pas abouti. Réessayez dans quelques minutes.",
    },
    success: {
      trialTitle: "Demande envoyée",
      trialBody: "Nous vous écrivons à {email} pour ouvrir votre accès.",
      contactTitle: "Question envoyée",
      contactBody: "Nous vous répondons à {email}.",
    },
    again: "Envoyer une autre demande",
  },
  footer: {
    tagline: "La gestion de salle de sport avec l'IA native, pour toutes les activités.",
    product: "Produit",
    contact: "Contact",
    legal: "Informations",
    privacy: "Confidentialité",
    legalNotice: "Mentions légales",
    copyright: "© {year} {brand}",
  },
  legal: {
    back: "Retour à l'accueil",
    toComplete: "à compléter",
    notice: {
      title: "Mentions légales",
      description: "Éditeur et hébergeur du site {brand}.",
      publisherTitle: "Éditeur",
      company: "Raison sociale",
      address: "Adresse",
      siren: "SIREN",
      director: "Directeur de la publication",
      contact: "Contact",
      hostTitle: "Hébergement",
      host: "Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, USA.",
    },
    privacy: {
      title: "Politique de confidentialité",
      description: "Données recueillies par le formulaire du site {brand} et vos droits.",
      collectedTitle: "Données collectées",
      collected:
        "Le formulaire du site recueille votre nom, le nom de votre salle, votre email et, selon votre demande, sa ville, sa taille, votre téléphone, votre outil actuel et votre message. Aucune autre donnée n'est collectée sur ce site.",
      purposeTitle: "Finalité et base légale",
      purpose:
        "Ces informations servent uniquement à ouvrir votre accès d'essai et à répondre à vos questions. Le traitement repose sur votre demande, avant tout contrat.",
      recipientsTitle: "Destinataires",
      recipients:
        "Seule l'équipe {brand} y a accès. Elles sont hébergées par nos prestataires techniques, Supabase (base de données) et Vercel (site), qui agissent pour notre compte.",
      retentionTitle: "Durée de conservation",
      retention: "Une demande restée sans suite est effacée trois ans après le dernier échange.",
      cookiesTitle: "Cookies",
      cookies: "Ce site ne dépose aucun cookie et n'utilise aucun outil de mesure d'audience.",
      rightsTitle: "Vos droits",
      rights:
        "Vous pouvez accéder à vos données, les faire rectifier ou effacer et vous opposer à leur traitement en écrivant à l'adresse suivante : {email}. Vous pouvez aussi saisir la CNIL (cnil.fr).",
    },
  },
  notFound: {
    title: "Cette page n'existe pas",
    eyebrow: "Erreur 404",
    body: "Le lien a sans doute changé. Toute la présentation de {brand} se trouve sur la page d'accueil.",
    back: "Retour à l'accueil",
  },
};
