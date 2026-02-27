#!/bin/bash
# SoAgents Release Script
# Bump version → Generate CHANGELOG → Commit → Tag → Build → Publish
#
# Usage:
#   ./release.sh patch          # 0.1.0 → 0.1.1
#   ./release.sh minor          # 0.1.0 → 0.2.0
#   ./release.sh major          # 0.1.0 → 1.0.0
#   ./release.sh 0.2.0          # explicit version
#   ./release.sh patch --skip-build   # skip build & publish, only version + changelog + tag
#   ./release.sh patch --dry-run      # preview changes without writing

set -euo pipefail
cd "$(dirname "$0")"

# ── Colors ───────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}▸${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
err()   { echo -e "${RED}✗${NC} $1"; exit 1; }

# ── Parse args ───────────────────────────────────────────────────
BUMP_ARG="${1:-}"
SKIP_BUILD=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --dry-run)    DRY_RUN=true ;;
  esac
done

if [ -z "$BUMP_ARG" ]; then
  echo -e "${BOLD}Usage:${NC} ./release.sh <patch|minor|major|x.y.z> [--skip-build] [--dry-run]"
  echo ""
  echo "Examples:"
  echo "  ./release.sh patch            # 0.1.0 → 0.1.1"
  echo "  ./release.sh minor            # 0.1.0 → 0.2.0"
  echo "  ./release.sh 0.2.0            # explicit version"
  echo "  ./release.sh patch --skip-build"
  echo "  ./release.sh patch --dry-run"
  exit 1
fi

# ── Preflight checks ────────────────────────────────────────────
info "Preflight checks..."

# Clean working tree
if [ -n "$(git status --porcelain)" ]; then
  err "Working tree not clean. Commit or stash changes first."
fi

# On main branch
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  warn "Not on main branch (current: $BRANCH)"
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi

# ── Calculate new version ────────────────────────────────────────
CURRENT_VERSION=$(node -p "require('./package.json').version")
info "Current version: ${BOLD}v${CURRENT_VERSION}${NC}"

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case "$BUMP_ARG" in
  patch)  NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))" ;;
  minor)  NEW_VERSION="$MAJOR.$((MINOR + 1)).0" ;;
  major)  NEW_VERSION="$((MAJOR + 1)).0.0" ;;
  --*)    err "First argument must be version bump type or version number" ;;
  *)
    if [[ "$BUMP_ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      NEW_VERSION="$BUMP_ARG"
    else
      err "Invalid version format: $BUMP_ARG (expected x.y.z)"
    fi
    ;;
esac

info "New version:     ${BOLD}v${NEW_VERSION}${NC}"
echo ""

# ── Generate CHANGELOG from commits ─────────────────────────────
info "Generating changelog from commits since v${CURRENT_VERSION}..."

LAST_TAG="v${CURRENT_VERSION}"
if ! git rev-parse "$LAST_TAG" &>/dev/null; then
  warn "Tag $LAST_TAG not found, using all commits"
  LAST_TAG=$(git rev-list --max-parents=0 HEAD)
fi

# Collect conventional commits grouped by type
FEATS=""
FIXES=""
IMPROVEMENTS=""
OTHERS=""

while IFS= read -r line; do
  # Extract type and message: "feat: xxx" or "feat(scope): xxx"
  TYPE=$(echo "$line" | sed -nE 's/^(feat|fix|chore|docs|refactor|perf|style|test|ci|build)(\([^)]*\))?: .*/\1/p')
  if [ -n "$TYPE" ]; then
    MSG=$(echo "$line" | sed -E 's/^[a-z]+(\([^)]*\))?: //')
    ENTRY="- ${MSG}"

    case "$TYPE" in
      feat)                   FEATS+="${ENTRY}"$'\n' ;;
      fix)                    FIXES+="${ENTRY}"$'\n' ;;
      refactor|perf|style)    IMPROVEMENTS+="${ENTRY}"$'\n' ;;
      *)                      OTHERS+="${ENTRY}"$'\n' ;;
    esac
  fi
