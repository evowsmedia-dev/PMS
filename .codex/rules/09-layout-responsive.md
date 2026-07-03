# Layout And Responsive Rules

Source of truth:

- Follow `docs/DESIGN_new.md` for visual language.
- Treat `1200px` as the maximum app canvas, not the default width for every
  screen.

Width tiers:

- `compact` (`max-w-[640px]`): create/edit/settings/profile forms.
- `reading` (`max-w-[820px]`): document prose and long-form review surfaces.
- `standard` (`max-w-[1040px]`): dashboards, card lists, activity feeds.
- `data` (`max-w-[1200px]`): tables, admin lists, document lists.
- `board` (`max-w-[1200px]`): kanban and horizontally scrolling work boards.

Implementation:

- Use `PageShell`, `PageSection`, `PageToolbar`, and `ResponsiveTableFrame`
  from `src/components/page-shell.tsx` before creating one-off wrappers.
- Do not put app pages directly in unconstrained `w-full` surfaces unless the
  screen is intentionally scrollable, such as a board.
- Keep detail pages as `main + aside` grids only on desktop. On mobile, stack
  the aside below the main content.
- Keep project navigation in the desktop sidebar and a mobile sheet/drawer.
- Tables must live in a bordered overflow frame with a stable `min-width`.
- Kanban columns must use fixed column widths and horizontal scroll; do not
  use `flex-1` columns that expand across wide screens.

Responsive behavior:

- `<640px`: single-column layouts, wrapped toolbar actions, mobile navigation
  sheet, horizontal scroll for tables and boards.
- `640-1023px`: use two columns only for card/list surfaces that remain
  scannable; keep detail pages stacked.
- `>=1024px`: enable sidebar/detail grids while preserving the chosen width
  tier.
- `>=1280px`: do not exceed the `1200px` app canvas.

Text and stability:

- Apply `min-w-0`, `truncate`, or `line-clamp` to long names in cards, rows,
  headers, and navigation items.
- Repeated cards, counters, columns, and toolbars should have stable dimensions
  so hover, loading, and state changes do not resize the layout.
