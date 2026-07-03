# Docs And Spec

Relevant docs:

- `README.md`: current setup, deployment, and architecture notes.
- `docs/REQUIREMENTS_PHASE1.md`: MVP functional requirements.
- `docs/PMS sitemap.txt`: intended route/page tree and page behavior.
- `docs/DESIGN_new.md`: current visual direction.
- `docs/Design_rule.md`: legacy TNG green design reference.
- `docs/PMS index.html`: old static prototype and historical UI reference.

How to use docs:

- For implementation details, prefer current code and README.
- For expected product behavior, cross-reference requirements and sitemap.
- For visual decisions, follow `docs/DESIGN_new.md` and existing UI components.
- Treat the old HTML prototype as reference, not as the current architecture.

When requirements and current code disagree:

- Do not silently rewrite architecture to match old docs.
- Identify the gap.
- Make the smallest change that satisfies the current user request.
- Mention assumptions in the final response when the difference matters.

When adding a feature:

- Check whether the route already exists in `src/app`.
- Check whether the related Server Action or Route Handler already exists.
- Check `src/lib/rbac.ts` for permissions.
- Check Prisma schema before assuming data shape.
