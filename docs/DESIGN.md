# Design tokens

Source of truth: `tailwind.config.js` (colors) and the class patterns used
in `app/` and `components/`. Keep new UI consistent with these rather than
introducing new values.

## Color

| Token       | Hex       | Use                                   |
|-------------|-----------|----------------------------------------|
| `bg`        | `#0b0e1a` | page background                        |
| `panel`     | `#131729` | cards, sidebar background              |
| `panel2`    | `#171c33` | nested surfaces (tool cards, chips)     |
| `border`    | `#252b45` | all hairline borders                    |
| `text`      | `#e8eaf3` | primary text                            |
| `muted`     | `#8891ab` | secondary text, labels, timestamps      |
| `accent`    | `#6c8bff` | primary actions, active nav, Tools/JSON |
| `accent2`   | `#3ecf8e` | Notes accent                            |
| `accent3`   | `#b17cff` | Links accent                            |
| `accent4`   | `#ff9f5a` | Timestamp tool accent                   |

Each of the four sections (Tools, Notes, Links, plus a general "primary")
has its own accent — reuse `accent`/`accent2`/`accent3`/`accent4` rather
than inventing a fifth unless a genuinely new section is added.

## Radius

- `rounded-card` (14px) — panels/cards
- `rounded-xl` — tool cards
- `rounded-lg` — buttons, inputs
- `rounded-[9px]` — nav items, small icon badges

## Type

System font stack (Tailwind default `font-sans`). Sizes used:
- `text-[15px] font-semibold` — panel titles
- `text-sm font-semibold` — item titles
- `text-[13.5px]` — form inputs/buttons
- `text-[12.5px]` / `text-xs` — labels, secondary text
- `text-[11px]` — timestamps, tag chips

## Layout

The app is a fixed-height shell (`h-screen overflow-hidden`) with independently
scrolling panes: the two sidebars stay pinned and only the content column
scrolls.

- **Primary sidebar** (`components/Sidebar.js`): fixed-width flex column
  (`w-64`, collapses to `w-16`), `bg-panel`, border-right, nav items stacked,
  collapse toggle pinned to the bottom via a `flex-1` spacer.
- **Sub-sidebar** (`components/SubSidebar.js`): the optional second sidebar,
  one per section, sitting between the primary nav and the content. `w-60` and
  `bg-panel2` so it reads as a nested context panel rather than a second nav.
  Its header is the section title plus an optional compact `SubAction` button;
  below it a stack of `SubItem` rows (icon, label, optional sub-line, active
  state).
  - Tools: lists the 5 tools; the selected tool renders inline in the content
    pane (no modal, no card grid).
  - Notes / Links: lists the section's entries; the selected entry renders in
    the content pane as a detail card.
- **Content** (`ContentPane`): `flex-1 min-w-0 overflow-y-auto` with generous
  padding (`px-6 py-7 pb-16`). No max-width cap — the dashboard should fill the
  window at any desktop size.
- **Home** has no sub-sidebar; it renders inside a bare `ContentPane`.
- Cards: `bg-panel border border-border rounded-card`, consistent internal
  padding (`px-4.5 pt-4.5 pb-2` for list panels, `px-4.5 pt-4.5 pb-4.5` for
  detail panels, `p-4.5` for stat cards).

## Spacing

Tailwind's default scale is used, plus one custom step in
`tailwind.config.js`:

- `4.5` (1.125rem / 18px) — the standard card padding (`p-4.5`, `px-4.5`,
  `pt-4.5`) and panel gap (`mb-4.5`).

Note that Tailwind's *default* scale stops at `3.5` and then jumps to `5`;
`4.5` only exists because it is declared in the config. Don't use `4.5` in
inline styles or new files without checking it resolves.
- Stat cards on Home: 3-column grid on desktop, stacks to 1 column on mobile.

## Motion

Minimal — only the sidebar width transition (`transition-all duration-150`)
and hover states (`hover:border-accent`, `hover:brightness-110`). Don't add
entrance animations or hover effects beyond border/background color changes;
it would clash with the current restrained feel.
