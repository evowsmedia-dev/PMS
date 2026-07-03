# Safe Change Workflow

Before changing files:

- Read `AGENTS.md`.
- Read the relevant `.codex/rules/*` files.
- Check `git status --short`.
- Inspect nearby code and follow existing patterns.
- For Next.js behavior, read the relevant local docs in
  `node_modules/next/dist/docs/`.

Editing rules:

- Keep changes scoped to the user request.
- Do not revert user changes unless explicitly asked.
- Use `apply_patch` for manual edits.
- Do not use destructive git commands.
- Do not update generated files unless generation is part of the requested or
  necessary workflow.
- Avoid unrelated refactors.

Implementation rules:

- Prefer existing helpers and patterns over new abstractions.
- Add validation with existing Zod schemas or nearby validation style.
- Keep server-side auth and RBAC checks close to protected operations.
- Add audit logs for mutations.
- Revalidate the paths affected by Server Actions.

Communication:

- State blockers plainly.
- Report commands that could not be run.
- Keep final summaries focused on changed files, verification, and remaining
  risk.

