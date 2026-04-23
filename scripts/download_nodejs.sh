#!/bin/bash
# Download Node.js LTS binaries for bundling with SoAgents.
#
# Downloads the official Node.js distribution for the target platform
# and extracts it into src-tauri/resources/nodejs/.
#
# The full distribution (node + npm) lets SoAgents install and run
# OpenClaw plugins without requiring users to pre-install Node.js.
#
# Usage:
#   ./scripts/download_nodejs.sh                   # current platform
#   ./scripts/download_nodejs.sh --target arm64    # specific macOS arch
#   ./scripts/download_nodejs.sh --target x64
#   ./scripts/download_nodejs.sh --clean           # wipe existing first
#
# Idempotent: if resources/nodejs/bin/node already matches the target
# version + architecture, the script exits without re-downloading.

set -e

# ───────────── Configuration ─────────────
NODE_VERSION="24.14.0"  # Active LTS — matches MyAgents
NODE_BASE_URL="https://nodejs.org/dist/v${NODE_VERSION}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESOURCES_DIR="${PROJECT_DIR}/src-tauri/resources/nodejs"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log_info()  { echo -e "${BLUE}[nodejs]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[nodejs]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[nodejs]${NC} $1"; }
log_error() { echo -e "${RED}[nodejs]${NC} $1"; }

# ───────────── Helpers ─────────────

# Returns 0 if resources/nodejs already has correct version+arch, else 1.
check_existing() {
    local node_bin="$1"
    local expected_arch="$2"
    if [[ ! -f "$node_bin" ]]; then return 1; fi

    local existing_ver
    existing_ver=$("$node_bin" --version 2>/dev/null || echo "")
    if [[ "$existing_ver" != "v${NODE_VERSION}" ]]; then return 1; fi

    if [[ -n "$expected_arch" && "$(uname -s)" == "Darwin" ]]; then
        local file_info
        file_info=$(file "$node_bin" 2>/dev/null || echo "")
        if [[ "$expected_arch" == "arm64" && "$file_info" != *"arm64"* ]]; then
            log_warn "Arch mismatch: expected arm64, got x86_64"
            return 1
        fi
        if [[ "$expected_arch" == "x64" && "$file_info" != *"x86_64"* ]]; then
            log_warn "Arch mismatch: expected x64, got arm64"
            return 1
        fi
    fi
    return 0
}

# Download + extract Node.js for macOS (arm64 or x64).
# Strips bin/corepack, include/, share/, lib/node_modules/corepack to reduce size.
# Converts npm/npx symlinks to shell scripts (Tauri resource copy loses symlinks).
download_macos() {
    local arch="$1"  # arm64 | x64
    local node_bin="${RESOURCES_DIR}/bin/node"

    if check_existing "$node_bin" "$arch"; then
        log_ok "macOS ${arch}: already at v${NODE_VERSION}, skipping download"
        return 0
    fi

    local tarball="node-v${NODE_VERSION}-darwin-${arch}.tar.xz"
    local url="${NODE_BASE_URL}/${tarball}"

    log_info "Downloading Node.js v${NODE_VERSION} for macOS ${arch}..."

    local tmp_dir
    tmp_dir=$(mktemp -d)
    trap "rm -rf '$tmp_dir'" RETURN

    curl -fsSL "$url" -o "${tmp_dir}/${tarball}" \
        || { log_error "curl failed: $url"; return 1; }

    log_info "Extracting..."
    mkdir -p "$RESOURCES_DIR"
    tar xf "${tmp_dir}/${tarball}" -C "$tmp_dir"

    local extracted_dir="${tmp_dir}/node-v${NODE_VERSION}-darwin-${arch}"
    rm -rf "$RESOURCES_DIR"
    mkdir -p "$RESOURCES_DIR"
    cp -R "${extracted_dir}/bin" "$RESOURCES_DIR/"
    cp -R "${extracted_dir}/lib" "$RESOURCES_DIR/"

    # Convert npm/npx symlinks → real shell scripts.
    # Tauri's resource copy drops symlinks, which would leave empty files.
    for cmd in npm npx; do
        local link_target
        link_target=$(readlink "${RESOURCES_DIR}/bin/${cmd}" 2>/dev/null || echo "")
        if [[ -n "$link_target" ]]; then
            local cli_name
            if [[ "$cmd" == "npm" ]]; then cli_name="npm-cli"; else cli_name="npx-cli"; fi
            rm -f "${RESOURCES_DIR}/bin/${cmd}"
            cat > "${RESOURCES_DIR}/bin/${cmd}" <<EOF
#!/bin/sh
basedir=\$(cd "\$(dirname "\$0")" && pwd)
exec "\$basedir/node" "\$basedir/../lib/node_modules/npm/bin/${cli_name}.js" "\$@"
EOF
            chmod +x "${RESOURCES_DIR}/bin/${cmd}"
        fi
    done

    # Strip unneeded files to reduce bundle size (~30 MB saved)
    rm -rf "${RESOURCES_DIR}/bin/corepack"
    rm -rf "${RESOURCES_DIR}/include"
    rm -rf "${RESOURCES_DIR}/share"
    rm -rf "${RESOURCES_DIR}/lib/node_modules/corepack"

    chmod +x "${RESOURCES_DIR}/bin/node"

    log_ok "macOS ${arch}: Node.js v${NODE_VERSION} ready"
}

# ───────────── Main ─────────────

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}Node.js v${NODE_VERSION} Download${NC}               ${CYAN}║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════╝${NC}"
echo ""

if [[ "$1" == "--clean" ]]; then
    log_warn "Cleaning existing Node.js resources..."
    rm -rf "$RESOURCES_DIR"
    mkdir -p "$RESOURCES_DIR"
    touch "$RESOURCES_DIR/.gitkeep"
    shift
fi

if [[ "$1" == "--target" ]]; then
    TARGET_ARCH="${2:-}"
    case "$TARGET_ARCH" in
        arm64|aarch64) download_macos "arm64" ;;
        x64|x86_64)    download_macos "x64" ;;
        *)
            log_error "Invalid target: '${TARGET_ARCH}' (expected arm64|aarch64|x64|x86_64)"
            exit 1
            ;;
    esac
else
    # Current platform
    ARCH=$(uname -m)
    PLATFORM=$(uname -s)
    if [[ "$PLATFORM" == "Darwin" ]]; then
        if [[ "$ARCH" == "arm64" ]]; then download_macos "arm64"
        else                              download_macos "x64"
        fi
    else
        log_error "Unsupported platform: $PLATFORM (only macOS for now)"
        exit 1
    fi
fi

echo ""
log_ok "Done! Node.js at: ${RESOURCES_DIR}"

if [[ -f "${RESOURCES_DIR}/bin/node" ]]; then
    ver=$("${RESOURCES_DIR}/bin/node" --version 2>/dev/null || echo "unknown")
    log_info "Bundled node: ${ver}"
    du -sh "${RESOURCES_DIR}" 2>/dev/null | awk '{print "  Total: " $1}'
    du -sh "${RESOURCES_DIR}/bin/node" 2>/dev/null | awk '{print "  node binary: " $1}'
fi
