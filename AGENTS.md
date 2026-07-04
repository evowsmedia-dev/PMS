# PMS Agent Instructions

This project uses Next.js 16 with breaking changes. APIs, conventions, runtime
behavior, and file structure may differ from older Next.js versions. Before
editing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`
and heed deprecation notices.

Repo-specific Codex rules live in `.codex/rules/`. Read the relevant rule files
before making changes:

- `00-project-overview.md`
- `01-nextjs-16.md`
- `02-running-and-env.md`
- `03-prisma-database.md`
- `04-auth-rbac-audit.md`
- `05-frontend-ui.md`
- `06-docs-and-spec.md`
- `07-safe-change-workflow.md`
- `08-deploy-verification.md`

`.claude/rules/` may describe the old static prototype. Do not let those files
override the current Next.js + Prisma application structure unless the user is
explicitly asking about the prototype.

## Reporting and Verification

Before saying a task is done, point to concrete results that prove it, such as
the changed files, commit hash, pushed branch, command output, or specific UI
state that was verified.

Only report claims that can be backed by evidence from the workspace, commands,
tests, builds, screenshots, logs, commits, or direct inspection.

If something has not been verified, say that plainly instead of guessing or
implying it is complete.
