# Contributing

Thanks for your interest in contributing!

## Branching
- Use `develop` branch for ongoing work and `main` (or `master`) for releases.
- Create feature branches named `feature/<short-name>`.

## Commits & PRs
- Use clear, present-tense commit messages: `Add login endpoint`.
- Open PRs against `develop`; include a short description and testing notes.

## Code style
- JavaScript: consistent indentation (2 spaces), prefer `async/await`.
- Use `config` for environment variables; do not commit secrets.

## Tests
- Add unit or integration tests under `tests/`.

## Security
- Do not log sensitive data (passwords, secrets).
- Follow OWASP guidance for APIs.

## Issue reporting
- Create issues with reproduction steps and expected vs actual behavior.