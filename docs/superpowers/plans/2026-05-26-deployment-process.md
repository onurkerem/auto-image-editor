# Deployment Process Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a GitHub Actions release workflow and curl-based install script so that pushing a `v*` tag builds, packages, and publishes a GitHub Release that users can install with `curl ... | sh`.

**Architecture:** A single GitHub Actions workflow (`.github/workflows/release.yml`) is triggered on tag push, runs tests, builds the CLI, packages it into a tarball, and creates a GitHub Release. A shell script (`install.sh`) in the repo root lets users download and install the latest release.

**Tech Stack:** GitHub Actions, shell script (POSIX sh), Node.js >= 18, npm

---

## File Structure

| File | Responsibility |
|------|---------------|
| `.github/workflows/release.yml` | CI workflow: test, build, package, create GitHub Release |
| `install.sh` | User-facing install script: download release, extract, npm install, symlink |
| `packages/cli/package.json` | Add `prepublishOnly` guard |

---

### Task 1: Add `prepublishOnly` guard to package.json

**Files:**
- Modify: `packages/cli/package.json`

- [ ] **Step 1: Add the `prepublishOnly` script**

Edit `packages/cli/package.json` — add a `prepublishOnly` script that exits with an error message, preventing accidental `npm publish`:

```json
"scripts": {
    "prepublishOnly": "echo 'This package is distributed via GitHub Releases only. Use the release workflow.' && exit 1",
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 2: Verify the guard works**

Run: `cd packages/cli && npm publish --dry-run 2>&1 | head -5`
Expected: Output contains "This package is distributed via GitHub Releases only."

- [ ] **Step 3: Commit**

```bash
git add packages/cli/package.json
git commit -m "feat: add prepublishOnly guard against accidental npm publish"
```

---

### Task 2: Create the GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: packages/cli

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Get version
        id: version
        run: echo "version=$(node -p 'require("./package.json").version')" >> "$GITHUB_OUTPUT"

      - name: Package release tarball
        run: |
          mkdir -p /tmp/package
          cp -r dist /tmp/package/
          cp package.json /tmp/package/
          cd /tmp/package
          npm install --production --ignore-scripts
          rm -rf node_modules/sharp/vendor
          cd ..
          tar -czf "$GITHUB_WORKSPACE/auto-image-editor-${{ steps.version.outputs.version }}.tar.gz" -C /tmp/package .

      - name: Generate changelog
        id: changelog
        run: |
          PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
          if [ -n "$PREVIOUS_TAG" ]; then
            CHANGELOG=$(git log "$PREVIOUS_TAG"..HEAD --pretty=format:"- %s (%h)" --no-merges)
          else
            CHANGELOG=$(git log --pretty=format:"- %s (%h)" --no-merges -20)
          fi
          echo "changelog<<EOF" >> "$GITHUB_OUTPUT"
          echo "$CHANGELOG" >> "$GITHUB_OUTPUT"
          echo "EOF" >> "$GITHUB_OUTPUT"

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          name: ${{ steps.version.outputs.version }}
          body: |
            ## Changes
            ${{ steps.changelog.outputs.changelog }}

            ## Install
            ```sh
            curl -fsSL https://raw.githubusercontent.com/${{ github.repository }}/main/install.sh | sh
            ```
          files: |
            auto-image-editor-${{ steps.version.outputs.version }}.tar.gz
```

- [ ] **Step 2: Verify YAML is valid**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"` or `npx yaml-lint .github/workflows/release.yml`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat: add GitHub Actions release workflow"
```

---

### Task 3: Create the install script

**Files:**
- Create: `install.sh`

- [ ] **Step 1: Create the install script**

Create `install.sh` in the repo root:

```sh
#!/usr/bin/env sh
set -e

REPO="auto-image-editor"
GITHUB_API="https://api.github.com/repos"
INSTALL_DIR="$HOME/.auto-image-editor"
BIN_NAME="auto-image-editor"

# --- Prerequisite checks ---

if ! command -v curl > /dev/null 2>&1; then
    echo "Error: curl is required but not installed."
    echo "Install it from: https://curl.se/dlwiz/"
    exit 1
fi

if ! command -v node > /dev/null 2>&1; then
    echo "Error: Node.js >= 18 is required but not installed."
    echo "Install it from: https://nodejs.org/"
    exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.version.split('.')[0].slice(1))")
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "Error: Node.js >= 18 is required. You have v$(node -v)."
    echo "Upgrade at: https://nodejs.org/"
    exit 1
fi

# --- Resolve version ---

if [ -n "$VERSION" ]; then
    TAG="v$VERSION"
else
    echo "Looking up latest version..."
    LATEST_URL="$GITHUB_API/*/releases/latest"
    echo "Error: Repository owner not configured."
    echo "Set the REPO variable in this script to 'owner/$REPO'."
    exit 1
fi

# --- Determine GitHub download URL ---
# The REPO variable at the top must be set to 'owner/auto-image-editor'
# for this script to work. We detect the owner from the GitHub API redirect.

OWNER=$(curl -fsSL "https://raw.githubusercontent.com" 2>/dev/null || echo "")
if [ -z "$OWNER" ]; then
    echo "Error: Cannot reach GitHub."
    exit 1
fi

