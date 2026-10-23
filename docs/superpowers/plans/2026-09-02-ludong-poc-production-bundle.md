# 鲁东大学 POC 生产交付包实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建并验证一个可从本地直接复制到 Linux amd64 生产机启动的鲁东大学 POC 最小 Docker Compose 交付包。

**Architecture:** 生产 Compose 只运行 tenant-portal、Spring Boot、PostgreSQL 和 MinIO；门户容器把同源 `/api/` 代理到后端，宿主机只需将 Nginx 80/443 代理到回环地址 5173。PostgreSQL 与 MinIO 使用交付目录内相对绑定目录，本地重新初始化干净数据并在容器停止后与固定版本镜像一起归档。

**Tech Stack:** Docker Engine、Docker Compose v2、Bash、Spring Boot 3/Java 21、React/Vite、Nginx、PostgreSQL 16、MinIO。

**Spec:** `docs/superpowers/specs/2026-09-02-ludong-poc-production-bundle-design.md`

## Global Constraints

- 构建和生产目标均为 Linux `amd64`。
- 不修改或替换现有 `infra/docker-compose.yml` 开发流程。
- 生产 Compose 不包含 `build:`，不需要源码、Node.js、Maven 或镜像仓库。
- 只运行 tenant-portal、后端、PostgreSQL 和 MinIO。
- PostgreSQL 与 MinIO 分别绑定 `./data/postgres`、`./data/minio`。
- 只有门户发布宿主机端口，且只绑定 `127.0.0.1`。
- 初始数据来自 `classpath:db/poc/ludong`，演示密码为 `demo123456`。
- POC 开启自签登录并关闭 Keycloak。
- 生产宿主机只对外开放 80/443。
- Git 提交信息使用中文。

---

### Task 1: 部署包静态契约测试

**Files:**
- Create: `infra/ludong-poc-prod/test-package-contract.sh`
- Create: `infra/ludong-poc-prod/.gitignore`
- Create: `infra/ludong-poc-prod/data/postgres/.gitkeep`
- Create: `infra/ludong-poc-prod/data/minio/.gitkeep`
- Create: `infra/ludong-poc-prod/images/.gitkeep`

**Interfaces:**
- Consumes: Docker Compose CLI and files located beside the test script.
- Produces: A repeatable repository-level contract check invoked as `bash infra/ludong-poc-prod/test-package-contract.sh`.

- [ ] **Step 1: Write the failing contract test**

Create a Bash test that requires these files: `docker-compose.prod.yml`, `docker-compose.build.yml`, `Dockerfile.portal`, `portal-nginx.conf`, `.env.example`, `build-and-test.sh`, `prepare-clean-data.sh`, `pack.sh`, `start.sh`, `nginx/24bid-ludong.conf.example`, and `README.md`.

The test must run `docker compose --env-file .env.example -f docker-compose.prod.yml config` and assert:

```text
services: app, minio, portal, postgres
no build key in production config
portal host IP is 127.0.0.1
no published ports for app, postgres, or minio
bind sources are ./data/postgres and ./data/minio
APP_SEED_LOCATIONS is classpath:db/poc/ludong
SELF_LOGIN_ENABLED is true
KEYCLOAK_ENABLED is false
```

