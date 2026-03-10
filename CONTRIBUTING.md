# Contributing to Argus

Contributions are welcome. Argus is an active exploration project, so there's plenty of room to improve.

## Before opening a PR

1. Fork the repo and create a branch from `main`
2. Run `npm run typecheck` — PRs must pass type checking
3. Test your changes against a live browser session
4. Keep commits focused; one logical change per PR

For large changes, open an issue first so we can align on approach before you invest time in implementation.

## Good areas to contribute

- New CDP domain wrappers (e.g. Performance, Accessibility)
- Additional skills / slash commands
- Bug reports with reproduction steps
- Documentation improvements

## Development setup

```bash
git clone https://github.com/Jmsa/argus
cd argus
npm install
npm run dev
```

Chrome Canary opens automatically. See [docs/configuration.md](docs/configuration.md) for Chrome path and flag options.

## Useful commands

```bash
npm run dev         # start with tsx (no build step)
npm run build       # compile to dist/
npm run typecheck   # type-check without emitting
npm test            # run tests
```

## Reporting bugs

Use the [bug report template](https://github.com/Jmsa/argus/issues/new?template=bug_report.md). Include reproduction steps and your environment details.

## Security issues

See [SECURITY.md](SECURITY.md) — please do not open public issues for vulnerabilities.
