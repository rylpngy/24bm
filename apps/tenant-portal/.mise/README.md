# 前端 mise 任务

```bash
mise install
mise run dev
mise run test
mise run release build
mise run release deploy --dry-run
mise run release deploy --yes
mise run release status
mise run release rollback --release RELEASE_ID
```

发布时只构建、传输并重建 `portal` 容器，不会重启后端、PostgreSQL 或 MinIO。
