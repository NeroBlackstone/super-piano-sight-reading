# Super Piano Sight-Reading

A web-based piano sight-reading practice tool. Generate sight-reading exercises from custom key signatures, clefs, ranges, rhythms, and tempos to help piano learners practise reading music at sight.

**English** | [简体中文](./README.zh.md)

## Status

> Currently at the **prototype stage**: the config page controls are interactive — the summary sidebar and the piano keyboard highlight follow your changes in real time — but **exercise generation and practice logic are not wired up yet**; the "Start Practice" button does not navigate anywhere.

## Pages

| Page       | Description                                                                                                                              | Status                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Config `/` | Pure configuration: clef, key signature, range, time signature, tempo, durations, rests/accidentals/dots/triplets, exercises per session | ✅ front-end prototype (`src/routes/+page.svelte`) |
| Practice   | Shows the generated score, countdown, judgement, and results                                                                             | ⬜ planned                                         |

## Configuration options (current prototype)

- **Clef**: treble (right hand) / bass (left hand)
- **Key signature**: multi-select from 12 keys (drawn randomly during practice); optional accidentals with an adjustable probability
- **Range**: MIDI 21–108 (A0–C8) dual-thumb slider with a live piano keyboard preview and quick presets (near middle C / basic / wide / full keyboard)
- **Time signature**: 4/4, 3/4, 2/4, 6/8 — the denominator picks the default note value and the beat unit used by BPM
- **Tempo**: 40–208 BPM; switching time signatures rescales the BPM so the absolute speed stays the same
- **Durations**: multi-select whole / half / quarter / eighth / sixteenth
- **Rests / accidentals / dots / triplets**: each is an on/off switch with its own probability slider (0–100%); switching one off keeps the last probability
- **Measures per exercise**: 4–32, step 4
- **Summary sidebar**: real-time summary of the current config, a difficulty hint (beginner / intermediate / challenge), and validation (at least one key and one duration are required)

Planned but not yet in the prototype: grand staff (both hands), major/minor mode, texture (single notes / dyads / triads), exercises per session, and a per-exercise time limit.

## Practice config data structure

All pre-practice parameters live in a single typed object, `PracticeConfig`, defined in [`src/lib/practice/config.ts`](src/lib/practice/config.ts):

- the config page holds exactly one `$state<PracticeConfig>` as the single source of truth; derived display (difficulty, summary rows, beat unit) stays in the component as `$derived` and is not stored in the config
- toggles pair up with their probability as `OptionalFeature { enabled, probability }`
- `createDefaultConfig()` returns a fresh object on every call (also serves as the reset button's source)
- shared bounds are exported as constants: `KEYBOARD_MIN/MAX`, `TEMPO_MIN/MAX`, `MEASURES_MIN/MAX/STEP`
- groundwork for the planned localStorage persistence (add a `version` field when it lands)

## Tech stack

- [SvelteKit 3](https://svelte.dev/docs/kit) (Svelte 5 runes) + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com) + [shadcn-svelte](https://shadcn-svelte.com) (`src/lib/components/ui`)
- [@lucide/svelte](https://lucide.dev) icons
- [@inlang/paraglide-js](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) i18n (English / 中文, switchable in the header)
- [Biome](https://biomejs.dev) formatting and linting
- Package manager: bun; build target: static site via `@sveltejs/adapter-static`

## Development

```sh
bun install        # install dependencies
bun run dev        # start the dev server
bun run dev -- --open  # start and open in the browser
```

## Scripts

```sh
bun run check      # svelte-check types and templates
bun run lint       # biome check
bun run lint:fix   # biome auto-fix
bun run format     # biome format
bun run build      # production build (output to build/)
bun run preview    # preview the production build
```

## Project structure

```
src/
├── routes/
│   ├── +layout.svelte     # global layout (styles + favicon)
│   ├── +page.svelte       # config page (current prototype)
│   └── layout.css         # Tailwind theme and shadcn design tokens
└── lib/
    ├── components/ui/     # shadcn-svelte components (button, card, slider…)
    ├── practice/
    │   └── config.ts      # PracticeConfig types, defaults, shared bounds
    └── utils.ts           # cn() helpers
```

## Scaffold source

Created with the [`sv`](https://github.com/sveltejs/cli) CLI; this command reproduces the same setup:

```sh
bun x sv@1.1.1 create --template minimal --types ts --add tailwindcss="plugins:none" --install bun super-piano-sight-reading
```

Add official integrations with:

```sh
npx sv add
```

## Roadmap

- [x] Project init (SvelteKit + Tailwind + shadcn-svelte)
- [x] Config page prototype
- [x] Practice config data structure (`PracticeConfig`)
- [ ] Practice page prototype (score display, timing, results)
- [ ] Exercise generation (produce exercise data from a config)
- [ ] Score rendering (five-line staff drawing)
- [ ] Answer judgement and score records
- [ ] Config persistence (localStorage) and difficulty recommendation
