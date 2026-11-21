# Codera AI

Codera AI is being migrated from its existing Floot project into this repository so it can be developed with normal Git version control, automated checks, and repeatable deployment.

## Migration status

- [ ] Import the existing application source from Floot
- [ ] Confirm the framework, package manager, and required environment variables
- [x] Add a baseline GitHub Actions workflow
- [ ] Configure production and preview deployment
- [ ] Verify the migrated app with automated and browser tests

The source import is intentionally not replaced with a blank starter app. The existing product and its working features are the source of truth.

## Development

Once the application source has been imported, follow the package manager and scripts declared by its `package.json`. The CI workflow detects common npm, pnpm, and Yarn lockfiles and runs available lint, type-check, test, and build scripts.

## Secrets

Never commit API keys, database credentials, session secrets, or environment files. Configure deployment and runtime secrets in the relevant hosting provider's secret manager and GitHub Actions secrets only when required.
