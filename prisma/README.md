# Schéma Prisma (référence)

`schema.prisma` reproduit à l'identique le schéma Postgres actuel du backend
(schéma `public`) : 23 modèles, colonnes, types, valeurs par défaut, clés
étrangères en cascade, index et contraintes d'unicité.

## Ce que ce fichier est

- Une **documentation exécutable** du modèle de données.
- Une base de départ si l'on veut un jour exposer ce Postgres via une API
  Node.js/Prisma.

## Ce que ce fichier n'est pas

- Il **ne remplace pas** la base actuelle et ne change rien au fonctionnement de
  l'application. L'app est une SPA React/Vite : elle interroge le backend via le
  client HTTP, avec RLS, auth, storage, realtime et Edge Functions.
- `PrismaClient` **ne doit jamais** être importé dans `src/` : il nécessite un
  runtime Node.js et une chaîne de connexion Postgres, qui ne peut pas être
  exposée au navigateur.

## Éléments non modélisés (volontairement)

- Le schéma `auth` (`auth.users`) : `profiles.id` et tous les `user_id` y
  réfèrent, mais ces schémas système ne sont pas gérés par Prisma.
- Les **politiques RLS**, les triggers (`updated_at`, création de profil), les
  jobs `pg_cron` et la fonction `verify_share_password` : Prisma ne les décrit
  pas. Ils restent définis dans `supabase/migrations/`.

## Commandes utiles (hors navigateur)

```bash
export DATABASE_URL="postgresql://..."   # jamais commité
npx prisma validate
npx prisma db pull      # re-synchroniser depuis la base réelle
npx prisma generate     # générer le client (backend Node uniquement)
```
