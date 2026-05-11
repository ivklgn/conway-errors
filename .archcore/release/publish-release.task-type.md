---
title: "Publish a conway-errors release"
status: accepted
tags:
  - "automation"
  - "npm"
  - "release"
---

## Trigger

Phrases like: "publish a release", "ship X.Y.Z to npm", "release the new version".

The user supplies (or you derive from `package.json#version`): the target version `X.Y.Z` and release-notes text.

## Preconditions — verify before any mutation

1. Working tree clean: `git status --porcelain` is empty.
2. On `main` and up-to-date: `git rev-parse --abbrev-ref HEAD` is `main`; `git fetch && git status -uno` reports no divergence.
3. Logged in to npm: `npm whoami` returns a username.
4. Version matches expectation: `node -p "require('./package.json').version"` equals `X.Y.Z`.
5. Tag `X.Y.Z` does NOT already exist: `git tag --list X.Y.Z` is empty.
6. Version not yet published: `npm view conway-errors@X.Y.Z version` exits non-zero (or returns nothing).

If any precondition fails — STOP, report to the user, do not proceed.

## Steps

1. **Sanity prove the publish-gate locally.** Identical to `prepublishOnly` plus `pack --dry-run`.

   ```sh
   npm run type-check
   npm run lint
   npm test
   npm run build
   npm pack --dry-run
   ```

   All five must exit 0. Tarball contents must contain only `dist/**`, `package.json`, `README.md`.

2. **Confirm with the user before any external side effect.** Show the version, tarball file list, and release notes. Ask for explicit "go".

3. **Publish to npm.**

   ```sh
   npm publish
   ```

   If 2FA is required, ask the user for an OTP and re-run `npm publish --otp=XXXXXX`.

4. **Tag and push.**

   ```sh
   git tag X.Y.Z
   git push origin main --tags
   ```

5. **Create the GitHub release.**

   ```sh
   gh release create X.Y.Z --title "X.Y.Z" --notes-file <path-to-notes>
   ```

## Verification

- `npm view conway-errors version` equals `X.Y.Z`.
- `git ls-remote --tags origin X.Y.Z` returns a hash.
- `gh release view X.Y.Z` shows the release.

## Stop conditions (require user input — never decide alone)

- Any precondition fails.
- `prepublishOnly` or any sanity step fails.
- 2FA OTP needed.
- Discrepancy between `package.json#version` and the user-requested version.
- Tarball includes unexpected files (source, tests, `.archcore/`, `.claude/`).
- `npm publish` returns a non-zero exit code for any reason.

## Common pitfalls

- **Re-bumping version after a failed `prepublishOnly`.** Not needed — nothing was published. Fix the cause and re-run `npm publish`.
- **Pushing tags before publish succeeds.** Avoid; tag only after `npm publish` returns 0.
- **Skipping `npm pack --dry-run`.** Catches misconfigured `files` field before the upload is irrevocable.
- **`npm unpublish` after 72 hours.** Forbidden by registry policy. Use `npm deprecate` and ship a fix release instead.
