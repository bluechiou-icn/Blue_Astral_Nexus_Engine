#!/usr/bin/env bash
# Build-time: pull owner-only ext bundle from private repo into public/ext/.
#
# 環境變數（Vercel 設）：
#   PRIVATE_REPO_TOKEN   GitHub fine-grained PAT，read 權限 only on
#                        bluechiou-icn/Blue_ANE_Owner_Ext
#   PRIVATE_REPO_REF     branch / tag / sha（預設 main）
#
# 邏輯：
#   - 若 PRIVATE_REPO_TOKEN 未設 → 建立空目錄並結束（local build / fork build）
#   - 若有 token → shallow clone 私 repo，拷 public/ext/* → 本 repo public/ext/
#   - 不留任何私 repo 痕跡（clone tmp dir 拷完即刪）
#
# 不論結果如何，都不阻擋 build（公開部署可在缺 ext 的情況下正常運作）。

set -uo pipefail

EXT_DST="public/ext"
TMP_DIR=".owner-ext-tmp"
PRIVATE_REPO="bluechiou-icn/Blue_ANE_Owner_Ext"
REF="${PRIVATE_REPO_REF:-main}"

mkdir -p "$EXT_DST"

# 預設放一個 placeholder，確保 dynamic import 不會 404 → 中斷 loader 流程
# （middleware 仍會擋非 owner 拿到內容；owner 拿到的會是真實 ext）
cat > "$EXT_DST/index.js" <<'EOF'
// placeholder — overwritten at build time when PRIVATE_REPO_TOKEN is set
export function init() { /* no-op */ }
EOF

if [ -z "${PRIVATE_REPO_TOKEN:-}" ]; then
  echo "[pull-owner-ext] PRIVATE_REPO_TOKEN not set — skipping (placeholder kept)"
  exit 0
fi

echo "[pull-owner-ext] cloning ${PRIVATE_REPO}@${REF}…"
rm -rf "$TMP_DIR"
git clone --depth 1 --branch "$REF" \
  "https://x-access-token:${PRIVATE_REPO_TOKEN}@github.com/${PRIVATE_REPO}.git" \
  "$TMP_DIR" 2>&1 | sed 's/[A-Za-z0-9_-]\{20,\}/***REDACTED***/g'

if [ ! -d "$TMP_DIR/public/ext" ]; then
  echo "[pull-owner-ext] private repo missing public/ext/ — keeping placeholder"
  rm -rf "$TMP_DIR"
  exit 0
fi

cp -R "$TMP_DIR/public/ext/." "$EXT_DST/"
echo "[pull-owner-ext] copied client ext bundle:"
ls -la "$EXT_DST"

# 伺服端私有 bundle：lib/_private/（api/daily-fortune.js require 用，CommonJS）
# 公開 repo .gitignore 已擋 lib/_private/，build 時實體存在但永不入 git（防 IP 洩漏，Rule 5）
if [ -d "$TMP_DIR/lib/_private" ]; then
  mkdir -p lib/_private
  cp -R "$TMP_DIR/lib/_private/." lib/_private/
  echo "[pull-owner-ext] copied server-side lib/_private/:"
  ls -la lib/_private
else
  echo "[pull-owner-ext] private repo has no lib/_private/ — skipping server bundle"
fi

rm -rf "$TMP_DIR"
