---
title: "Publishing to npm"
status: accepted
tags:
  - "npm"
  - "onboarding"
  - "release"
---

## Prerequisites

- Logged in to npm: `npm whoami` returns your username. If not, run `npm login`.
- Publish rights on the `conway-errors` package.
- Clean working tree on `main`, in sync with `origin`.
- `package.json#version` already bumped and committed.

## Steps

1. Sync and audit.

   ```sh
   git checkout main && git pull
   npm install
   git status      # must be clean
   ```

2. Dry-run the tarball — confirm only `dist/`, `package.json`, `README.md` are included.

   ```sh
   npm pack --dry-run
   ```

3. Publish. `prepublishOnly` runs `type-check && lint && test && build` automatically.

   ```sh
   npm publish
   ```

   Add `--otp=XXXXXX` if 2FA is required.

4. Tag the release and push.

   ```sh
   git tag <version>
   git push origin main --tags
   ```

5. Create the GitHub release.

   ```sh
   gh release create <version> --title "<version>" --notes-file <path>
   ```

   Or paste release notes via github.com UI.

## Verification

- `npm view conway-errors version` returns the just-published version.
- `npm view conway-errors dist.shasum` matches the SHA printed by `npm publish`.
- `gh release view <version>` shows the release with the correct tag.

## Common Issues

- **`403 Forbidden`** — not logged in or missing publish rights. Run `npm whoami`.
- **`prepublishOnly` fails** — fix the underlying error, then re-run `npm publish`. No version re-bump needed; nothing was published.
- **Version already exists** — npm refuses to overwrite. Bump to the next patch.
- **Bad publish within 72h** — `npm unpublish conway-errors@<version>`. After 72h use `npm deprecate conway-errors@<version> "<reason>"` and publish a fix.
