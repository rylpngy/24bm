#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
PROD_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
BUILD_FILE="$SCRIPT_DIR/docker-compose.build.yml"
ENV_FILE="$SCRIPT_DIR/.env.example"

fail() {
  echo "契约失败: $*" >&2
  exit 1
}

required_files=(
  docker-compose.prod.yml
  docker-compose.build.yml
  Dockerfile.portal
  portal-nginx.conf
  .env.example
  build-and-test.sh
  prepare-clean-data.sh
  pack.sh
  start.sh
  nginx/24bid-ludong.conf.example
  README.md
  ../../backend-java/maven-settings-docker.xml
)

for relative_path in "${required_files[@]}"; do
  [[ -f "$SCRIPT_DIR/$relative_path" ]] || fail "缺少 $relative_path"
done

command -v docker >/dev/null 2>&1 || fail "缺少 docker"
docker compose version >/dev/null 2>&1 || fail "缺少 Docker Compose v2"
command -v python3 >/dev/null 2>&1 || fail "缺少 python3"

prod_json=$(mktemp)
merged_json=$(mktemp)
trap 'rm -f "$prod_json" "$merged_json"' EXIT

docker compose --env-file "$ENV_FILE" -f "$PROD_FILE" config --format json >"$prod_json"
docker compose --env-file "$ENV_FILE" -f "$PROD_FILE" -f "$BUILD_FILE" config --format json >"$merged_json"

python3 - "$prod_json" "$merged_json" "$SCRIPT_DIR" <<'PY'
import json
import sys
from pathlib import Path

prod = json.loads(Path(sys.argv[1]).read_text())
merged = json.loads(Path(sys.argv[2]).read_text())
root = Path(sys.argv[3]).resolve()

services = prod.get("services", {})
expected = {"app", "minio", "portal", "postgres"}
assert set(services) == expected, f"服务集合错误: {sorted(services)}"
assert all("build" not in service for service in services.values()), "生产配置不得含 build"

for name in ("app", "minio", "postgres"):
    assert not services[name].get("ports"), f"{name} 不得发布宿主机端口"

portal_ports = services["portal"].get("ports", [])
assert len(portal_ports) == 1, f"portal 应只发布一个端口: {portal_ports}"
assert portal_ports[0].get("host_ip") == "127.0.0.1", f"portal 未绑定回环地址: {portal_ports}"

def bind_source(service_name: str, target: str) -> Path:
    for volume in services[service_name].get("volumes", []):
        if volume.get("type") == "bind" and volume.get("target") == target:
            return Path(volume["source"]).resolve()
    raise AssertionError(f"{service_name} 缺少 {target} 绑定目录")

assert bind_source("postgres", "/var/lib/postgresql/data") == root / "data/postgres"
assert bind_source("minio", "/data") == root / "data/minio"

environment = services["app"].get("environment", {})
assert environment.get("APP_SEED_LOCATIONS") == "classpath:db/poc/ludong"
assert str(environment.get("SELF_LOGIN_ENABLED")).lower() == "true"
assert str(environment.get("KEYCLOAK_ENABLED")).lower() == "false"
assert services["postgres"].get("environment", {}).get("PGDATA") == "/var/lib/postgresql/data/pgdata"
assert "127.0.0.1" in " ".join(services["portal"].get("healthcheck", {}).get("test", []))
assert set(services["portal"].get("networks", {})) == {"backend", "edge"}
assert set(services["app"].get("networks", {})) == {"backend"}
assert prod.get("networks", {}).get("backend", {}).get("internal") is True
assert prod.get("networks", {}).get("edge", {}).get("internal") is not True

merged_services = merged.get("services", {})
with_build = {name for name, service in merged_services.items() if "build" in service}
assert with_build == {"app", "portal"}, f"构建覆盖范围错误: {sorted(with_build)}"

assert merged_services["app"]["build"].get("args") == {
    "JRE_IMAGE": "docker.m.daocloud.io/library/eclipse-temurin:21-jre",
    "MAVEN_IMAGE": "docker.m.daocloud.io/library/maven:3.9-eclipse-temurin-21",
}
portal_args = merged_services["portal"]["build"].get("args", {})
assert portal_args.get("NODE_IMAGE") == "docker.m.daocloud.io/library/node:22-alpine"
assert portal_args.get("NGINX_IMAGE") == "docker.m.daocloud.io/library/nginx:1.27-alpine"
assert portal_args.get("VITE_JAVA_API_BASE_URL") == "/"
PY

backend_dockerfile="$SCRIPT_DIR/../../backend-java/Dockerfile"
maven_settings="$SCRIPT_DIR/../../backend-java/maven-settings-docker.xml"
grep -Fq 'id=maven-repository,target=/root/.m2/repository,sharing=locked' "$backend_dockerfile" || \
  fail "后端 Dockerfile 未启用共享 Maven 缓存"
grep -Fq 'https://maven.aliyun.com/repository/public' "$maven_settings" || \
  fail "Docker Maven 配置未使用阿里云公共仓库"
if grep -Fq 'mvn -B -ntp' "$backend_dockerfile"; then
  fail "后端 Docker 构建关闭了 Maven 传输进度"
fi
portal_dockerfile="$SCRIPT_DIR/Dockerfile.portal"
grep -Fq 'COREPACK_NPM_REGISTRY=https://registry.npmmirror.com' "$portal_dockerfile" || \
  fail "前端 Dockerfile 的 Corepack 未配置国内镜像源"
grep -Fq 'pnpm config set registry https://registry.npmmirror.com' "$portal_dockerfile" || \
  fail "前端 Dockerfile 的 pnpm 未配置国内镜像源"
grep -Fq 'test -f /data/pgdata/PG_VERSION' "$SCRIPT_DIR/pack.sh" || \
  fail "打包脚本未在容器内检查受限权限的 PostgreSQL 数据目录"
grep -Fq 'sha256sum "$(basename "$output")"' "$SCRIPT_DIR/pack.sh" || \
  fail "校验文件必须使用可复制到生产的相对包名"

postgres_sentinel="$SCRIPT_DIR/data/postgres/.contract-sentinel"
minio_sentinel="$SCRIPT_DIR/data/minio/.contract-sentinel"
touch "$postgres_sentinel" "$minio_sentinel"
trap 'rm -f "$prod_json" "$merged_json" "$postgres_sentinel" "$minio_sentinel"' EXIT

if bash "$SCRIPT_DIR/prepare-clean-data.sh" >/dev/null 2>&1; then
  fail "prepare-clean-data.sh 无确认参数时必须拒绝执行"
fi
[[ -f "$postgres_sentinel" && -f "$minio_sentinel" ]] || fail "拒绝清理时修改了数据目录"

for lifecycle_script in build-and-test.sh prepare-clean-data.sh pack.sh start.sh; do
  bash -n "$SCRIPT_DIR/$lifecycle_script"
  bash "$SCRIPT_DIR/$lifecycle_script" --check >/dev/null
done

[[ -f "$postgres_sentinel" && -f "$minio_sentinel" ]] || fail "--check 模式修改了数据目录"

echo "鲁东 POC 生产交付契约通过"
