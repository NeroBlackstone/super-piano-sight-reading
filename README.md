# Super Piano Sight-Reading

A web-based piano sight-reading practice tool. Generate sight-reading exercises from a key signature, clef, range, rhythm, and tempo, then play them back on a MIDI keyboard with live judgement and accuracy stats.

**English** | [简体中文](./README.zh.md)

## Status

The core loop works end to end: **configure → generate → render the score → play along via MIDI → see stats**. What's still missing is long-term config persistence (localStorage), the grand staff (both hands), and more exercise modes — see the roadmap below.

Live demo: <https://neroblackstone.github.io/super-piano-sight-reading/> (deployed by GitHub Pages on every push to `master`)

> Judgement uses the **Web MIDI API**, which works in Chromium browsers (Chrome / Edge). Firefox doesn't support it by default — you can still browse and read the generated scores, but playing along won't register.

## Pages

| Page              | Description                                                                                                            | Status                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Config `/`        | Pure configuration: clef, key, range, melody mode, time signature, tempo, durations, rests/accidentals/dots/triplets, measures per exercise | ✅ (`src/routes/+page.svelte`) |
| Practice `/practice` | Generated score with count-in, metronome, MIDI judgement (performance / practice modes), fullscreen, results overlay | ✅ (`src/routes/practice/+page.svelte`) |

## Configuration options

- **Clef**: treble (right hand) / bass (left hand)
- **Key signature**: pick one of 12 keys (with a sharps/flats hint tooltip)
- **Range**: MIDI 21–108 (A0–C8) dual-thumb slider with a live piano keyboard preview; octave presets (C1–C2 … C7–C8, stackable) and staff quick presets (treble / treble extended / bass / bass extended)
- **Melody mode** — how the next note is chosen:
  - **Random notes**: each note drawn independently; the only mode where random accidentals can appear
  - **Intervals**: each note steps from the previous one by a multi-selected interval (unison–octave), direction random
  - **Broken chords**: continuous broken-chord runs — *diatonic* (scale-degree triads / sevenths of the chosen key, chord symbols drawn above the staff) or *custom* (pick types: major / minor / dim / aug / dom7 / maj7 / min7 / half-dim7 / dim7), with inversions (3rd only for sevenths) and up/down direction
- **Time signature**: 4/4, 3/4, 2/4, 6/8 — the denominator picks the default note value and the beat unit used by BPM
- **Tempo**: 40–208 BPM; switching time signatures rescales the BPM so the absolute speed stays same
- **Durations**: multi-select whole / half / quarter / eighth / sixteenth, each with an optional dotted version; "naturalize frequency" draws them with realistic weights instead of equal odds
- **Rests / accidentals / triplets**: each is an on/off switch with its own probability slider (0–100%); switching one off keeps the last probability. Dots are configured per duration. Accidentals only apply in random-notes mode
- **Measures per exercise**: 4–32, step 4
- **Summary sidebar**: real-time summary of the current config, validation (at least one duration is required), plus start / reset buttons and a practice tip

## How practice works

- The config page saves the config to `sessionStorage`; the practice page reads it on mount (direct visits or expired sessions bounce back to the config page). "Regenerate" re-rolls the same config with a new random seed
- **Count-in**: one measure of metronome clicks synthesized via Web Audio (no audio assets), scheduled ahead on the audio clock
- **Performance mode**: the cursor advances with the clock; a small lead window accepts slightly early hits; wrong notes don't block you; notes still unplayed when their window closes are marked *missed*
- **Practice mode**: event-driven — you only advance when you play the correct note; rhythm is ignored and rests are skipped
- Judgement comes from Web MIDI note-on events of all connected inputs; the header shows a live connection indicator (device name / count)
- The score is rendered with **VexFlow 5** (loaded on demand): multi-row layout, beaming per beat, courtesy accidentals across measures, chord symbols in diatonic mode, and three notation-only rules that keep the score readable without changing what you play — notes ≥ 1 beat start on a beat (split + tie), the two-level rule breaks notes at mandatory beat points, and consecutive rests are regrouped so no rest crosses a beat
- While playing, the current note is highlighted with a cursor bar below the staff, and the score auto-scrolls one page when the cursor leaves the view; fullscreen is available
- When the piece ends, a results overlay shows correct / wrong / missed counts and accuracy, with *regenerate* and *play again* buttons

