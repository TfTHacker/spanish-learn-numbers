# Architecture

This plugin is intentionally small, but several files act as coordination points. Keep this document current when moving ownership between modules.

## Runtime Flow

1. Obsidian loads `src/main.ts`, which re-exports the default plugin class from `src/plugin.ts`.
2. `LearnSpanishNumbersPlugin.onload()` loads persisted data, initializes Listen & Learn state, registers the view, settings tab, commands, ribbon icon, protocol handlers, and reminder timers.
3. `LearnSpanishNumbersView.render()` reads `plugin.currentPanel` and instantiates one panel class from `src/panels/`.
4. Panel classes render DOM into the view container, attach event listeners, call plugin helpers, and save settings when their workflow changes persisted state.
5. Pure learning, range parsing, and number-conversion behavior lives in `src/utils/` and is covered by validator scripts.

Panel instances are recreated on render. Active Practice, Cram, and Listen & Learn state must therefore be stored outside a panel instance or rebuilt explicitly from plugin state.

## Persistence

The plugin persists one object through Obsidian's `loadData()` and `saveData()`:

- `settings`: user preferences, recent range configs, reminder settings, streak data, and Listen & Learn setup.
- `cards`: SRS card state.
- `history`: recent session summaries.

`loadSettings()` still accepts an older flat format where the saved data object was itself the settings object. Keep that compatibility when adding settings.

## Panel Ownership

- Dashboard: navigation and progress summary.
- Practice: SRS session setup from configured ranges, due-card selection, review buttons, and SRS session history.
- Cram: temporary drill sessions that do not alter SRS cards.
- Number to Spanish: ad hoc conversion and pronunciation.
- Listen & Learn: audio slideshow setup, recent configs, timed reveal/advance flow, and audio cleanup.

Panels should not own reusable algorithms. If a behavior can be described without DOM or Obsidian APIs, put it in `src/utils/` and cover it in a validator script.

## High-Risk Areas

- Spanish number grammar: small wording changes can break many ranges. Run `npm run check` after any change to `src/utils/numbers.ts`.
- Range parsing: ranges can expand to thousands of numbers, so preserve the per-range and total-number limits in `src/utils/ranges.ts`.
- Reminder timers: timers must be cleared on unload and suppressed while active practice panels are open.
- Listen & Learn: audio, timers, pause/resume, manual navigation, and cleanup are coupled. Refactor in small steps with regression coverage.
- Saved data migrations: assume users may have data from older plugin versions.

## Preferred Change Pattern

1. Move pure behavior into `src/utils/`.
2. Add or update a validator in `scripts/`.
3. Keep panel edits focused on rendering and event wiring.
4. Run `npm run check`.
5. Update this file or `AGENTS.md` if ownership or workflow changes.
