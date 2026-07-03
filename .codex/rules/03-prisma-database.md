# Prisma And Database

This project uses Prisma 7 with the driver-adapter architecture.

Key files:

- `prisma/schema.prisma`
- `prisma.config.ts`
- `prisma/migrations/`
- `prisma/seed.ts`
- `src/lib/prisma.ts`
- `src/generated/prisma/`

Project conventions:

- Prisma Client is generated to `src/generated/prisma`.
- The runtime client uses `PrismaPg` from `@prisma/adapter-pg`.
- `src/lib/prisma.ts` owns the shared Prisma client instance.
- Do not import Prisma directly from `@prisma/client`; follow existing imports
  from `@/generated/prisma/...`.

Local schema iteration:

- With `npx prisma dev -d`, prefer `npx prisma db push` for local schema changes.
- The README notes that Prisma Migrate shadow database workflows can be unreliable
  against the bundled local dev database.

Migrations:

- Production deployment uses `prisma migrate deploy`.
- Do not edit existing migration files casually.
- For schema changes, update `prisma/schema.prisma`, create an intentional
  migration when appropriate, and run `npx prisma generate`.
- Keep generated Prisma output out of source control unless the repo policy
  changes.

Data model patterns:

- Many domain records use soft deletion through `deletedAt`.
- Keep queries scoped to `deletedAt: null` where user-facing active records are
  expected.
- Preserve explicit versioning for documents: saved edits create
  `DocumentVersion`; autosave only updates `Document.currentContent`.