It must also merge `docker-compose.build.yml` and assert that only `app` and `portal` gain build definitions. Run `bash -n` on all lifecycle scripts and assert the host Nginx sample contains `listen 80`, `listen 443 ssl`, `127.0.0.1:5173`, and `client_max_body_size`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bash infra/ludong-poc-prod/test-package-contract.sh
```

Expected: FAIL because `docker-compose.prod.yml` and the other production files do not exist.

- [ ] **Step 3: Add only directory placeholders and ignore rules**

Ignore runtime content while keeping placeholders:

```gitignore
.env
data/postgres/*
!data/postgres/.gitkeep
data/minio/*
!data/minio/.gitkeep
images/*
!images/.gitkeep
*.tar.gz
```

- [ ] **Step 4: Re-run and retain the expected failure**

Run the contract test again. Expected: it still fails only because production implementation files are absent.

- [ ] **Step 5: Commit**

```bash
git add infra/ludong-poc-prod
git commit -m "测试：定义鲁东POC生产交付契约"
```

### Task 2: 最小生产 Compose 与门户镜像

**Files:**
- Create: `infra/ludong-poc-prod/docker-compose.prod.yml`
- Create: `infra/ludong-poc-prod/docker-compose.build.yml`
- Create: `infra/ludong-poc-prod/Dockerfile.portal`
- Create: `infra/ludong-poc-prod/portal-nginx.conf`
- Create: `infra/ludong-poc-prod/.env.example`
- Test: `infra/ludong-poc-prod/test-package-contract.sh`

**Interfaces:**
- Consumes: `backend-java/Dockerfile`, repository pnpm workspace, relative data directories.
- Produces: images `24bid/ludong-backend:${IMAGE_TAG}` and `24bid/ludong-portal:${IMAGE_TAG}`, plus the four-service production topology.

- [ ] **Step 1: Confirm the contract test is red for Compose requirements**

Run the contract test and record the missing production Compose failure.

- [ ] **Step 2: Implement `docker-compose.prod.yml`**

Use fixed dependency images and environment values:

```yaml
name: 24bid-ludong-poc
services:
  postgres:
    image: postgres:16.4-alpine
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
  minio:
    image: minio/minio:RELEASE.2024-09-13T20-26-02Z
    volumes:
      - ./data/minio:/data
  app:
    image: 24bid/ludong-backend:${IMAGE_TAG:-poc}
    environment:
      APP_SEED_LOCATIONS: classpath:db/poc/ludong
      SELF_LOGIN_ENABLED: "true"
      KEYCLOAK_ENABLED: "false"
  portal:
    image: 24bid/ludong-portal:${IMAGE_TAG:-poc}
    ports:
      - "127.0.0.1:${PORTAL_PORT:-5173}:80"
```

Add required credentials, health checks, internal dependencies and `restart: unless-stopped`. Do not add host ports to the first three services.

- [ ] **Step 3: Implement local build overlay**

`app.build.context` must resolve to `../../backend-java`. `portal.build.context` must resolve to repository root `../..` and use `infra/ludong-poc-prod/Dockerfile.portal`.

- [ ] **Step 4: Implement the portal image and internal proxy**

Build only `@24bid/tenant-portal` with `VITE_JAVA_API_BASE_URL` set to an empty same-origin value. The runtime Nginx config must proxy `/api/` to `http://app:8080`, preserve forwarded headers, allow request bodies, cache hashed assets, and fall back to `index.html` for SPA routes.

- [ ] **Step 5: Implement `.env.example`**

Provide deterministic POC defaults for image tag, portal port, PostgreSQL, MinIO and JWT. Document that customers must replace infrastructure secrets before real use while keeping the manual's demo accounts unchanged.

- [ ] **Step 6: Run the contract test**

Run:

```bash
bash infra/ludong-poc-prod/test-package-contract.sh
```

Expected: Compose assertions pass; lifecycle/document assertions still fail because those files are not implemented.

- [ ] **Step 7: Commit**

```bash
git add infra/ludong-poc-prod
git commit -m "部署：添加鲁东POC最小生产编排"
```

### Task 3: 生命周期、干净数据与离线打包脚本

**Files:**
- Create: `infra/ludong-poc-prod/build-and-test.sh`
- Create: `infra/ludong-poc-prod/prepare-clean-data.sh`
- Create: `infra/ludong-poc-prod/pack.sh`
- Create: `infra/ludong-poc-prod/start.sh`
- Test: `infra/ludong-poc-prod/test-package-contract.sh`

**Interfaces:**
- Consumes: `.env`, production Compose, build overlay and Docker CLI.
- Produces: clean relative data snapshot, `images/24bid-ludong-amd64.tar`, versioned deployment `.tar.gz`, and production startup command.

- [ ] **Step 1: Extend the failing test for script safety**

Assert scripts:

- resolve their own directory rather than depend on caller CWD;
- use exact data targets under that directory;
- require `--confirm-reset-ludong-poc` before deleting data;
- stop Compose before packing;
- use `docker save` and `docker load`;
- reject non-`x86_64`/`amd64` architecture;
- never run `docker compose build` from `start.sh`.

- [ ] **Step 2: Run test to verify the new assertions fail**

Expected: FAIL because lifecycle scripts are absent.

- [ ] **Step 3: Implement shared script behavior without a shared mutable config file**

Each script must use:

```bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
```

Each must validate `.env`, Docker availability and Compose availability with clear Chinese errors.

- [ ] **Step 4: Implement `build-and-test.sh`**

Build `app` and `portal` with both Compose files, start all services, wait on Compose health, verify `http://127.0.0.1:${PORTAL_PORT}/?solution=ludong-poc` and `/api/v1/health`, then print manual validation instructions. It must not reset data automatically.

- [ ] **Step 5: Implement `prepare-clean-data.sh`**

Require the literal confirmation flag, stop the dedicated Compose project, validate the two exact canonical data paths, delete only their contents, recreate them, start the four services, wait for health and verify seed identities by API and PostgreSQL queries. Stop services cleanly at the end so the snapshot is safe to pack.

- [ ] **Step 6: Implement `pack.sh`**

Stop services, verify no project container is running, save the four images, copy only production runtime files into a staging directory, include relative data and Nginx example, then create a versioned tarball using tar flags that preserve numeric owners and permissions. Exclude build overlay, Dockerfile, contract test, `.gitkeep`, `.gitignore` and source tree.

- [ ] **Step 7: Implement `start.sh`**

Validate target architecture and runtime inputs, load the image tar when present, start production Compose without build flags, wait for health, and print the loopback POC URL plus Nginx installation reminder.

- [ ] **Step 8: Run contract and syntax tests**

```bash
bash infra/ludong-poc-prod/test-package-contract.sh
bash -n infra/ludong-poc-prod/*.sh
```

Expected: PASS for Compose and script contracts except missing Nginx/docs assertions.

- [ ] **Step 9: Commit**

```bash
git add infra/ludong-poc-prod
git commit -m "部署：添加鲁东POC构建与离线交付脚本"
```

### Task 4: 生产 Nginx 示例与操作文档

**Files:**
- Create: `infra/ludong-poc-prod/nginx/24bid-ludong.conf.example`
- Create: `infra/ludong-poc-prod/README.md`
- Test: `infra/ludong-poc-prod/test-package-contract.sh`

**Interfaces:**
- Consumes: loopback portal endpoint `127.0.0.1:${PORTAL_PORT}`.
- Produces: production HTTP/HTTPS reverse proxy example and end-to-end operator runbook.

- [ ] **Step 1: Confirm Nginx/document checks are red**

Run the contract test. Expected: FAIL for the missing Nginx sample or README.

- [ ] **Step 2: Add the Nginx sample**

Include an HTTP server on 80 and an HTTPS server on 443. Use replaceable `server_name` and certificate paths, `client_max_body_size 100m`, proxy timeout settings, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, upgrade headers, and `proxy_pass http://127.0.0.1:5173`. Explain how to choose HTTP-only versus HTTP-to-HTTPS redirect without exposing Docker ports.

- [ ] **Step 3: Add the runbook**

Document:

1. local `.env` preparation;
2. local build and test;
3. destructive clean snapshot regeneration;
4. packing;
5. copying the tarball;
6. production extraction and start;
7. host Nginx enable/reload;
8. firewall 80/443 rule;
9. backup and restore of relative data;
10. same-architecture and stopped-container requirements;
11. manual accounts and POC URL;
12. rollback and troubleshooting.

- [ ] **Step 4: Run full static verification**

```bash
bash infra/ludong-poc-prod/test-package-contract.sh
docker compose --env-file infra/ludong-poc-prod/.env.example \
  -f infra/ludong-poc-prod/docker-compose.prod.yml config
```

Expected: PASS, and the production config contains only the four intended services.

- [ ] **Step 5: Commit**

```bash
git add infra/ludong-poc-prod
git commit -m "文档：补充鲁东POC生产Nginx与交付手册"
```

### Task 5: 实际构建、运行与数据链路验证

**Files:**
- Modify if failures demand it: files under `infra/ludong-poc-prod/`
- Test: runtime services and existing POC APIs

**Interfaces:**
- Consumes: completed production bundle sources.
- Produces: locally verified business images and a clean stopped data snapshot.

- [ ] **Step 1: Create the local environment file**

Copy `.env.example` to `.env` without changing manual account data.

- [ ] **Step 2: Build the two business images**

Run:

```bash
docker compose --env-file infra/ludong-poc-prod/.env \
  -f infra/ludong-poc-prod/docker-compose.prod.yml \
  -f infra/ludong-poc-prod/docker-compose.build.yml \
  build app portal
```

Expected: both images build for `linux/amd64` with exit code 0.

- [ ] **Step 3: Initialize clean POC data**

Run:

```bash
bash infra/ludong-poc-prod/prepare-clean-data.sh --confirm-reset-ludong-poc
```

Expected: Flyway completes, three representative logins pass, seed SQL checks pass, and all containers stop cleanly.

- [ ] **Step 4: Start and perform HTTP/API smoke tests**

Run `build-and-test.sh`, then verify portal HTML, backend health through `/api/`, administrator login and seeded POC application list.

- [ ] **Step 5: Verify MinIO end to end**

Login as an allowed POC account, create an upload ticket, upload a small deterministic text file through `/api/v1/buyer/attachments/upload-sink`, register its metadata, download it and compare bytes.

- [ ] **Step 6: Restore clean deliverable state**

Run `prepare-clean-data.sh --confirm-reset-ludong-poc` again. Expected: validation attachment and test mutations are absent, and containers stop cleanly.

- [ ] **Step 7: Re-run static checks after any runtime fixes**

```bash
bash infra/ludong-poc-prod/test-package-contract.sh
git diff --check
```

- [ ] **Step 8: Commit runtime corrections**

```bash
git add infra/ludong-poc-prod
git commit -m "修复：完善鲁东POC生产启动验证"
```

### Task 6: 离线交付包复启验收

**Files:**
- Generated: `infra/ludong-poc-prod/images/24bid-ludong-amd64.tar`
- Generated: versioned `24bid-ludong-poc-*.tar.gz`
- Modify if failures demand it: `infra/ludong-poc-prod/pack.sh`, `start.sh`, `README.md`

**Interfaces:**
- Consumes: stopped clean snapshot and four local images.
- Produces: final production-copyable tarball verified without source build contexts.

- [ ] **Step 1: Pack the stopped deployment**

Run `bash infra/ludong-poc-prod/pack.sh`. Expected: image tar and versioned delivery tarball are created with non-zero sizes.

- [ ] **Step 2: Inspect tarball contents**

Assert it contains production Compose, `.env.example`, `start.sh`, Nginx sample, image tar, PostgreSQL data and MinIO data. Assert it excludes `.git`, source code, build overlay, Dockerfiles and local `.env` secrets.

- [ ] **Step 3: Extract to a new temporary directory**

Use `mktemp -d`, extract with numeric ownership preservation, create `.env` from the example, and run the extracted `start.sh`. Do not reference the source repository during this step.

- [ ] **Step 4: Re-run core smoke tests from the extracted bundle**

Verify the portal URL, `/api/v1/health`, representative login, seeded applications and database counts. Stop the extracted deployment cleanly afterward.

- [ ] **Step 5: Run final verification suite**

```bash
bash infra/ludong-poc-prod/test-package-contract.sh
git diff --check
git status --short
```

Record image names, image IDs, tarball SHA-256, service health and exact smoke results.

- [ ] **Step 6: Commit final script fixes, if any**

```bash
git add infra/ludong-poc-prod docs/superpowers/plans/2026-09-02-ludong-poc-production-bundle.md
git commit -m "部署：完成鲁东POC离线交付验收"
```
