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
- For UI/layout/design changes that the user expects to see on production,
  local verification is not enough. The change must be committed, pushed to the
  deployment branch, and checked after the production deployment finishes.
- For Prisma schema changes, run `npx prisma generate` and use the appropriate
  local database workflow.
- For production-like verification, ensure database env vars are set before
  running `npm run build`, because the build script deploys migrations.

Deployment notes:

- Production deploys from `origin/main`. A change in the local working tree is
  not visible on the production site until it is committed and pushed.
- Vercel deployment needs `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`,
  `NEXTAUTH_SECRET`, and Blob configuration.
- `BLOB_READ_WRITE_TOKEN` is required for attachment/image uploads and for
  streaming private Blob files through `/api/blob`.
- Seed production once after first deploy when needed.
- Do not wire seed into the build pipeline.

Production visibility workflow:

- Before claiming a UI/layout/design change is done for production, confirm
  `git status --short --branch`.
- If the intended production change is uncommitted, create a focused commit.
- Push the commit to `origin/main`.
- Verify the deployment target after push when network/tool access is
  available. Prefer the deployment provider status or the production URL.
- If deployment verification cannot be performed, say that plainly and report
  the pushed commit hash.

Risk checks:

- Confirm RBAC behavior for admin and project roles.
- Confirm soft-deleted records stay hidden from user-facing pages.
- Confirm document saves create versions, while autosave does not.
- Confirm upload paths fail gracefully when Blob is not configured.
- Confirm private Blob uploads do not request public access and uploaded images
  render through the authenticated `/api/blob?url=...` proxy.
