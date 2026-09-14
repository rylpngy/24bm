#!/usr/bin/env bash

release_die() {
  printf '错误: %s\n' "$*" >&2
  exit 1
}

release_warn() {
  printf 'WARNING: %s\n' "$*" >&2
}

release_require() {
  command -v "$1" >/dev/null 2>&1 || release_die "缺少命令: $1"
}

release_repo_root() {
  git -C "${MISE_PROJECT_ROOT:?MISE_PROJECT_ROOT 未设置}" rev-parse --show-toplevel
}

release_id_default() {
  local root=$1 revision
  revision=$(git -C "$root" rev-parse --short=8 HEAD)
  printf '%s-%s\n' "$(date +%Y%m%d-%H%M%S)" "$revision"
}

release_check_branch() {
  local root=$1 branch
  branch=$(git -C "$root" branch --show-current)
  [[ -n "$branch" ]] || release_die "当前处于 detached HEAD，拒绝发布"
  [[ "$branch" == "${DEPLOY_ALLOWED_BRANCH:?DEPLOY_ALLOWED_BRANCH 未设置}" ]] || \
    release_die "当前分支为 $branch，只允许从 $DEPLOY_ALLOWED_BRANCH 发布"
  git -C "$root" diff --quiet || release_die "存在未提交的工作区变更，拒绝发布"
  git -C "$root" diff --cached --quiet || release_die "存在未提交的暂存区变更，拒绝发布"
}

release_confirm() {
  local action=$1 assume_yes=$2 answer
  [[ "$assume_yes" == true ]] && return 0
  [[ -t 0 ]] || release_die "非交互环境必须显式传 --yes"
  printf '确认%s到 %s (%s)？输入 yes 继续: ' "$action" "$DEPLOY_TARGET" "$DEPLOY_REMOTE_HOST"
  read -r answer
  [[ "$answer" == yes ]] || release_die "已取消"
}

release_init_ssh() {
  RELEASE_SSH_ARGS=(-4 -p "${DEPLOY_REMOTE_PORT:-22}" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)
  RELEASE_SFTP_ARGS=(-4 -P "${DEPLOY_REMOTE_PORT:-22}" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)
}

release_ssh() {
  ssh "${RELEASE_SSH_ARGS[@]}" "$DEPLOY_REMOTE_HOST" "$@"
}

release_transport() {
  if docker pussh --help >/dev/null 2>&1; then
    printf '%s\n' docker-pussh
  else
    release_warn "docker pussh 不可用，将降级使用 SFTP"
    printf '%s\n' sftp
  fi
}

release_sftp_image() {
  local image=$1 remote_release_dir=$2 temp_dir archive checksum
  temp_dir=$(mktemp -d)
  archive="$temp_dir/image.tar.gz"
  trap 'rm -rf "${temp_dir:-}"' RETURN
  printf '导出镜像 %s ...\n' "$image"
  docker save "$image" | gzip -1 >"$archive"
  checksum=$(sha256sum "$archive" | awk '{print $1}')
  release_ssh "mkdir -p '$remote_release_dir'"
  sftp "${RELEASE_SFTP_ARGS[@]}" "$DEPLOY_REMOTE_HOST" <<EOF
put $archive $remote_release_dir/image.tar.gz
EOF
  release_ssh bash -s -- "$remote_release_dir/image.tar.gz" "$checksum" <<'REMOTE'
set -Eeuo pipefail
archive=$1
expected=$2
actual=$(sha256sum "$archive" | awk '{print $1}')
[[ "$actual" == "$expected" ]]
gzip -dc "$archive" | docker load
REMOTE
  rm -rf "$temp_dir"
  trap - RETURN
}

release_transfer_image() {
  local image=$1 remote_release_dir=$2 transport=$3 pussh_target
  release_ssh "mkdir -p '$remote_release_dir'"
  if [[ "$transport" == docker-pussh ]]; then
    pussh_target=$DEPLOY_REMOTE_HOST
    [[ "${DEPLOY_REMOTE_PORT:-22}" == 22 ]] || pussh_target="$pussh_target:$DEPLOY_REMOTE_PORT"
    if docker pussh --platform linux/amd64 "$image" "$pussh_target"; then
      return 0
    fi
    release_warn "docker pussh 传输失败，将降级使用 SFTP"
  fi
  release_sftp_image "$image" "$remote_release_dir"
}

release_compose_env_file() {
  local root=$1
  if [[ -f "$root/infra/ludong-poc-prod/.env" ]]; then
    printf '%s\n' "$root/infra/ludong-poc-prod/.env"
  else
    printf '%s\n' "$root/infra/ludong-poc-prod/.env.example"
  fi
}

