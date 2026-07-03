# Project Overview

PMS is a multi-project document and task management application.

Current implementation:

- Next.js 16 App Router under `src/app`.
- React 19, TypeScript, Tailwind CSS v4, shadcn/ui style components.
- PostgreSQL through Prisma 7 and `@prisma/adapter-pg`.
- NextAuth v5 Credentials provider with JWT sessions.
- Vercel Blob for document attachments.
- Server Actions in `src/lib/actions`.
- Route Handlers in `src/app/api`.

Primary source of truth:

- `package.json` for scripts and dependencies.
- `README.md` for setup, local development, deployment, and architecture notes.
- `src/` for the actual application.
- `prisma/schema.prisma` and `prisma/migrations/` for database shape.
- `docs/DESIGN_new.md` for visual direction.

Important context:

- `docs/PMS index.html` is an old static prototype/reference artifact.
- `.claude/rules/` can describe that older prototype and may be stale for the
  current app.
- Prefer current code and README over old prototype-specific notes.
