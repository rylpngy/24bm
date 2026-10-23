#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
PROD_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
IMAGE_ARCHIVE="$SCRIPT_DIR/images/24bid-ludong-amd64.tar"
POSTGRES_IMAGE=postgres:16.4-alpine
MINIO_IMAGE=minio/minio:RELEASE.2024-09-13T20-26-02Z
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
  [[ -f "$PROD_FILE" && -f "$env_file" && -f "$SCRIPT_DIR/start.sh" ]] || die "生产交付文件不完整"
  [[ -d "$SCRIPT_DIR/data/postgres" && -d "$SCRIPT_DIR/data/minio" ]] || die "数据目录不完整"
  command -v docker >/dev/null 2>&1 || die "未安装 docker"
  docker compose version >/dev/null 2>&1 || die "未安装 Docker Compose v2"
  docker compose --env-file "$env_file" -f "$PROD_FILE" config --quiet
}

if [[ ${1:-} == "--check" ]]; then
  check_architecture
  check_files "$SCRIPT_DIR/.env.example"
  exit 0
fi

[[ $# -eq 0 ]] || die "未知参数: $*"
[[ -f "$SCRIPT_DIR/.env" ]] || die "缺少 .env"
check_architecture
check_files "$SCRIPT_DIR/.env"
docker info >/dev/null 2>&1 || die "Docker daemon 不可用"
[[ -f "$VERIFICATION_STAMP" ]] || die "尚未完成本地启动验证，请先运行 build-and-test.sh"
[[ -f "$CLEAN_STAMP" ]] || die "尚未生成干净数据快照，请先运行 prepare-clean-data.sh --confirm-reset-ludong-poc"

set -a
# shellcheck disable=SC1091
source "$SCRIPT_DIR/.env"
set +a

compose=(docker compose --env-file "$SCRIPT_DIR/.env" -f "$PROD_FILE")
"${compose[@]}" down --remove-orphans
[[ -z "$("${compose[@]}" ps -q)" ]] || die "仍有项目容器运行，拒绝复制物理数据目录"
docker run --rm --user 0 \
  -v "$SCRIPT_DIR/data/postgres:/data:ro" \
  "$POSTGRES_IMAGE" \
  test -f /data/pgdata/PG_VERSION || die "PostgreSQL 数据未初始化"

app_image="24bid/ludong-backend:${BACKEND_IMAGE_TAG:-poc-20260902}"
portal_image="24bid/ludong-portal:${PORTAL_IMAGE_TAG:-poc-20260902}"
images=("$app_image" "$portal_image" "$POSTGRES_IMAGE" "$MINIO_IMAGE")
for image in "${images[@]}"; do
  docker image inspect "$image" >/dev/null 2>&1 || die "缺少镜像 $image"
done

mkdir -p "$SCRIPT_DIR/images"
docker save --output "$IMAGE_ARCHIVE" "${images[@]}"

version=${DELIVERY_VERSION:-$(date +%Y%m%d-%H%M%S)}
bundle_name="24bid-ludong-poc-$version"
stage_parent=$(mktemp -d "$SCRIPT_DIR/.pack.XXXXXX")
cleanup_stage() {
  docker run --rm --user 0 \
    -v "$stage_parent:/cleanup" \
    "$POSTGRES_IMAGE" \
    sh -c 'find /cleanup -mindepth 1 -delete' >/dev/null 2>&1 || true
  rmdir "$stage_parent" 2>/dev/null || true
}
trap cleanup_stage EXIT
stage="$stage_parent/$bundle_name"
mkdir -p "$stage/images" "$stage/nginx" "$stage/data"

cp "$PROD_FILE" "$stage/docker-compose.prod.yml"
cp "$SCRIPT_DIR/.env.example" "$stage/.env.example"
cp "$SCRIPT_DIR/start.sh" "$stage/start.sh"
cp "$SCRIPT_DIR/README.md" "$stage/README.md"
cp "$SCRIPT_DIR/nginx/24bid-ludong.conf.example" "$stage/nginx/"
cp "$IMAGE_ARCHIVE" "$stage/images/"

docker run --rm --user 0 \
  -v "$SCRIPT_DIR/data:/source:ro" \
  -v "$stage/data:/destination" \
  "$POSTGRES_IMAGE" \
  sh -c 'cd /source && tar cf - postgres minio | tar xf - -C /destination'

output="$SCRIPT_DIR/$bundle_name.tar.gz"
current_uid=$(id -u)
current_gid=$(id -g)
docker run --rm --user 0 \
  -v "$stage_parent:/source:ro" \
  -v "$(dirname "$output"):/output" \
  "$POSTGRES_IMAGE" \
  sh -c "cd /source && tar czf /output/$(basename "$output") '$bundle_name' && chown $current_uid:$current_gid /output/$(basename "$output")"

(cd "$(dirname "$output")" && sha256sum "$(basename "$output")") >"$output.sha256"
echo "交付包: $output"
echo "校验文件: $output.sha256"
