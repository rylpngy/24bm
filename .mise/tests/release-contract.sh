#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)

fail() {
  echo "mise 发版契约失败: $*" >&2
  exit 1
}

required_files=(
  .mise/config.toml
  .mise/README.md
  .mise/lib/release-common.sh
  .mise/tasks/release
  backend-java/.mise/config.toml
  backend-java/.mise/README.md
  backend-java/.mise/tasks/dev
  backend-java/.mise/tasks/test
  backend-java/.mise/tasks/release
  apps/tenant-portal/.mise/config.toml
  apps/tenant-portal/.mise/README.md
  apps/tenant-portal/.mise/tasks/dev
  apps/tenant-portal/.mise/tasks/test
  apps/tenant-portal/.mise/tasks/release
)

for relative_path in "${required_files[@]}"; do
  [[ -f "$ROOT/$relative_path" ]] || fail "缺少 $relative_path"
done

python3 - "$ROOT" <<'PY'
import sys
import tomllib
from pathlib import Path

root = Path(sys.argv[1])
for relative in (
    ".mise/config.toml",
    "backend-java/.mise/config.toml",
    "apps/tenant-portal/.mise/config.toml",
):
    with (root / relative).open("rb") as stream:
        tomllib.load(stream)
PY

for task in \
  "$ROOT/.mise/tasks/release" \
  "$ROOT/backend-java/.mise/tasks/dev" \
  "$ROOT/backend-java/.mise/tasks/test" \
  "$ROOT/backend-java/.mise/tasks/release" \
  "$ROOT/apps/tenant-portal/.mise/tasks/dev" \
  "$ROOT/apps/tenant-portal/.mise/tasks/test" \
  "$ROOT/apps/tenant-portal/.mise/tasks/release"; do
  [[ -x "$task" ]] || fail "任务不可执行: ${task#"$ROOT/"}"
  bash -n "$task"
done
bash -n "$ROOT/.mise/lib/release-common.sh"
grep -Fq 'release_sync_runtime' "$ROOT/.mise/lib/release-common.sh" || fail "发布流程未同步生产 Compose 文件"
grep -Fq 'diff --quiet' "$ROOT/.mise/lib/release-common.sh" || fail "发布流程未阻止未提交代码"

compose_json=$(mktemp)
fake_bin=$(mktemp -d)
trap 'rm -f "$compose_json"; rm -rf "$fake_bin"' EXIT

BACKEND_IMAGE_TAG=contract-backend \
PORTAL_IMAGE_TAG=contract-portal \
docker compose \
  --env-file "$ROOT/infra/ludong-poc-prod/.env.example" \
  -f "$ROOT/infra/ludong-poc-prod/docker-compose.prod.yml" \
  config --format json >"$compose_json"

python3 - "$compose_json" <<'PY'
import json
import sys
from pathlib import Path

services = json.loads(Path(sys.argv[1]).read_text())["services"]
assert services["app"]["image"] == "24bid/ludong-backend:contract-backend"
assert services["portal"]["image"] == "24bid/ludong-portal:contract-portal"
PY

common_env=(
  DEPLOY_TARGET=ludong-prod
  DEPLOY_ALLOWED_BRANCH=codex/ludong-poc-catalog-ai-manual
  DEPLOY_REMOTE_HOST=root@127.0.0.1
  DEPLOY_REMOTE_DIR=/tmp/ludong-contract
  DEPLOY_REMOTE_PORT=22
  DEPLOY_STARTUP_TIMEOUT=180
  DEPLOY_IMAGE_TAG_PREFIX=poc
)

pussh_output=$(env "${common_env[@]}" \
  MISE_PROJECT_ROOT="$ROOT/backend-java" \
  bash "$ROOT/backend-java/.mise/tasks/release" deploy --dry-run)
grep -Fq 'transport=docker-pussh' <<<"$pussh_output" || fail "可用时未选择 docker pussh"

cat >"$fake_bin/docker" <<'SH'
#!/usr/bin/env bash
if [[ ${1:-} == pussh ]]; then
  exit 1
fi
exec /usr/bin/docker "$@"
SH
chmod +x "$fake_bin/docker"

fallback_output=$(env "${common_env[@]}" \
  PATH="$fake_bin:$PATH" \
  MISE_PROJECT_ROOT="$ROOT/apps/tenant-portal" \
  bash "$ROOT/apps/tenant-portal/.mise/tasks/release" deploy --dry-run 2>&1)
grep -Fq 'WARNING:' <<<"$fallback_output" || fail "docker pussh 不可用时没有 warning"
grep -Fq 'transport=sftp' <<<"$fallback_output" || fail "docker pussh 不可用时未降级到 SFTP"

echo "mise 发版契约通过"