release_build_component() {
  local root=$1 tag=$2 env_file prod build
  env_file=$(release_compose_env_file "$root")
  prod="$root/infra/ludong-poc-prod/docker-compose.prod.yml"
  build="$root/infra/ludong-poc-prod/docker-compose.build.yml"
  case "$RELEASE_COMPONENT" in
    backend)
      BACKEND_IMAGE_TAG="$tag" docker compose --env-file "$env_file" -f "$prod" -f "$build" build app
      ;;
    frontend)
      PORTAL_IMAGE_TAG="$tag" docker compose --env-file "$env_file" -f "$prod" -f "$build" build portal
      ;;
    *) release_die "未知组件: $RELEASE_COMPONENT" ;;
  esac
  docker image inspect "$RELEASE_IMAGE_REPOSITORY:$tag" >/dev/null
}

release_test_component() {
  local root=$1
  case "$RELEASE_COMPONENT" in
    backend) (cd "$root/backend-java" && mvn test) ;;
    frontend) (cd "$root/apps/tenant-portal" && pnpm typecheck && pnpm exec vitest run) ;;
  esac
}

release_backup_database() {
  local remote_release_dir=$1
  release_ssh bash -s -- "$DEPLOY_REMOTE_DIR" "$remote_release_dir" <<'REMOTE'
set -Eeuo pipefail
cd "$1"
release_dir=$2
mkdir -p "$release_dir"
umask 077
docker compose --env-file .env -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip -1 >"$release_dir/database.sql.gz"
test -s "$release_dir/database.sql.gz"
REMOTE
}

release_sync_runtime() {
  local root=$1 remote_release_dir=$2 source checksum
  source="$root/infra/ludong-poc-prod/docker-compose.prod.yml"
  checksum=$(sha256sum "$source" | awk '{print $1}')
  release_ssh "mkdir -p '$remote_release_dir'"
  sftp "${RELEASE_SFTP_ARGS[@]}" "$DEPLOY_REMOTE_HOST" <<EOF
put $source $remote_release_dir/docker-compose.prod.yml
EOF
  release_ssh bash -s -- "$DEPLOY_REMOTE_DIR" "$remote_release_dir/docker-compose.prod.yml" "$checksum" <<'REMOTE'
set -Eeuo pipefail
root=$1
candidate=$2
expected=$3
actual=$(sha256sum "$candidate" | awk '{print $1}')
[[ "$actual" == "$expected" ]]
cd "$root"
docker compose --env-file .env -f "$candidate" config --quiet
cp -p docker-compose.prod.yml "$candidate.previous"
install -m 0644 "$candidate" docker-compose.prod.yml
REMOTE
}

release_activate() {
  local remote_release_dir=$1 tag=$2 revision=$3 transport=$4
  release_ssh bash -s -- \
    "$DEPLOY_REMOTE_DIR" "$remote_release_dir" "$RELEASE_SERVICE" "$RELEASE_ENV_KEY" \
    "$tag" "$revision" "$transport" "${DEPLOY_STARTUP_TIMEOUT:-180}" <<'REMOTE'
set -Eeuo pipefail
root=$1
release_dir=$2
service=$3
key=$4
tag=$5
revision=$6
transport=$7
timeout=$8
cd "$root"
compose=(docker compose --env-file .env -f docker-compose.prod.yml)
mkdir -p "$release_dir"

set_env() {
  local name=$1 value=$2 temp
  temp=$(mktemp .env.XXXXXX)
  awk -v key="$name" -v value="$value" '
    BEGIN { found=0 }
    index($0, key "=") == 1 { print key "=" value; found=1; next }
    { print }
    END { if (!found) print key "=" value }
  ' .env >"$temp"
  chmod --reference=.env "$temp"
  mv "$temp" .env
}

container_id=$("${compose[@]}" ps -q "$service")
[[ -n "$container_id" ]]
previous_ref=$(docker inspect --format '{{.Config.Image}}' "$container_id")
previous_tag=${previous_ref##*:}
printf '%s\n' "$previous_tag" >"$release_dir/previous-tag"
set_env "$key" "$tag"
if ! "${compose[@]}" up -d --no-deps --force-recreate "$service"; then
  set_env "$key" "$previous_tag"
  "${compose[@]}" up -d --no-deps --force-recreate "$service"
  exit 1
fi

deadline=$((SECONDS + timeout))
while (( SECONDS < deadline )); do
  container_id=$("${compose[@]}" ps -q "$service")
  state=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)
  [[ "$state" == healthy ]] && break
  [[ "$state" == exited || "$state" == dead ]] && break
  sleep 3
done
if [[ "${state:-}" != healthy ]]; then
  docker logs --tail 100 "$container_id" >&2 || true
  set_env "$key" "$previous_tag"
  "${compose[@]}" up -d --no-deps --force-recreate "$service"
  exit 1
fi
printf 'component=%s\ntag=%s\nrevision=%s\ntransport=%s\ndeployed_at=%s\n' \
  "$service" "$tag" "$revision" "$transport" "$(date -Iseconds)" >"$release_dir/release.env"
REMOTE
}