done < <(git log "${LAST_TAG}..HEAD" --pretty=format:"%s" --reverse && echo)

# Build changelog section
TODAY=$(date +%Y-%m-%d)
CHANGELOG_SECTION="## [${NEW_VERSION}] - ${TODAY}"$'\n'

if [ -n "$FEATS" ]; then
  CHANGELOG_SECTION+=$'\n'"### 新增"$'\n'"${FEATS}"
fi
if [ -n "$FIXES" ]; then
  CHANGELOG_SECTION+=$'\n'"### 修复"$'\n'"${FIXES}"
fi
if [ -n "$IMPROVEMENTS" ]; then
  CHANGELOG_SECTION+=$'\n'"### 改进"$'\n'"${IMPROVEMENTS}"
fi
if [ -n "$OTHERS" ]; then
  CHANGELOG_SECTION+=$'\n'"### 其他"$'\n'"${OTHERS}"
fi

echo -e "${CYAN}Generated changelog:${NC}"
echo "─────────────────────────────────────"
echo "$CHANGELOG_SECTION"
echo "─────────────────────────────────────"
echo ""

# ── Dry run: show what would happen and exit ─────────────────────
if $DRY_RUN; then
  echo -e "${YELLOW}=== DRY RUN ===${NC}"
  echo "Would update versions in:"
  echo "  - package.json:         ${CURRENT_VERSION} → ${NEW_VERSION}"
  echo "  - src-tauri/tauri.conf.json: ${CURRENT_VERSION} → ${NEW_VERSION}"
  echo "  - src-tauri/Cargo.toml: ${CURRENT_VERSION} → ${NEW_VERSION}"
  echo "Would update CHANGELOG.md"
  echo "Would commit: chore: release v${NEW_VERSION}"
  echo "Would tag: v${NEW_VERSION}"
  if ! $SKIP_BUILD; then
    echo "Would build and publish via publish_macos.sh"
  fi
  exit 0
fi

