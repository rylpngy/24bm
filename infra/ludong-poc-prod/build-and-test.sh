#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
PROD_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
BUILD_FILE="$SCRIPT_DIR/docker-compose.build.yml"
VERIFICATION_STAMP="$SCRIPT_DIR/state/local-runtime-verified"
CLEAN_STAMP="$SCRIPT_DIR/state/clean-snapshot-ready"

die() {
  echo "错误: $*" >&2
  exit 1
}

check_architecture() {
  case "$(uname -m)" in
    x86_64|amd64) ;;
    *) die "仅支持 Linux amd64，当前架构为 $(uname -m)" ;;
  esac
}

check_files() {
  local env_file=$1
  [[ -f "$PROD_FILE" && -f "$BUILD_FILE" && -f "$env_file" ]] || die "部署配置不完整"
  command -v docker >/dev/null 2>&1 || die "未安装 docker"
  docker compose version >/dev/null 2>&1 || die "未安装 Docker Compose v2"
  docker compose --env-file "$env_file" -f "$PROD_FILE" -f "$BUILD_FILE" config --quiet
}

compose() {
  docker compose --env-file "$SCRIPT_DIR/.env" -f "$PROD_FILE" -f "$BUILD_FILE" "$@"
}

wait_for_service() {
  local service=$1
  local deadline=$((SECONDS + 300))
  while (( SECONDS < deadline )); do
    local container_id status
    container_id=$(compose ps -q "$service")
    if [[ -n "$container_id" ]]; then
      status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")
      case "$status" in
        healthy|running) return 0 ;;
        unhealthy|exited|dead) compose logs "$service" >&2; die "$service 状态异常: $status" ;;
      esac
    fi
    sleep 3
  done
  compose logs "$service" >&2
  die "等待 $service 健康超时"
}

verify_login() {
  local employee_no=$1
  local portal_port=$2
  local response
  response=$(curl --fail --silent --show-error \
    -H 'Content-Type: application/json' \
    -d "{\"account\":\"$employee_no\",\"password\":\"demo123456\",\"scope\":\"BUYER\",\"tenantId\":\"tenant-ludong-poc\"}" \
    "http://127.0.0.1:$portal_port/api/v1/auth/login")
  python3 -c 'import json,sys; assert json.load(sys.stdin).get("data",{}).get("accessToken")' <<<"$response"
}

if [[ ${1:-} == "--check" ]]; then
  check_architecture
  check_files "$SCRIPT_DIR/.env.example"
  exit 0
fi

[[ $# -eq 0 ]] || die "未知参数: $*"
[[ -f "$SCRIPT_DIR/.env" ]] || die "缺少 .env，请先执行 cp .env.example .env 并检查凭据"
check_architecture
check_files "$SCRIPT_DIR/.env"
docker info >/dev/null 2>&1 || die "Docker daemon 不可用"
command -v curl >/dev/null 2>&1 || die "未安装 curl"
command -v python3 >/dev/null 2>&1 || die "未安装 python3"

mkdir -p "$SCRIPT_DIR/state"
rm -f "$VERIFICATION_STAMP" "$CLEAN_STAMP"
compose build app portal
compose up -d postgres minio app portal
for service in postgres minio app portal; do
  wait_for_service "$service"
done

portal_port=$(sed -n 's/^PORTAL_PORT=//p' "$SCRIPT_DIR/.env" | tail -1)
portal_port=${portal_port:-5173}
curl --fail --silent --show-error "http://127.0.0.1:$portal_port/?solution=ludong-poc" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:$portal_port/api/v1/health" >/dev/null
for employee_no in LDU000001 LDU100001 LDU200001; do
  verify_login "$employee_no" "$portal_port"
done

{
  printf 'verified_at=%s\n' "$(date --iso-8601=seconds)"
  printf 'backend_image=%s\n' "$(compose images -q app)"
  printf 'portal_image=%s\n' "$(compose images -q portal)"
} >"$VERIFICATION_STAMP"

echo "本地服务已启动，页面、API 和三类手册账号已通过自动检查。"
echo "访问: http://127.0.0.1:$portal_port/?solution=ludong-poc"
echo "请按操作手册完成人工走查；交付前必须重新执行 prepare-clean-data.sh。"
