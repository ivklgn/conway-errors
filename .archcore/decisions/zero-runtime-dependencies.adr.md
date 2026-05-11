---
title: "Zero runtime dependencies; opinionated dev toolchain"
status: accepted
tags:
  - "dependencies"
  - "tooling"
---

## Context

`conway-errors` is a published library that consumers add to long-lived application graphs. Any runtime dependency the library pulls in becomes a transitive cost (install time, audit surface, version-pin conflicts) for every downstream project. The library's job — building structured `Error` subclasses with type-level context tracking — can be done entirely with the standard JavaScript / TypeScript runtime.

On the development side, the maintainers wanted a minimal but opinionated toolchain: one bundler, one test runner, one linter/formatter. Past JS projects in this codebase had drifted toward stacks of mostly-duplicate tools (eslint + prettier + multiple plugins, jest + mocha + chai), which compounded upgrade cost without adding value.

## Decision

**Runtime:** zero `dependencies` and zero `peerDependencies` in `package.json`. The compiled `dist/` artifact must be self-contained.

**Build toolchain:** lock the development stack to a single tool per role.

| Role | Tool |
|---|---|
| Test runner | `uvu` |
| TS runner (tests) | `ts-node` |
| Bundler | `microbundle` |
| Linter / formatter | `@biomejs/biome` |
| Clean | `rimraf` |
| Inline test mocks | `snoop` |

`prepublishOnly` chains `lint → test → build`, so anything published has passed all three locally.

This stance is also encoded as the project's stack rule (`.archcore/conventions/project-stack.rule.md`).

## Alternatives Considered

1. **Allow a couple of small runtime dependencies (e.g., a tiny utility lib).** Rejected — every consumer pays the cost; the library's domain (Error subclassing, type branding) needs no helpers.
2. **ESLint + Prettier instead of Biome.** Rejected when Biome was adopted — fewer plugins, single config, faster CI. The combined ESLint + Prettier setup typically pulls > 10 packages and demands periodic plugin-compat updates.
3. **Jest or Vitest instead of uvu.** Rejected — both pull a substantial dev-dependency tree and offer features (snapshots, mocking, suites) the library does not need. `uvu` is < 100 KB and starts in milliseconds.
4. **tsup or unbuild instead of microbundle.** Considered. Microbundle is the incumbent; switching has no payoff against the cost of regression-testing every published artifact (CJS, ESM, `.d.ts`).

## Consequences

**Positive**

- Adding `conway-errors` to a project adds nothing to its runtime dependency graph.
- Audits, SBOMs, and dependency dashboards stay quiet.
- Contributors face a small, learnable toolset — no plugin matrix.
- CI is fast: install + lint + test + build typically completes in under a minute.

**Negative**

- Contributors comfortable with Jest / Vitest must learn uvu's compact API. Less mature ecosystem (e.g., no first-class snapshot test format).
- Biome's rule set is narrower than ESLint's plugin ecosystem; some idioms ESLint would catch must be enforced by reviewers.
- Any future need for a non-trivial runtime helper forces a hard call: re-implement inline or reverse this ADR.

**Neutral**

- Reversing or relaxing this ADR requires a new ADR. The constraint is intentional friction, not a hard ban — it forces every dependency addition to be argued in writing.