# ── Confirm ──────────────────────────────────────────────────────
read -p "$(echo -e "${BOLD}Proceed with release v${NEW_VERSION}?${NC} [y/N] ")" -n 1 -r
echo
[[ $REPLY =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }

# ── Bump version in all files ────────────────────────────────────
info "Bumping version to ${NEW_VERSION}..."

# package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '${NEW_VERSION}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
ok "package.json"

# tauri.conf.json
node -e "
const fs = require('fs');
const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
conf.version = '${NEW_VERSION}';
fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
"
ok "src-tauri/tauri.conf.json"

# Cargo.toml (use sed for TOML — only the first version = line under [package])
sed -i '' "s/^version = \"${CURRENT_VERSION}\"/version = \"${NEW_VERSION}\"/" src-tauri/Cargo.toml
ok "src-tauri/Cargo.toml"

# ── Update CHANGELOG.md ─────────────────────────────────────────
info "Updating CHANGELOG.md..."

# Strategy:
#   1. Keep header (lines before [Unreleased])
#   2. Reset [Unreleased] to empty
#   3. Insert new version section (generated + any existing [Unreleased] content)
#   4. Keep the rest

CHANGELOG_FILE="CHANGELOG.md"
TEMP_FILE=$(mktemp)

# Read current [Unreleased] content (between ## [Unreleased] and next ## [...])
UNRELEASED_CONTENT=$(awk '/^## \[Unreleased\]/{found=1; next} /^## \[/{found=0} found{print}' "$CHANGELOG_FILE" | sed '/^$/d')

{
  # Header: everything up to and including ## [Unreleased]
  awk '/^## \[Unreleased\]/{print; exit} {print}' "$CHANGELOG_FILE"
  echo ""

  # Merge: existing [Unreleased] manual notes + auto-generated from commits
  if [ -n "$UNRELEASED_CONTENT" ]; then
    echo "<!-- 以下内容已合并到 v${NEW_VERSION} -->"
    echo ""
  fi

  echo "---"
  echo ""

  # New version section
  echo "$CHANGELOG_SECTION"

  # Rest: from the previous version section onward
  awk 'BEGIN{skip=0} /^## \[Unreleased\]/{skip=1; next} skip && /^## \[/{skip=0; print; next} !skip{print}' "$CHANGELOG_FILE" | tail -n +1

} > "$TEMP_FILE"

# Also update the comparison links at the bottom
# Add new version link and update [Unreleased] link
if grep -q "^\[Unreleased\]:" "$TEMP_FILE"; then
  sed -i '' "s|\[Unreleased\]:.*|[Unreleased]: https://github.com/applre/SoAgents/compare/v${NEW_VERSION}...HEAD|" "$TEMP_FILE"
  # Insert new version link after [Unreleased] line
  sed -i '' "/^\[Unreleased\]:/a\\
[${NEW_VERSION}]: https://github.com/applre/SoAgents/compare/v${CURRENT_VERSION}...v${NEW_VERSION}" "$TEMP_FILE"
else
  # Append links if not present
  echo "" >> "$TEMP_FILE"
  echo "[Unreleased]: https://github.com/applre/SoAgents/compare/v${NEW_VERSION}...HEAD" >> "$TEMP_FILE"
  echo "[${NEW_VERSION}]: https://github.com/applre/SoAgents/compare/v${CURRENT_VERSION}...v${NEW_VERSION}" >> "$TEMP_FILE"
fi

mv "$TEMP_FILE" "$CHANGELOG_FILE"
ok "CHANGELOG.md"

# ── Let user review CHANGELOG ───────────────────────────────────
echo ""
info "CHANGELOG.md updated. Review with: ${CYAN}git diff CHANGELOG.md${NC}"
read -p "$(echo -e "Edit CHANGELOG.md before committing? [y/N] ")" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  ${EDITOR:-vim} "$CHANGELOG_FILE"
fi

# ── Commit + Tag ─────────────────────────────────────────────────
info "Committing release..."

git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml CHANGELOG.md
# Also add Cargo.lock if it changed
[ -f src-tauri/Cargo.lock ] && git add src-tauri/Cargo.lock 2>/dev/null || true

git commit -m "$(cat <<EOF
chore: release v${NEW_VERSION}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
ok "Committed"

git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"
ok "Tagged v${NEW_VERSION}"

# ── Push ─────────────────────────────────────────────────────────
info "Pushing to remote..."
git push && git push --tags
ok "Pushed to remote"

# ── Build + Publish ──────────────────────────────────────────────
if $SKIP_BUILD; then
  warn "Skipping build & publish (--skip-build)"
  echo ""
  echo -e "${GREEN}${BOLD}Release v${NEW_VERSION} tagged and pushed!${NC}"
  echo "To build and publish later:"
  echo "  TAURI_SIGNING_PRIVATE_KEY=\"\$(cat ~/.tauri/soagents.key)\" npm run tauri:build"
  echo "  ./publish_macos.sh"
  exit 0
fi

echo ""
info "Building SoAgents v${NEW_VERSION}..."

# Source .env for signing key
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Ensure signing key is set
if [ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ] && [ -f "$HOME/.tauri/soagents.key" ]; then
  export TAURI_SIGNING_PRIVATE_KEY="$(cat "$HOME/.tauri/soagents.key")"
fi

npm run tauri:build

ok "Build complete"

echo ""
info "Publishing to R2..."
./publish_macos.sh

echo ""
echo "═══════════════════════════════════════════════════"
echo -e "  ${GREEN}${BOLD}SoAgents v${NEW_VERSION} released!${NC}"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Tag:       v${NEW_VERSION}"
echo "  Manifest:  https://download.soagents.ai/update/darwin-aarch64.json"
echo "  GitHub:    https://github.com/applre/SoAgents/releases/tag/v${NEW_VERSION}"
echo ""
