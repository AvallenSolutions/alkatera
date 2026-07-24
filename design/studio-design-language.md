# The studio. — alka**tera** design language, v1 (July 2026)

Canonical reference for the studio redesign, converted from `alkatera-studio-design-guidelines.pdf`.
Gallery-grey paper, four saturated inks and a quiet black ring. Statement headlines, mono eyebrows,
big display numbers, geometric marks, and layouts that breathe.

## The idea: a gallery, not a dashboard

The studio face rejects the usual SaaS grammar of sidebars, widget grids and grey chrome. Every
surface is a poster: one statement, a few big honest numbers, and quiet detail that reveals itself
when you come closer.

The ground is warm gallery grey. Colour is spent in single, saturated blocks, one per room, so that
when a colour speaks, it means something. Everything else is ink, cream and hairlines.

The app is a house of rooms. The desk (the home grid) is the hall; each room carries its own colour
band above, an ink band below, and its work on paper in between. The assistant keeps to a small
black strip: one ring, one prompt, never a big block.

### Principles
- **Say the number.** Lead with the figure that matters, display-bold, with a small mono label under it. £46k weighted. 15 unread. 3 moves.
- **One saturated block.** At most one poster-coloured block per surface. The room's colour is its accent everywhere else: eyebrows, links, active tabs.
- **Hairlines, not boxes.** Separate with 1px lines on paper, not nested borders and shadows. Panels are cream with a hairline, radius 6.
- **Reveal on approach.** Peek notes give way to facts on hover; columns breathe open; detail is earned, not dumped.
- **Statements end with a full stop.** Headlines are short declarative sentences set tight in Space Grotesk Bold.

### NEVER
Retint an old layout and call it redesigned · black with neon green · the newspaper idiom · a big
assistant block · coloured text on coloured blocks (cream or ink only) · em dashes in copy.

## The palette: gallery grey, four inks

### The ground
| Token | Hex | Use |
|---|---|---|
| paper | `#ECEAE3` | the ground of every surface |
| cream | `#F2F1EA` | panels; text and marks on colour |
| hairline | `#D9D6CB` | rules and panel borders |
| dim | `#6F6F68` | quiet text on paper |
| ink | `#1A1B1D` | text, actions, the assistant |

### The rooms (one colour each, spent deliberately)
| Room colour | Hex | Text on it |
|---|---|---|
| forest | `#205E40` | cream |
| teal | `#1E5F5B` | cream |
| cobalt | `#2B46C0` | cream |
| plum | `#6D3A5D` | cream |
| ochre | `#DFA32B` | ink, always (accent form on paper: `#A97C14`) |
| brick | `#BF4B2A` | cream |
| ink (the wiring, assistant) | `#1A1B1D` | paper |

> The platform (not alkatera·OS) uses **seven** rooms sorted by frequency of use.
> Teal and plum were added to the four original inks so each room keeps a distinct
> colour. See `components/studio/platform-rooms.ts` for the registry and the
> persona-adaptive ordering.

### Working tones (states, never decoration)
| Hex | Meaning |
|---|---|
| `#047857` | won / good |
| `#B45309` | overdue / attention |
| `#BE123C` | stale / lost |
| `#6D28D9` | on hold |

Rules: ochre always takes ink text (contrast). Text on saturated blocks is cream or ink only. The
room's colour becomes that room's accent on paper: eyebrows, active tabs, key numbers, links.

## Typography: three voices

Space Grotesk speaks, Inter explains, JetBrains Mono annotates.

| Style | Face | Size | Use |
|---|---|---|---|
| Statement headline | Space Grotesk Bold | 40–68px, leading 0.95, tracking −3.5% | The surface's one sentence. Ends with a full stop. |
| Big number | Space Grotesk Bold, tabular | 27–32px | A figure over a mono label. |
| Card title | Space Grotesk SemiBold | 13.5–15px | Names: leads, people, drafts. |
| Body | Inter Regular | 13–14px / 1.5 | Sentences and quiet detail. |
| Eyebrow / label | JetBrains Mono Bold | 9.5–10.5px · caps · +22% tracking | Sections, tabs, number labels. |
| Meta / time | JetBrains Mono | 10–11px | Times, ages, hexes: the margins. |

Numbers are always tabular. Wherever a big number appears, a mono label sits beneath it at 9.5px,
letterspaced +20%, at 70% opacity. The wordmark is always lowercase: alka in medium, tera in bold.

## The marks: a maker's stamp in every room

Each room signs its surfaces with one geometric mark, cropped by a corner like a chop mark on a print.

- Today: the sun on the day (circle)
- Sell: the climb, the delta (triangle)
- Comms: the envelope, tilted 14° (quad)
- Studio: the atelier window (half-circle)
- Assistant: the quiet listener (ring)

