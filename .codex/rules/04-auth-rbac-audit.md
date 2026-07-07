# Auth RBAC Audit

Authentication:

- NextAuth v5 is configured in `src/lib/auth.ts`.
- Credentials provider authenticates by email/password.
- Sessions use JWT.
- Login updates `lastLoginAt` and writes an audit log.

Authorization:

- `src/lib/rbac.ts` defines the RBAC actions, default project-role grants, and
  normalization for the editable permission matrix.
- Runtime project-role checks should use async `canAccess()` so changes saved in
  system setting `rolePermissionMatrix` apply across the app.
- `src/lib/project-role.ts` resolves project membership role.
- System `ADMIN` bypasses project role checks through RBAC helpers.
- Template management and admin access are system-admin only.
- The role-permission matrix is editable at `/admin/settings`; `admin.access`
  and `template.manage` remain system-admin only.

Required rule:

- Every Server Action and Route Handler that reads or mutates protected data must
  check the session and server-side permissions.
- UI hiding is only a convenience; it is never the authorization boundary.
- When adding a new action, decide whether it needs a new `Action` in
  `src/lib/rbac.ts` or can reuse an existing permission. Add user-facing labels
  and editable default grants when the action should be configurable in
  `/admin/settings`.

Audit:

- `src/lib/audit.ts` writes explicit audit entries.
- Mutation sites should call `logAudit()` with meaningful action, entity type,
  entity id, project id when relevant, and useful metadata.
- Audit logs are not Prisma middleware, so new mutations must add audit logging
  deliberately.
- AI/batch task generation from documents must reuse `task.create`, respect the
  caller's document/module visibility, preview proposals before persistence,
  avoid duplicate active tasks for the same source document/section, and write
  audit metadata with created/skipped counts.

Security notes:

- Never trust route params or form data without validating and checking ownership.
- For project-scoped resources, verify the resource belongs to the project/module
  implied by the route before mutating it.
- Avoid returning sensitive details in auth errors.
