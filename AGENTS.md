# Agent Guide

This repository is an Obsidian plugin for learning Spanish numbers through SRS practice, cram drills, number conversion, and listening practice.

## Start Here

- Read `docs/architecture.md` before changing behavior.
- Run `npm run check` before handing off code changes.
- Use `npm run build` when validating the distributable plugin bundle.
- Use `./local_build.sh` only when you intentionally want to build and copy into the local development vault.
- Do not edit files outside this repository unless the user explicitly asks for vault deployment or vault inspection.

## Project Map

- `src/plugin.ts` owns Obsidian lifecycle, persisted data, global timers, commands, reminders, audio delegation, and shared helpers.
- `src/view.ts` owns routing from `currentPanel` to a panel class.
- `src/panels/` owns DOM rendering and event handlers for individual user workflows. Active session state should live on the plugin or in pure state objects, not only inside panel instances.
- `src/utils/numbers.ts` owns Spanish and English number text generation.
- `src/utils/learning.ts` owns pure learning-state transitions and regression-testable behavior.
- `src/utils/audio.ts` owns text-to-speech audio element reuse.
- `src/utils/html.ts` owns small DOM-safety helpers used by template strings.
- `src/utils/ranges.ts` owns custom range parsing and expansion limits.
- `src/types.ts` owns shared settings, panel ids, constants, and persisted data shapes.
- `scripts/validate-*.mjs` are the current regression test suite.

## Maintenance Rules

- Keep algorithmic logic in `src/utils/` when it can be tested without Obsidian.
- Keep panel classes focused on rendering and event wiring.
- Avoid adding more responsibilities to `src/plugin.ts`; prefer extracting pure helpers first.
- Preserve persisted settings compatibility in `loadSettings()` when adding or renaming settings.
- Treat `data.json` shape changes as migrations. Existing users may have old flat settings data.
- Sanitize or use `textContent` for user-provided content. Range text and recent labels can come from saved user input.
- Clear timers and stop audio when leaving panels, closing views, or unloading the plugin.
- Do not make cram mode update SRS card scheduling; cram is intentionally separate practice.

## Validation

- `npm run check` runs number conversion validation, learning-flow validation, and TypeScript checks.
- `scripts/validate-numbers.mjs` performs broad round-trip checks up to one trillion. Keep this script fast enough for normal handoff.
- `scripts/validate-learning-flows.mjs` covers pure SRS, cram, history trimming, and Listen & Learn display-state behavior.
- Add or extend validator cases when changing number grammar, SRS scheduling, cram state transitions, or Listen & Learn phases.

## Known Refactor Targets

- Extract Listen & Learn slideshow state and timer scheduling out of `src/panels/listen-learn.ts`.
- Replace repeated `innerHTML` templates with small DOM helper functions where user-provided strings are involved.
- Split `src/plugin.ts` into lifecycle, persistence, reminders, and protocol/commands once behavior is covered by tests.
- Move shared recent-config formatting and preset rendering out of individual panel classes.
