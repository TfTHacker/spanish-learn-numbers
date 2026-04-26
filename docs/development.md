# Development

This file keeps development details out of the main README so the user-facing documentation stays focused.

## Commands

- `npm run check` - run the Spanish number validator, learning-flow regression validator, and TypeScript checks
- `npm test` - alias for `npm run check`
- `npm run build` - run validation and build the plugin

## Agent-oriented maintenance

Start with the root `AGENTS.md` file for repository-specific guardrails, ownership boundaries, and known refactor targets. Use `docs/architecture.md` for the current runtime map before changing cross-cutting behavior.

## Local vault deploy

This repo includes a local helper script:

- `./local_build.sh`

It builds the plugin and copies the result into the local Obsidian vault plugin folder used during development.

## Notes

- The repository includes validator scripts for both Spanish number generation and learning-flow regressions.
- When developing this plugin locally, use `./local_build.sh` after builds so the test vault stays in sync.

## Updating the version

1. Update `package.json` version number.
2. Run `npm run version` to update `manifest.json` and `versions.json`.
3. Commit the repo.
4. Run `npm run githubaction` to commit the version tag and push it so the GitHub Action can prepare the release.

Note: `npm run githubaction` is not currently defined in this repo's `package.json`, so add that script or use the equivalent manual git/tag/push flow.
