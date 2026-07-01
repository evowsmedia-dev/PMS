# ERP Document Hub

Multi-project document & task management app — Next.js (App Router) + PostgreSQL (Prisma) + NextAuth + Vercel Blob.

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4, shadcn/ui (green theme per `docs/Design_rule.md` in the repo root)
- PostgreSQL via Prisma 7 (driver-adapter architecture — `@prisma/adapter-pg`)
- NextAuth.js v5 (Credentials provider, JWT sessions)
- Vercel Blob for file attachments
- `@dnd-kit` (module sidebar + Kanban drag-and-drop), `react-markdown` (document rendering), `zod` (validation)

## Local development

1. Install dependencies: `npm install`
2. Start a local Postgres dev database: `npx prisma dev -d` — prints a `DATABASE_URL`. Put it (plus a `SHADOW_DATABASE_URL` if using `prisma migrate dev`) into `.env`.
3. Push the schema: `npx prisma db push` (or `npx prisma migrate dev` once pointed at a real Postgres — see note below).
4. Generate the Prisma Client: `npx prisma generate`
5. Seed an admin user + the "Kho RFID" template: `npx prisma db seed` (uses `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars if set, otherwise defaults to `admin@example.com` / `ChangeMe123!`).
6. `npm run dev` and open `http://localhost:3000`.

**Note on `prisma migrate dev` locally**: `npx prisma dev`'s bundled database is a WASM-compiled Postgres that the Prisma Migrate engine's shadow-database workflow doesn't reliably support (`P1017`/connection-closed errors), even though normal queries and `prisma db push` work fine against it. Use `db push` for local schema iteration against that database. The real baseline migration lives in `prisma/migrations/` (generated via `prisma migrate diff --from-empty --to-schema=prisma/schema.prisma --script`, no live DB needed) and `prisma migrate deploy` works normally against a real Postgres (Neon, or any standard Postgres/Docker) — this is a local dev-database quirk only, not a schema or migration-file problem.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (pooled, for the app at runtime) |
| `DIRECT_URL` | Postgres direct connection string (non-pooled, for migrations) |
| `SHADOW_DATABASE_URL` | Only needed for `prisma migrate dev` locally |
| `NEXTAUTH_URL` | Canonical app URL (e.g. `http://localhost:3000` or the Vercel deployment URL) |
| `NEXTAUTH_SECRET` | JWT signing secret — generate with `openssl rand -base64 32` |
| `BLOB_READ_WRITE_TOKEN` | Auto-injected by Vercel when a Blob store is linked to the project |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Optional, used only by `prisma/seed.ts` |

## Deploying to Vercel

1. **Database**: create a [Neon](https://neon.tech) Postgres project (Vercel's Neon Marketplace integration can provision this automatically and wire up env vars, including a separate Neon branch per Preview deployment). Set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) in the Vercel project's environment variables.
2. **Build command**: set the project's build command to run migrations before building:
   ```
   prisma generate && prisma migrate deploy && next build
   ```
   (or add this as the `"build"` script in `package.json` so Vercel's default `npm run build` picks it up).
3. **Auth**: set `NEXTAUTH_SECRET` and `NEXTAUTH_URL` per Vercel environment (Production/Preview).
4. **Blob storage**: enable Vercel Blob from the dashboard and link it to the project — this auto-injects `BLOB_READ_WRITE_TOKEN`, required for document attachments (`/api/upload`).
5. **Seed data**: after the first successful deploy, run the seed once against the production database (`ADMIN_EMAIL=... ADMIN_PASSWORD=... DATABASE_URL=<prod-url> npx prisma db seed`, run locally with the Vercel-provided `DATABASE_URL`, or via `vercel env pull` + local run). Do not wire seeding into the build pipeline — it should not re-run on every deploy.
6. Runtime: all Prisma-touching Route Handlers/Server Actions run on the Node.js runtime (default); `src/proxy.ts` (the renamed Next.js 16 middleware) also defaults to the Node.js runtime and only does a lightweight session/role check, no DB calls.

## Architecture notes

- **RBAC**: `src/lib/rbac.ts` (`can()`) is the single source of truth for the permission matrix (`SystemRole` for `/admin/*` and template management, `ProjectRole` for everything else). Every Server Action and Route Handler re-checks `can()` server-side — UI-level hiding of buttons is never the only gate.
- **Document versioning**: `Document.currentContent` is denormalized for fast reads; every explicit Save creates a new `DocumentVersion` row (full snapshot). Autosave only updates `currentContent`, it does not create version spam.
- **Audit log**: `src/lib/audit.ts` (`logAudit()`) is called explicitly at every mutation site — not an implicit Prisma middleware — so each entry carries a meaningful, human-readable action/entity/metadata for `/admin/logs` and the Activity Feed (`src/components/activity-feed.tsx`, shared between the dashboard widget and the full `/dashboard/activity` page).
- **Templates**: `prisma/rfid-template.ts` holds the "Kho RFID" document-set structure (transliterated from the original static prototype). New projects are seeded from `Template.structure` (JSON) inside a single Prisma transaction in `createProjectAction` (`src/lib/actions/projects.ts`).
