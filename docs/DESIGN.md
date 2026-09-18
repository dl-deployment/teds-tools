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
| `accent`    | `#6c8bff` | primary actions, active nav, Tools + Text Tools |
| `accent2`   | `#3ecf8e` | Notes + Assets Tools accent             |
| `accent3`   | `#b17cff` | Links + Static Pages accent             |
| `accent4`   | `#ff9f5a` | Color Tools accent (and the Timestamp tool) |

Each of the four sections (Tools, Notes, Links, plus a general "primary")
has its own accent — reuse `accent`/`accent2`/`accent3`/`accent4` rather
than inventing a fifth unless a genuinely new section is added. Static Pages
is a read-only view of files on disk with no editing affordances, so it
shares `accent3` with Links rather than claiming an accent of its own; Text
Tools is one more tool surface and shares `accent` with Tools; Color Tools
uses `accent4` for its chrome so the accent never competes with the colors
the user is actually picking; Assets Tools shares `accent2` with Notes;
POE Tools is one more tool surface and shares `accent` with Tools.

Where an accent also carries meaning in the UI, use it for the "do the
thing" button (Assets Tools' Slice/Pack/Play are `bg-accent2 text-bg`) and
keep destructive or secondary actions on the neutral ghost button.

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

The primary sidebar is deliberately narrow (`w-36` / 144px) — nav labels are
short, so they fit, and they truncate rather than wrap if they don't. The
sub-sidebar is wider (`w-60` / 240px) because its `SubItem` rows carry a
second description line that needs roughly 220px to render in full; drop
below that and the descriptions ellipsize.

- **Primary sidebar** (`components/Sidebar.js`): fixed-width flex column
  (`w-36`, collapses to `w-16`), `bg-panel`, border-right, nav items stacked,
  collapse toggle pinned to the bottom via a `flex-1` spacer.
- **Sub-sidebar** (`components/SubSidebar.js`): the optional second sidebar,
  one per section, sitting between the primary nav and the content. `w-60` and
  `bg-panel2` so it reads as a nested context panel rather than a second nav.
  Its header is the section title plus an optional compact `SubAction` button;
  below it a stack of `SubItem` rows (icon, label, optional sub-line, active
  state).
  - Tools: lists the tools (UUID, timestamp, diff, Event Timeline); the
    selected tool renders inline in the content pane (no modal, no card grid).
    The timeline is the one tool that isn't an input/output widget — it draws a
    date-and-countdown rail, so its rows wrap the card onto its own line
    (`min-w-[min(180px,100%)]`) when the pane is too narrow for the date
    column and the card side by side.
  - Notes / Links: lists the section's entries; the selected entry renders in
    the content pane as a detail card.
- **Static Pages** has no sub-sidebar either — there is nothing to edit, so
  the content pane is a `repeat(auto-fill, minmax(220px, 1fr))` grid of
  `bg-panel` cards that link straight out to the page (new tab).
- **Text Tools** and **Color Tools** both use the sub-sidebar too, even
  though neither has saved entries: the list is the tool chooser.
  - Text Tools: one `SubItem` per tool group (JSON, Case, Trim, ...); the
    selected group's actions render as buttons in the content pane above a
    single shared textarea, since every transform applies to the same buffer.
  - Color Tools: one `SubItem` per panel (Picker, Palette, Contrast, Shades,
    Gradient); the pane shows the current color name, recent-color strip and
    the selected panel.
  - Assets Tools: one `SubItem` per tool (Slicer, Packer, Viewer); the pane
    shows the selected tool's own sections (drop zone, settings, preview,
    result). Switching tools drops the loaded files with it.
  - POE Tools: one `SubItem` per section (Regex, Trade, Note). All three are
    placeholders — the pane just names the section, nothing is built yet.
- **Content** (`ContentPane`): `flex-1 min-w-0 overflow-y-auto` with generous
  padding (`px-6 py-7 pb-16`). No max-width cap — the dashboard should fill the
  window at any desktop size.
- There is no Home/dashboard view: `/` redirects to `/tools`, and every
  section in the nav has a sub-sidebar.
- Cards: `bg-panel border border-border rounded-card`, consistent internal
  padding (`px-4.5 pt-4.5 pb-2` for list panels, `px-4.5 pt-4.5 pb-4.5` for
  detail panels).

## Spacing

Tailwind's default scale is used, plus one custom step in
`tailwind.config.js`:

- `4.5` (1.125rem / 18px) — the standard card padding (`p-4.5`, `px-4.5`,
  `pt-4.5`) and panel gap (`mb-4.5`).

Note that Tailwind's *default* scale stops at `3.5` and then jumps to `5`;
`4.5` only exists because it is declared in the config. Don't use `4.5` in
inline styles or new files without checking it resolves.

## Motion

Minimal — only the sidebar width transition (`transition-all duration-150`)
and hover states (`hover:border-accent`, `hover:brightness-110`). Don't add
entrance animations or hover effects beyond border/background color changes;
it would clash with the current restrained feel.