## Practice config data structure

All pre-practice parameters live in a single typed object, `PracticeConfig`, defined in [`src/lib/practice/config.ts`](src/lib/practice/config.ts):

- the config page holds exactly one `$state<PracticeConfig>` as the single source of truth; derived display (summary rows, beat unit, tempo mark) stays in the component as `$derived` and is not stored in the config
- toggles pair up with their probability as `OptionalFeature { enabled, probability }`; dots instead carry the list of durations they apply to (`DotSettings`)
- melody generation is described by `MelodySettings { mode, intervals, chord }`, with `ChordSettings` covering source / structure / types / inversions / direction
- `createDefaultConfig()` returns a fresh object on every call (also serves as the reset button's source)
- shared bounds are exported as constants: `KEYBOARD_MIN/MAX`, `TEMPO_MIN/MAX`, `MEASURES_MIN/MAX/STEP`
- the page-to-page handoff (`src/lib/practice/session.ts`) validates the stored shape before trusting it and clears it on mismatch — groundwork for adding a `version` field when localStorage persistence lands

Exercise generation (`src/lib/practice/exercise/`) is a pure function of the config plus an injectable RNG (`mulberry32`), so exercises are reproducible from a seed; the generated `Exercise` describes only what to play (pitch, duration, marks), never how to draw it — rendering lives in `src/lib/components/practice/staff/`.

## Tech stack

- [SvelteKit 3](https://svelte.dev/docs/kit) (Svelte 5 runes) + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com) + [shadcn-svelte](https://shadcn-svelte.com) (`src/lib/components/ui`)
- [VexFlow 5](https://vexflow.com) score rendering (dynamically imported in the browser)
- [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) for play-along judgement, [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) for the count-in click
- [@lucide/svelte](https://lucide.dev) icons
- [@inlang/paraglide-js](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) i18n (English / 中文, switchable in the header)
- [Biome](https://biomejs.dev) formatting and linting
- Package manager: bun; build target: static site via `@sveltejs/adapter-static`, deployed to GitHub Pages by `.github/workflows/deploy.yml`

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
│   ├── +layout.svelte      # global layout (styles + favicon)
│   ├── +layout.ts          # prerender every route (static site)
│   ├── +page.svelte        # config page
│   ├── practice/
│   │   └── +page.svelte    # practice page (score, count-in, judgement)
│   └── layout.css          # Tailwind theme and shadcn design tokens
└── lib/
    ├── components/
    │   ├── practice/       # app components (config cards, header, staff/)
    │   │   └── staff/      # VexFlow rendering, row layout, play highlight
    │   └── ui/             # shadcn-svelte components (button, card, slider…)
    ├── practice/
    │   ├── config.ts       # PracticeConfig types, defaults, shared bounds
    │   ├── options.ts      # option metadata for the config page
    │   ├── session.ts      # config handoff between pages (sessionStorage)
    │   ├── midi.svelte.ts  # Web MIDI input state and note subscription
    │   ├── exercise/       # exercise generation (pitch, rhythm, notation rules)
    │   └── play/           # play session: timeline, metronome click, judgement
    └── utils.ts            # cn() helpers
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
- [x] Config page
- [x] Practice config data structure (`PracticeConfig`)
- [x] Exercise generation (random notes / intervals / broken chords)
- [x] Score rendering (VexFlow: rows, beaming, notation rules, chord symbols)
- [x] Practice page (count-in, performance/practice modes, fullscreen)
- [x] Answer judgement via Web MIDI and accuracy stats
- [ ] Config persistence (localStorage) and difficulty recommendation
- [ ] Grand staff (both hands), major/minor mode, texture (single notes / dyads / triads)
- [ ] Exercise history and score records
