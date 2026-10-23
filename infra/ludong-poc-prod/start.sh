#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
PROD_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
IMAGE_ARCHIVE="$SCRIPT_DIR/images/24bid-ludong-amd64.tar"

die() {
  echo "错误: $*" >&2
  exit 1
}

check_architecture() {
  case "$(uname -m)" in
    x86_64|amd64) ;;
    *) die "交付包仅支持 Linux amd64，当前架构为 $(uname -m)" ;;
  esac
}

check_files() {
  local env_file=$1
  [[ -f "$PROD_FILE" && -f "$env_file" ]] || die "缺少 docker-compose.prod.yml 或环境文件"
  [[ -d "$SCRIPT_DIR/data/postgres" && -d "$SCRIPT_DIR/data/minio" ]] || die "数据目录不完整"
  command -v docker >/dev/null 2>&1 || die "未安装 docker"
  docker compose version >/dev/null 2>&1 || die "未安装 Docker Compose v2"
  docker compose --env-file "$env_file" -f "$PROD_FILE" config --quiet
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

if [[ ${1:-} == "--check" ]]; then
  check_architecture
  check_files "$SCRIPT_DIR/.env.example"
  exit 0
fi

[[ $# -eq 0 ]] || die "未知参数: $*"
[[ -f "$SCRIPT_DIR/.env" ]] || die "缺少 .env，请从 .env.example 复制并检查凭据"
check_architecture
check_files "$SCRIPT_DIR/.env"
docker info >/dev/null 2>&1 || die "Docker daemon 不可用"

if [[ -f "$IMAGE_ARCHIVE" ]]; then
  docker load --input "$IMAGE_ARCHIVE"
fi

compose up -d
for service in postgres minio app portal; do
  wait_for_service "$service"
done

portal_port=$(sed -n 's/^PORTAL_PORT=//p' "$SCRIPT_DIR/.env" | tail -1)
portal_port=${portal_port:-5173}
echo "鲁东 POC 已启动: http://127.0.0.1:$portal_port/?solution=ludong-poc"
echo "请安装 nginx/24bid-ludong.conf.example，并仅对外开放 80/443。"
