#!/bin/bash
# post-build-server.sh
# bun build 后置检查：__dirname 硬编码检测 + SDK 资源复制 + vendor 签名
set -euo pipefail
cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

DIST="src-tauri/resources/server-dist.js"

# ── 1. __dirname 硬编码检测 ──────────────────────────────────────
echo -e "  ${CYAN}检查 server-dist.js 硬编码路径...${NC}"
if grep -qE 'var __dirname = "/Users/[^"]+' "$DIST"; then
    echo -e "${RED}✗ 错误: server-dist.js 包含硬编码的 __dirname 路径!${NC}"
    echo -e "${YELLOW}  检测到: $(grep -oE 'var __dirname = "[^"]+"' "$DIST" | head -1)${NC}"
    echo -e "${YELLOW}  请检查代码中是否使用了 __dirname (会被 bun build 硬编码)${NC}"
    echo -e "${YELLOW}  应使用 import.meta.url + fileURLToPath 在运行时获取路径${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ 无硬编码路径${NC}"

# ── 1.5 BUN_EXECUTABLE 检测 ──────────────────────────────────────
# macOS GUI 应用的 PATH 不含 bun，SDK 子进程 MUST 通过 BUN_EXECUTABLE 获取完整路径。
# 若 server-dist.js 不包含 BUN_EXECUTABLE，说明有人把 executable 写死为 "bun"。
echo -e "  ${CYAN}检查 BUN_EXECUTABLE 环境变量引用...${NC}"
if ! grep -q 'BUN_EXECUTABLE' "$DIST"; then
    echo -e "${RED}✗ 错误: server-dist.js 未引用 BUN_EXECUTABLE 环境变量!${NC}"
    echo -e "${YELLOW}  SDK 子进程的 executable 必须使用 process.env.BUN_EXECUTABLE || 'bun'${NC}"
    echo -e "${YELLOW}  否则 macOS release 构建会因 PATH 找不到 bun 而静默挂起${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ BUN_EXECUTABLE 引用存在${NC}"

# ── 2. 复制 SDK 依赖 ─────────────────────────────────────────────
echo -e "  ${CYAN}复制 SDK 依赖...${NC}"
SDK_SRC="node_modules/@anthropic-ai/claude-agent-sdk"
SDK_DEST="src-tauri/resources/claude-agent-sdk"
rm -rf "${SDK_DEST}"
mkdir -p "${SDK_DEST}"
cp "${SDK_SRC}/cli.js" "${SDK_DEST}/"
cp "${SDK_SRC}/sdk.mjs" "${SDK_DEST}/"
cp "${SDK_SRC}"/*.wasm "${SDK_DEST}/"
cp -R "${SDK_SRC}/vendor" "${SDK_DEST}/"
echo -e "${GREEN}  ✓ SDK 依赖已复制${NC}"

# ── 3. Vendor 二进制签名 (仅 macOS + 有签名身份时) ────────────────
if [[ "$(uname)" == "Darwin" ]]; then
    # 优先用环境变量，其次尝试从 keychain 查找
    if [ -z "${APPLE_SIGNING_IDENTITY:-}" ]; then
        APPLE_SIGNING_IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)"/\1/' 2>/dev/null || true)
    fi

    if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
        echo -e "  ${CYAN}签名 Vendor 二进制文件...${NC}"
        VENDOR_DIR="${SDK_DEST}/vendor"
        SIGNED_COUNT=0
        FAILED_COUNT=0

        while IFS= read -r binary; do
            echo -e "    ${CYAN}签名: $(basename "$binary")${NC}"
            if codesign --force --options runtime --timestamp \
                --sign "$APPLE_SIGNING_IDENTITY" "$binary" 2>/dev/null; then
                ((SIGNED_COUNT++))
            else
                echo -e "    ${YELLOW}警告: 签名失败 - $binary${NC}"
                ((FAILED_COUNT++))
            fi
        done < <(find "$VENDOR_DIR" -type f \( -name "*.node" -o -name "rg" \) -path "*darwin*")

        echo -e "${GREEN}  ✓ Vendor 签名完成 (成功: ${SIGNED_COUNT}, 失败: ${FAILED_COUNT})${NC}"
    else
        echo -e "  ${YELLOW}跳过 Vendor 签名 (未找到签名身份)${NC}"
    fi
else
    echo -e "  ${YELLOW}跳过 Vendor 签名 (非 macOS)${NC}"
fi
