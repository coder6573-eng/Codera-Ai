# Floot source snapshot

This directory contains a source export of the Codera AI project as it existed in Floot on 2026-11-21.

## Contents
- `pages/`: the Floot home page and its responsive styles
- `components/`: Floot global context wrapper
- `helpers/`: the original generation engine and Floot database helpers
- `endpoints/`: original workspace, project, planning and build endpoints
- `base.css`: Floot base design tokens

## Migration notes
This is a preserved source snapshot, not the runtime entry point for the Vite application at the repository root. The original endpoint and database code depends on Floot's runtime and its managed Postgres environment (`FLOOT_DATABASE_URL`). The GitHub application intentionally remains local-first and does not import or require that database code.

No provider API key or database credential is included in this export.
