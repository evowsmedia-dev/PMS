# Frontend UI Rules

Design direction:

- Follow `docs/DESIGN_new.md`.
- PMS is enterprise/project-management software: dense, clear, practical, and
  easy to scan.
- Avoid marketing-page composition for in-app work surfaces.
- Apply the new strict monochrome system: chalk white canvas, graphite/black
  text, hairline gray borders, and one black filled primary action per visual
  region.
- Do not introduce chromatic accent colors for app chrome, status, priority,
  destructive, error, quote, or comment UI. Use text, icons, borders, and gray
  surfaces to communicate state.

Stack:

- Tailwind CSS v4.
- shadcn/ui style primitives in `src/components/ui`.
- Radix UI under the UI components.
- lucide-react icons.

Component rules:

- Reuse existing UI primitives before creating new ones.
- Use lucide icons for buttons where a standard icon exists.
- Keep cards for repeated items, modals, and genuinely framed tools.
- Avoid nesting cards inside cards.
- Use 1px `#e5e5e5` borders as the main separator. Avoid box shadows for
  elevation.
- Use 10px radius for buttons, inputs, and nav items; 14px for cards; 26px for
  tags/badges; 9999px only for true pills.
- Keep controls feature-complete for expected workflows: disabled states, empty
  states, loading/skeleton states, errors, and confirmation for destructive
  actions where appropriate.

Layout rules:

- Text must not overflow or overlap on mobile or desktop.
- Use stable dimensions for toolbars, boards, grids, counters, and repeated
  tiles so state changes do not cause layout jumps.
- Do not scale font sizes with viewport width.
- Keep UI text letter spacing at `0`; use tight tracking only for intentional
  display-scale headings.

Client/server split:

- Prefer Server Components for data fetching.
- Use Client Components only for interaction, local state, effects, drag/drop,
  browser APIs, or optimistic UI.
