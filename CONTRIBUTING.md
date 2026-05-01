# Contributing

Thanks for kicking the tires. A few ground rules:

## Where things live

- Each language is its own self-contained directory (`typescript/`,
  `python/`, …). Issues and PRs that only touch one language should
  stay in that directory.
- Cross-cutting changes (root README, workflows, this file) are fine
  alone or alongside per-language work.

## Filing issues

- **Bug?** Use the [Bug report](.github/ISSUE_TEMPLATE/bug_report.yml)
  template.
- **Feature?** Use the [Feature request](.github/ISSUE_TEMPLATE/feature_request.yml)
  template.
- **Question / "is this possible?"** → please use
  [Discussions](https://github.com/Plumr-org/sdks/discussions) instead
  of Issues.

## Sending a PR

1. Fork → branch → PR. We squash-merge, so feel free to commit messily
   on your branch.
2. Keep diffs scoped: one bug fix or one feature per PR.
3. Run the relevant language's tests + linters before pushing:
   - TypeScript: `npm install && npm run build && npm run typecheck`
   - Python: `pip install -e ".[dev]" && pytest && ruff check && mypy plumr`
4. Match the existing code style. We don't have a long style guide;
   read a few neighbouring files and follow what's there.

## What gets merged

We say yes to:
- Bug fixes (any size).
- New language SDKs that match the existing API shape.
- Framework recipes under `examples/`.
- Better docs.

We pause on:
- Big refactors without a discussion first.
- New top-level dependencies.
- Breaking changes — please open an issue first so we can plan a
  semver-major release.

## Releasing (maintainers only)

See [PUBLISHING.md](./PUBLISHING.md). Short version: tag
`<lang>-v<version>` (e.g. `typescript-v0.2.0`), push the tag, the
matching workflow publishes to the registry.
