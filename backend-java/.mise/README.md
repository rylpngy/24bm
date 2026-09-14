# 后端 mise 任务

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

发布时只构建、传输并重建 `app` 容器；正式发布前会把 PostgreSQL 逻辑备份保存在服务器对应的 `.releases/backend/RELEASE_ID` 目录。
