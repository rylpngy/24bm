#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
PROD_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
POSTGRES_DATA="$SCRIPT_DIR/data/postgres"
MINIO_DATA="$SCRIPT_DIR/data/minio"
POSTGRES_IMAGE=postgres:16.4-alpine
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
  [[ -f "$PROD_FILE" && -f "$env_file" ]] || die "部署配置不完整"
  command -v docker >/dev/null 2>&1 || die "未安装 docker"
  docker compose version >/dev/null 2>&1 || die "未安装 Docker Compose v2"
  docker compose --env-file "$env_file" -f "$PROD_FILE" config --quiet
  [[ "$(realpath -m "$POSTGRES_DATA")" == "$SCRIPT_DIR/data/postgres" ]] || die "PostgreSQL 数据目录越界"
  [[ "$(realpath -m "$MINIO_DATA")" == "$SCRIPT_DIR/data/minio" ]] || die "MinIO 数据目录越界"
}

compose() {
  docker compose --env-file "$SCRIPT_DIR/.env" -f "$PROD_FILE" "$@"
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

[[ ${1:-} == "--confirm-reset-ludong-poc" && $# -eq 1 ]] || die "这是破坏性操作；请使用 --confirm-reset-ludong-poc 明确确认"
[[ -f "$SCRIPT_DIR/.env" ]] || die "缺少 .env，请先执行 cp .env.example .env 并检查凭据"
check_architecture
check_files "$SCRIPT_DIR/.env"
docker info >/dev/null 2>&1 || die "Docker daemon 不可用"
command -v curl >/dev/null 2>&1 || die "未安装 curl"
command -v python3 >/dev/null 2>&1 || die "未安装 python3"

set -a
# shellcheck disable=SC1091
source "$SCRIPT_DIR/.env"
set +a

mkdir -p "$SCRIPT_DIR/state"
rm -f "$CLEAN_STAMP"
compose down --remove-orphans

mkdir -p "$POSTGRES_DATA" "$MINIO_DATA"
current_uid=$(id -u)
current_gid=$(id -g)
docker run --rm --user 0 \
  -v "$SCRIPT_DIR/data:/data" \
  "$POSTGRES_IMAGE" \
  sh -c "find /data/postgres -mindepth 1 -maxdepth 1 ! -name .gitkeep -exec rm -rf -- {} +; \
    find /data/minio -mindepth 1 -maxdepth 1 ! -name .gitkeep -exec rm -rf -- {} +; \
    touch /data/postgres/.gitkeep /data/minio/.gitkeep; \
    chmod 755 /data/postgres /data/minio; \
    chmod 644 /data/postgres/.gitkeep /data/minio/.gitkeep; \
    chown $current_uid:$current_gid /data/postgres /data/minio \
      /data/postgres/.gitkeep /data/minio/.gitkeep"

compose up -d postgres minio app portal
for service in postgres minio app portal; do
  wait_for_service "$service"
done

portal_port=$(sed -n 's/^PORTAL_PORT=//p' "$SCRIPT_DIR/.env" | tail -1)
portal_port=${portal_port:-5173}
curl --fail --silent --show-error "http://127.0.0.1:$portal_port/api/v1/health" >/dev/null
for employee_no in LDU000001 LDU100001 LDU200001; do
  verify_login "$employee_no" "$portal_port"
done

tenant_count=$(compose exec -T postgres psql -U "${DB_USERNAME:-procurement}" -d "${DB_NAME:-procurement_saas}" -Atc \
  "select count(*) from tenants where id='tenant-ludong-poc' and status='active'")
user_count=$(compose exec -T postgres psql -U "${DB_USERNAME:-procurement}" -d "${DB_NAME:-procurement_saas}" -Atc \
  "select count(*) from users where tenant_id='tenant-ludong-poc' and employee_no in ('LDU000001','LDU100001','LDU200001')")
application_count=$(compose exec -T postgres psql -U "${DB_USERNAME:-procurement}" -d "${DB_NAME:-procurement_saas}" -Atc \
  "select count(*) from ludong_poc_applications where tenant_id='tenant-ludong-poc'")

[[ "$tenant_count" == "1" ]] || die "鲁东租户初始化失败"
[[ "$user_count" == "3" ]] || die "演示工号初始化失败: $user_count"
(( application_count >= 5 )) || die "POC 初始项目不足: $application_count"

compose down --remove-orphans
printf 'prepared_at=%s\n' "$(date --iso-8601=seconds)" >"$CLEAN_STAMP"
echo "干净数据已初始化并验证，所有容器已停止，可安全打包。"
