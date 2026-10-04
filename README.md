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

Créés par `supabase/seed.sql`, mot de passe commun `demo1234` (base locale uniquement).

| Compte | Rôle |
| --- | --- |
| `gerant@demo.local` | gérant |
| `admin@demo.local` | admin |
| `accueil@demo.local` | accueil |
| `coach1@demo.local` … `coach6@demo.local` | coachs |
| `adherent@demo.local` | adhérent avec abonnement illimité |
