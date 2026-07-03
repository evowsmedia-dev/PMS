# Next.js 16 Rules

This is a Next.js 16 project. Do not rely on older Next.js assumptions.

Before editing Next-specific code, read the relevant local docs in
`node_modules/next/dist/docs/`, especially when touching:

- App Router pages and layouts: `01-app/01-getting-started/02-project-structure.md`
  and related file-convention docs.
- Server Components and Client Components.
- Server Actions and forms.
- Route Handlers.
- Caching, revalidation, redirects, and navigation.
- Proxy behavior.

Project conventions:

- Routes live under `src/app`.
- Route groups such as `(auth)`, `(dashboard)`, and `(admin)` do not affect URLs.
- `src/proxy.ts` is the request proxy. In Next.js 16, Middleware is called Proxy.
- Keep Proxy lightweight. It should only do optimistic auth/role redirects, not
  slow database workflows.
- Route Handler params may be asynchronous in this project pattern. Preserve the
  existing `context: { params: Promise<...> }` style unless the local Next docs
  and surrounding code justify a change.
- Use `redirect`, `revalidatePath`, and Route Handler responses according to the
  current local docs, not memory from older Next.js versions.

When adding routes:

- Match the existing App Router file conventions.
- Keep server-only data access in Server Components, Server Actions, or Route
  Handlers.
- Add `"use client"` only when interactivity, state, effects, browser APIs, or
  client event handlers require it.

