/**
 * Heure courante pour les Server Components. Ils sont rendus une fois par requête : lire
 * l'horloge y est voulu (la règle « pureté » de React vise les re-rendus côté client).
 */
export function currentTime(): Date {
  return new Date();
}
