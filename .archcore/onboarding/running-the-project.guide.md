---
title: "Running the project locally"
status: accepted
tags:
  - "onboarding"
---

## Prerequisites

- npm >= 8.0.0
- Node.js (any modern LTS — required by `ts-node` and `microbundle`)

## Steps

1. Install dependencies.

   ```sh
   npm install
   ```

2. Run the test suite.

   ```sh
   npm test
   ```

3. Type-check.

   ```sh
   npm run type-check
   ```

4. Lint with Biome.

   ```sh
   npm run lint
   ```

5. Build the distributable (publishes to `dist/`).

   ```sh
   npm run build
   ```

## Verification

- `npm test` exits 0 — uvu prints the test summary line.
- `npm run build` produces `dist/index.js`, `dist/index.module.js`, and `dist/index.d.ts`.
- `npm run lint` exits 0 with no diagnostics.

## Common Issues

- **`ts-node` cannot find the source.** Tests run as `ts-node index.test.ts` from repo root — run npm scripts from there, not from a subdirectory.
- **Lint errors after editing.** Run `npm run lint:fix` or `npm run format` to apply Biome's auto-fixes.
- **Build leaves stale files.** The `build` script chains `clean` first; if you call `microbundle` directly, run `npm run clean` beforehand.
