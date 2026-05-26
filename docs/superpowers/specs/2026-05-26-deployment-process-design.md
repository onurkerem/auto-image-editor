# Deployment Process Design

## Overview

GitHub Release-based deployment for `auto-image-editor` CLI tool. Pushing a semver tag (e.g. `v1.0.1`) triggers a GitHub Actions workflow that builds, packages, and creates a GitHub Release. Users install via a curl-based install script.

## Release Workflow

**File:** `.github/workflows/release.yml`
**Trigger:** Push of tag matching `v*`

Steps:
1. Checkout code
2. Install dependencies (`npm ci` in `packages/cli/`)
3. Run tests (`npm test`)
4. Build (`npm run build` — compiles TypeScript to `dist/`)
5. Package `dist/` + `package.json` into `auto-image-editor-{version}.tar.gz`
6. Generate changelog from `git log` between previous tag and current tag
7. Create GitHub Release using `softprops/action-gh-release` with tarball + changelog

**Idempotent:** Re-running on the same tag updates the existing release rather than creating duplicates.

**No secrets required:** `GITHUB_TOKEN` is auto-provided by GitHub Actions.

## Install Script

**File:** `install.sh` in repo root
**URL:** `https://raw.githubusercontent.com/{owner}/auto-image-editor/main/install.sh`

### Install flow
1. Resolve version — query GitHub API for latest release, or use `VERSION` env var
2. Download tarball from release assets
3. Extract to `~/.auto-image-editor/versions/{version}/`
4. Run `npm install --production` to install runtime dependencies
5. Create symlink: `~/.auto-image-editor/versions/{version}/dist/cli.js` → binary directory
6. Clean up previous versions

### Binary directory selection
- Primary: `/usr/local/bin/auto-image-editor`
- Fallback (no write permission): `$HOME/.local/bin/auto-image-editor` with PATH hint

### Install command
```sh
curl -fsSL https://raw.githubusercontent.com/{owner}/auto-image-editor/main/install.sh | sh
```

### Update command
Same as install — detects latest version and reinstalls if newer.

### Uninstall
```sh
rm -rf ~/.auto-image-editor /usr/local/bin/auto-image-editor
```

## Version Bumping & Tagging

Manual version control in `packages/cli/package.json`:

```sh
# 1. Bump version in package.json
# 2. Commit and tag
git commit -am "release: v1.0.0"
git tag v1.0.0
# 3. Push
git push && git push --tags
```

Conventions:
- Tags follow semver: `vMAJOR.MINOR.PATCH`
- No pre-release tags
- Commit message format: `release: v{version}`

## Error Handling

### Release workflow
- Tests fail → release blocked, no GitHub Release created
- Build fails → release blocked at build step
- Fix issue and re-tag, or delete the remote tag and re-push

### Install script
- Missing `curl` → error with installation instructions
- Missing `node` (>=18) → error with Node.js download link
- No write permission to `/usr/local/bin` → fallback to `$HOME/.local/bin/` with PATH setup hint
- Download failure → error with manual download URL
- `npm install` failure → error suggesting `--verbose` for details

## Files to Create

1. `.github/workflows/release.yml` — GitHub Actions release workflow
2. `install.sh` — curl-based install script
3. `packages/cli/package.json` — add `prepublishOnly` script (guard against accidental npm publish)

## Requirements

- Node.js >= 18 on user machine
- Public GitHub repository
- Git remote configured pointing to GitHub
