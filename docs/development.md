# Development

This file keeps development details out of the main README so the user-facing documentation stays focused.

## Commands

- `npm run check` - run the Spanish number validator, learning-flow regression validator, and TypeScript checks
- `npm run build` - run validation and build the plugin

## Local vault deploy

This repo includes a local helper script:

- `./local_build.sh`

It builds the plugin and copies the result into the local Obsidian vault plugin folder used during development.

## Notes

- The repository includes validator scripts for both Spanish number generation and learning-flow regressions.
- When developing this plugin locally, use `./local_build.sh` after builds so the test vault stays in sync.