Rules:
- On paper: 8% opacity, cropped by the nearest page corner, always behind content.
- On a poster block: cream (ink on ochre) at 20%, waking to 28% with a small rotation on hover.
- One mark per surface. The mark never carries meaning; it is a signature, not an icon.

## Anatomy of a room: band, statement, paper, band

1. **The room band.** 52px, the room's colour. Desk link (four panes), the mark, the room's name,
   its surfaces as mono tabs (active carries a 3px underline), a live mono note on the right. Sticky.
2. **The statement.** Eyebrow in the room colour; the headline says the number or the state of play;
   supporting figures stand right, display-bold over mono labels.
3. **The paper.** Work happens on gallery grey. Cream panels, hairline borders, radius 6. At most
   one saturated block per surface.
4. **The ink band.** The assistant's permanent home: ring, Ask the studio, prompt pill, cmd-K,
   quick capture (+), and the room's surfaces again for the thumb. Sticky at the bottom.

## The kit of parts

- **Actions:** pills, radius full. Ink is the default act. Outline is the second act. The room's
  colour marks the one act the room exists for. Ghost for the rest.
- **Tabs:** mono caps + 3px rule.
- **Panel:** cream, hairline, r6.
- **Accent panel:** the one saturated block per surface.
- **Fact row:** bold subject, mono time.
- **The big number:** display bold, tabular; the label beneath in mono caps at 70%. Never a number
  without its label.
- **Stage bar:** opacity = probability (e.g. NOT APPROACHED → CONTACTED → FOLLOWED UP → WON).

## Charts

The room inks are **not** the chart palette. Validated as a categorical set
they fail: forest, teal and plum drop below the chroma floor (they read grey at
mark scale) and teal↔plum measure ΔE 1.8 under deuteranopia. They are built to
be deep behind cream text, which is the opposite of what a 2px mark needs.

`CHART` in `components/studio/theme.ts` is the single source. Each series slot
is the nearest passing step in the same studio hue family, validated against
the paper surface for lightness, chroma, CVD separation, normal-vision
separation and contrast. Light only — next-themes is forced light.

- **Assign in fixed order, never cycled.** A sixth series folds into "Other" or
  becomes small multiples. A generated hue is never correct.
- **Colour follows the entity, not its rank.** Filtering a series out must not
  repaint the survivors.
- **Brick and ochre are never adjacent** — ΔE 12.3 in normal vision.
- **Match the encoding to the job.** Identity takes `CHART.series`; magnitude
  and anything ordinal (the waste hierarchy, for one) takes `CHART.sequential`,
  one hue light to dark; state takes the reserved working tones, which are
  never borrowed as a series colour; a reference or benchmark line takes
  `CHART.reference` so it cannot be read as data.
- **Text wears text tokens**, never the series colour. A coloured mark beside a
  label carries the identity.

- **State chips:** mono, no pills. States are typographic: small bold mono in a working tone. No
  badge pills, no backgrounds; the word and its colour are enough.

## Motion: layouts that breathe

Nothing bounces and nothing spins. Space itself moves: tracks re-weight towards attention, and
detail rises to meet it.

| What | Timing |
|---|---|
| Grid tracks re-weight (hovered track 1fr → 1.85fr, neighbours give way) | 450ms |
| Facts reveal (rise 6px + fade) | 280ms, delay 160ms |
| Marks wake (rotate 8°, scale 1.1) | 500ms |
| Hover lift / colour | 150–200ms |
| Everything | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

The studio ease starts briskly and settles softly, like a drawer on a damper. Respect
`prefers-reduced-motion`: when it is set, everything above simply does not move.

## Voice: say it like a headline

- **Statements, full stops.** Surfaces open with a short declarative sentence. The number is the subject where there is one.
- **British English, always.** Colour, prioritise, organise. Dates as 3 July, times as 14:00.
- **Never an em dash.** Use a comma, parentheses, a colon or a full stop. The middle dot (·) separates mono facts.
- **The wordmark.** alkatera is always lowercase with tera in bold; the OS is alkatera·OS. Never Alkatera, never ALKATERA.
- **Rooms have names, not features.** The library, the workbench, the diary, the wiring, the desk. Plain words with a little pride.
- **Quiet honesty.** Empty states say what is true and what to do next. Nothing cheers, nothing apologises twice.

Specimens: £46k weighted. · Good morning, Tim. · All read. · Who we're talking to. · The workbench.
· The library. · The wiring. · Three moves before noon.

## The rooms (as drawn in the guidelines, alkatera·OS flavoured)

Five rooms, one house: Today (forest), Sell (cobalt), Comms (ochre), Studio (brick), Settings (ink).
The desk (the home grid) is the sixth surface: the rooms as breathing poster blocks with the
assistant's ink strip. Every room keeps the desk one click away, top left, always.

> Note for the platform redesign: these room names are alkatera·OS flavoured. The alka**tera**
> SaaS needs its own room mapping (workshopped at Milestone 2), but every rule above transfers.
