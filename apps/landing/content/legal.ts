/**
 * Mentions légales et politique de confidentialité de la landing.
 *
 * Les champs « À COMPLÉTER » attendent les informations de l'éditeur (BRIEF §11) : tant qu'il en
 * reste, le build de production échoue (lib/launch-guard.ts). Texte à relire par l'éditeur avant
 * la mise en ligne.
 */
import { brand } from "./landing";

export const TODO = "À COMPLÉTER";

export type LegalSection = { title: string; paragraphs: readonly string[] };
export type LegalPage = {
  title: string;
  description: string;
  updated: string;
  sections: readonly LegalSection[];
};

export const legalNotice: LegalPage = {
  title: "Mentions légales",
  description: `Éditeur, hébergeur et contact du site ${brand.domain}.`,
  updated: "6 octobre 2026",
  sections: [
    {
      title: "Éditeur du site",
      paragraphs: [
        `Le site ${brand.domain} est édité par ${TODO} (raison sociale, forme juridique et capital).`,
        `Siège social : ${TODO}. Immatriculation (RCS et SIREN) : ${TODO}. TVA intracommunautaire : ${TODO}.`,
        `Contact : ${brand.contactEmail}.`,
      ],
    },
    {
      title: "Directeur de la publication",
      paragraphs: [`${TODO} (nom et qualité).`],
    },
    {
      title: "Hébergement",
      paragraphs: [
        "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (vercel.com).",
      ],
    },
    {
      title: "Propriété intellectuelle",
      paragraphs: [
        `Les textes, le logo ${brand.name} et la mise en page de ce site sont protégés. Toute reproduction sans autorisation écrite de l'éditeur est interdite.`,
      ],
    },
  ],
};

export const privacyPolicy: LegalPage = {
  title: "Confidentialité",
  description: `Données collectées par la liste d'attente de ${brand.name}, finalité, durée et vos droits.`,
  updated: "6 octobre 2026",
  sections: [
    {
      title: "Responsable du traitement",
      paragraphs: [
        `L'éditeur du site (voir les mentions légales), joignable à ${brand.contactEmail}.`,
      ],
    },
    {
      title: "Données collectées",
      paragraphs: [
        "Quand vous rejoignez la liste d'attente : votre adresse email, la date et le texte de votre consentement, le formulaire utilisé et, le cas échéant, la campagne qui vous a amené (paramètres UTM de l'adresse de la page).",
        "Pour limiter les abus, une empreinte chiffrée et non réversible de votre adresse IP est conservée une heure au plus. Votre adresse IP elle-même n'est pas enregistrée.",
      ],
    },
    {
      title: "Finalité et base légale",
      paragraphs: [
        `Vous informer du lancement de ${brand.name} et du tarif fondateur. Le traitement repose sur votre consentement, que vous pouvez retirer à tout moment.`,
      ],
    },
    {
      title: "Durée de conservation",
      paragraphs: [
        "Jusqu'au retrait de votre consentement, et au plus trois ans après notre dernier échange.",
      ],
    },
    {
      title: "Destinataires",
      paragraphs: [
        `Vos données ne sont ni vendues ni cédées. Elles sont traitées pour notre compte par nos prestataires techniques : Supabase (base de données, ${TODO} : région d'hébergement), Resend (envoi des emails) et Vercel (hébergement du site). ${TODO} : encadrement des transferts hors de l'Union européenne.`,
      ],
    },
    {
      title: "Mesure d'audience",
      paragraphs: [
        "Le site utilise Vercel Web Analytics, sans cookie et sans identifiant personnel : seules des statistiques agrégées sont produites. Aucun cookie n'est déposé sur votre appareil.",
      ],
    },
    {
      title: "Vos droits",
      paragraphs: [
        `Vous pouvez accéder à vos données, les rectifier, les effacer, vous opposer à leur traitement ou retirer votre consentement en écrivant à ${brand.contactEmail}. Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).`,
      ],
    },
  ],
};

/** Champs encore à compléter, par page (utilisé par la garde de mise en production). */
export function legalPlaceholders(): string[] {
  return [legalNotice, privacyPolicy].flatMap((page) =>
    page.sections
      .filter((section) => section.paragraphs.some((p) => p.includes(TODO)))
      .map((section) => `${page.title} › ${section.title}`),
  );
}
