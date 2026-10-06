/** Email de confirmation de la liste d'attente (envoyé par Resend, lib/email.ts). */
import { brand, launch, pricing } from "./landing";

export const confirmationEmail = {
  subject: `Vous êtes sur la liste d'attente de ${brand.name}`,
  greeting: "Bonjour,",
  intro: `Merci pour votre inscription : votre salle est sur la liste d'attente de ${brand.name}.`,
  pitch: `${brand.name} est un logiciel de gestion de salle de sport assisté par l'intelligence artificielle : planning et réservations, paiements, CRM et marketplace d'achats.`,
  nextTitle: "Ce qui vous attend :",
  next: [
    `un accès prioritaire au lancement, prévu ${launch.label} ;`,
    `le ${pricing.label.toLowerCase()} de ${pricing.display} par mois ${pricing.audience}.`,
  ],
  outro: "Nous vous écrirons avant le lancement. Une question ? Répondez simplement à cet email.",
  signature: `L'équipe ${brand.name}`,
  footer: `Vous recevez cet email car vous avez rejoint la liste d'attente sur ${brand.domain}. Pour ne plus rien recevoir, répondez « désinscription » à cet email.`,
} as const;