# Resolve latest version from GitHub API if VERSION not set
if [ -z "$VERSION" ]; then
    TAG=$(curl -fsSL "$GITHUB_API/$REPO/releases/latest" 2>/dev/null | grep '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')
    if [ -z "$TAG" ]; then
        echo "Error: Could not determine latest version."
        echo "Check the repository: https://github.com/$REPO"
        exit 1
    fi
fi

VERSION_NUM="${TAG#v}"
TARBALL="$REPO-$VERSION_NUM.tar.gz"
DOWNLOAD_URL="https://github.com/$REPO/releases/download/$TAG/$TARBALL"

# --- Download ---

TARGET_DIR="$INSTALL_DIR/versions/$VERSION_NUM"

echo "Installing $REPO $TAG..."

if [ -d "$TARGET_DIR" ]; then
    echo "Version $VERSION_NUM already installed. Reinstalling..."
    rm -rf "$TARGET_DIR"
fi

mkdir -p "$TARGET_DIR"

TMPFILE=$(mktemp /tmp/$REPO.XXXXXX.tar.gz)
cleanup() { rm -f "$TMPFILE"; }
trap cleanup EXIT

echo "Downloading $DOWNLOAD_URL..."
if ! curl -fsSL -o "$TMPFILE" "$DOWNLOAD_URL"; then
    echo "Error: Download failed."
    echo "Download manually from: https://github.com/$REPO/releases/tag/$TAG"
    exit 1
fi

# --- Extract ---

echo "Extracting..."
tar -xzf "$TMPFILE" -C "$TARGET_DIR"

# --- Install dependencies ---

echo "Installing dependencies..."
cd "$TARGET_DIR"
if ! npm install --production --ignore-scripts 2>/dev/null; then
    echo "Error: npm install failed."
    echo "Try running manually: cd $TARGET_DIR && npm install --production --verbose"
    exit 1
fi

# --- Symlink ---

if [ -w "/usr/local/bin" ]; then
    BIN_DIR="/usr/local/bin"
else
    BIN_DIR="$HOME/.local/bin"
    mkdir -p "$BIN_DIR"
    if ! echo "$PATH" | grep -q "$BIN_DIR"; then
        echo ""
        echo "Note: Add $BIN_DIR to your PATH:"
        echo "  echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> ~/.zshrc"
        echo "  source ~/.zshrc"
        echo ""
    fi
fi

LINK_TARGET="$BIN_DIR/$BIN_NAME"

# Remove old symlink if it exists
if [ -L "$LINK_TARGET" ] || [ -e "$LINK_TARGET" ]; then
    rm -f "$LINK_TARGET"
fi

ln -s "$TARGET_DIR/dist/cli.js" "$LINK_TARGET"
chmod +x "$TARGET_DIR/dist/cli.js"

# --- Cleanup old versions ---

for dir in "$INSTALL_DIR/versions"/*; do
    if [ -d "$dir" ] && [ "$(basename "$dir")" != "$VERSION_NUM" ]; then
        echo "Removing old version $(basename "$dir")..."
        rm -rf "$dir"
    fi
done

# --- Done ---

echo ""
echo "Installed $REPO $TAG to $LINK_TARGET"
echo "Run: $BIN_NAME --help"
```

**Note:** The `REPO` variable at line 3 must be updated to `owner/auto-image-editor` when the GitHub repo is created. The script will error with a clear message until this is set.

- [ ] **Step 2: Make it executable**

Run: `chmod +x install.sh`

- [ ] **Step 3: Verify syntax**

Run: `sh -n install.sh`
Expected: No output (no syntax errors)

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "feat: add curl-based install script"
```

---

### Task 4: Update install.sh REPO variable and README

**Files:**
- Modify: `install.sh` (line 3 — set REPO to actual `owner/auto-image-editor`)
- Modify: `README.md`

**Note:** This task is done AFTER the GitHub repo is created and the remote is configured. It cannot be done until the repo URL is known.

- [ ] **Step 1: Set the REPO variable in install.sh**

Edit `install.sh` line 3:
```sh
REPO="OWNER/auto-image-editor"
```
Replace `OWNER` with the actual GitHub username or org.

- [ ] **Step 2: Update README with install instructions**

Edit `README.md` — update the install section:

```markdown
## Install

```sh
curl -fsSL https://raw.githubusercontent.com/OWNER/auto-image-editor/main/install.sh | sh
```

Or pin a specific version:

```sh
VERSION=1.0.0 curl -fsSL https://raw.githubusercontent.com/OWNER/auto-image-editor/main/install.sh | sh
```

## Uninstall

```sh
rm -rf ~/.auto-image-editor /usr/local/bin/auto-image-editor
```
```

Replace `OWNER` with the actual GitHub username or org.

- [ ] **Step 3: Commit**

```bash
git add install.sh README.md
git commit -m "docs: update repo owner in install script and README"
```

---

## Self-Review

**Spec coverage:**
- Release workflow (test, build, package, changelog, create release) → Task 2
- Install script (resolve version, download, extract, npm install, symlink, cleanup) → Task 3
- prepublishOnly guard → Task 1
- Error handling (missing curl/node, permissions, download failure) → Task 3
- Version bumping & tagging → covered in spec, not a code task (manual process)
- README update → Task 4

**Placeholder scan:** `OWNER` appears in Task 4 as expected — that task is explicitly marked as post-repo-creation. No other TBDs.

**Type consistency:** No cross-task type references — each task produces an independent file.
