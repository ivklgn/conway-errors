---
title: "Project stack"
status: accepted
tags:
  - "conventions"
  - "stack"
---

## Rule

- Code in TypeScript with `strict` types; do not loosen `tsconfig.json` to land changes.
- Target Node.js as the runtime; keep the published artifact consumable under `npm >= 8`.
- Test with uvu as the primary runner, executed via `ts-node`. Do not introduce a second runner without an ADR.
- Format and lint with Biome only. Do not add ESLint, Prettier, or competing tools.
- Build the distributable with microbundle. Do not commit the `dist/` directory.

## Rationale

Conway-errors is a published TypeScript library with zero runtime dependencies. The toolchain is intentionally small: one bundler (microbundle), one test runner (uvu), one linter/formatter (Biome). Keeping that surface tight is what lets the package stay dependency-free and easy to audit.

## Examples

### Good

- Adding a new feature in `index.ts`, with companion uvu tests in `index.test.ts`.
- Running `npm run lint` and `npm test` before opening a PR.
- Adjusting Biome configuration in `biome.json` when style needs to change.

### Bad

- Adding `jest`, `vitest`, or `mocha` alongside uvu.
- Adding `eslint` or `prettier` configs.
- Committing files under `dist/` so consumers can grab the build directly from git.

## Enforcement

- CI runs `npm run lint` and `npm run test` (see `prepublishOnly`).
- Reviewers reject PRs that introduce parallel tooling without a paired ADR in `.archcore/`.