release_rollback() {
  local remote_release_dir=$1
  release_ssh bash -s -- "$DEPLOY_REMOTE_DIR" "$remote_release_dir" "$RELEASE_SERVICE" "$RELEASE_ENV_KEY" "${DEPLOY_STARTUP_TIMEOUT:-180}" <<'REMOTE'
set -Eeuo pipefail
root=$1
release_dir=$2
service=$3
key=$4
timeout=$5
[[ -s "$release_dir/previous-tag" ]] || { echo "缺少回滚信息: $release_dir/previous-tag" >&2; exit 1; }
previous_tag=$(cat "$release_dir/previous-tag")
cd "$root"
temp=$(mktemp .env.XXXXXX)
awk -v key="$key" -v value="$previous_tag" '
  BEGIN { found=0 }
  index($0, key "=") == 1 { print key "=" value; found=1; next }
  { print }
  END { if (!found) print key "=" value }
' .env >"$temp"
chmod --reference=.env "$temp"
mv "$temp" .env
compose=(docker compose --env-file .env -f docker-compose.prod.yml)
"${compose[@]}" up -d --no-deps --force-recreate "$service"
deadline=$((SECONDS + timeout))
while (( SECONDS < deadline )); do
  id=$("${compose[@]}" ps -q "$service")
  state=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true)
  [[ "$state" == healthy ]] && exit 0
  [[ "$state" == exited || "$state" == dead ]] && break
  sleep 3
done
docker logs --tail 100 "${id:-}" >&2 || true
exit 1
REMOTE
}

release_status() {
  release_ssh bash -s -- "$DEPLOY_REMOTE_DIR" "$RELEASE_SERVICE" <<'REMOTE'
set -Eeuo pipefail
cd "$1"
docker compose --env-file .env -f docker-compose.prod.yml ps "$2"
id=$(docker compose --env-file .env -f docker-compose.prod.yml ps -q "$2")
[[ -n "$id" ]]
docker inspect --format 'image={{.Config.Image}} status={{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id"
REMOTE
}

release_main() {
  local mode=${1:-build} only_release_id='' dry_run=false assume_yes=false with_test=false
  [[ $# -eq 0 ]] || shift
  while (($#)); do
    case "$1" in
      --dry-run) dry_run=true ;;
      --yes) assume_yes=true ;;
      --with-test) with_test=true ;;
      --release)
        shift
        (($#)) || release_die "--release 缺少值"
        only_release_id=$1
        ;;
      -h|--help)
        printf '用法: mise run release [build|status|deploy|rollback] [--release ID] [--dry-run] [--yes] [--with-test]\n'
        return 0
        ;;
      *) release_die "未知参数: $1" ;;
    esac
    shift
  done
  case "$mode" in build|status|deploy|rollback) ;; *) release_die "未知模式: $mode" ;; esac

  local root revision release_id tag image remote_release_dir transport
  root=$(release_repo_root)
  revision=$(git -C "$root" rev-parse HEAD)
  release_id=${only_release_id:-$(release_id_default "$root")}
  tag="${DEPLOY_IMAGE_TAG_PREFIX:-poc}-$release_id"
  image="$RELEASE_IMAGE_REPOSITORY:$tag"
  remote_release_dir="$DEPLOY_REMOTE_DIR/.releases/$RELEASE_COMPONENT/$release_id"
  release_init_ssh

  if [[ "$mode" == status ]]; then
    if [[ "$dry_run" == true ]]; then
      printf 'component=%s\nmode=status\nremote=%s:%s\n' "$RELEASE_COMPONENT" "$DEPLOY_REMOTE_HOST" "$DEPLOY_REMOTE_DIR"
    else
      release_status
    fi
    return
  fi

  if [[ "$mode" == rollback ]]; then
    [[ -n "$only_release_id" ]] || release_die "rollback 必须传 --release ID"
    if [[ "$dry_run" == true ]]; then
      printf 'component=%s\nmode=rollback\nrelease=%s\nremote=%s\n' "$RELEASE_COMPONENT" "$release_id" "$remote_release_dir"
      return
    fi
    release_check_branch "$root"
    release_confirm "回滚 $RELEASE_COMPONENT" "$assume_yes"
    release_rollback "$remote_release_dir"
    return
  fi

  transport=$(release_transport)
  printf 'component=%s\nmode=%s\nrelease=%s\nimage=%s\ntransport=%s\nremote=%s:%s\n' \
    "$RELEASE_COMPONENT" "$mode" "$release_id" "$image" "$transport" "$DEPLOY_REMOTE_HOST" "$DEPLOY_REMOTE_DIR"
  [[ "$dry_run" == true ]] && return 0

  release_require docker
  [[ "$with_test" == false ]] || release_test_component "$root"
  release_build_component "$root" "$tag"
  [[ "$mode" == build ]] && return 0

  release_check_branch "$root"
  release_confirm "发布 $RELEASE_COMPONENT" "$assume_yes"
  release_transfer_image "$image" "$remote_release_dir" "$transport"
  release_sync_runtime "$root" "$remote_release_dir"
  [[ "$RELEASE_COMPONENT" != backend ]] || release_backup_database "$remote_release_dir"
  release_activate "$remote_release_dir" "$tag" "$revision" "$transport"
  release_status
}
