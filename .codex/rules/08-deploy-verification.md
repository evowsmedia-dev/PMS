# Deploy And Verification

Scripts:

- `npm run dev`: start local Next dev server.
- `npm run build`: `prisma generate && prisma migrate deploy && next build`.
- `npm run start`: start production server after build.
- `npm run lint`: ESLint.

Verification expectations:

- For simple documentation-only changes, no app verification is required beyond
  checking file content.
- For TypeScript/React changes, run `npm run lint` when feasible.
- For Prisma schema changes, run `npx prisma generate` and use the appropriate
  local database workflow.
- For production-like verification, ensure database env vars are set before
  running `npm run build`, because the build script deploys migrations.

Deployment notes:

- Vercel deployment needs `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`,
  `NEXTAUTH_SECRET`, and Blob configuration.
- `BLOB_READ_WRITE_TOKEN` is required for attachment uploads.
- Seed production once after first deploy when needed.
- Do not wire seed into the build pipeline.

Risk checks:

- Confirm RBAC behavior for admin and project roles.
- Confirm soft-deleted records stay hidden from user-facing pages.
- Confirm document saves create versions, while autosave does not.
- Confirm upload paths fail gracefully when Blob is not configured.

