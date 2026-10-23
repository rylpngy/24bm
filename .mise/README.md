# mise 发版入口

首次使用执行 `mise trust --all && mise install`。

在仓库根目录可以统一或按组件执行：

```bash
mise run release deploy --dry-run
mise run release deploy --only backend
mise run release deploy --only frontend
mise run release status
mise run release rollback --only backend --release 20260905-120000-49925d83
```

正式 `deploy` 和 `rollback` 会要求确认，自动化场景可显式传 `--yes`。镜像优先通过 `docker pussh` 传输；不可用或传输失败时会输出 `WARNING`，再降级为 SFTP + `docker load`。SSH 始终强制 IPv4。

前后端目录也各自提供同名任务，详见各目录的 `.mise/README.md`。运行文件、Compose、Nginx 示例和相对挂载数据仍位于 `infra/ludong-poc-prod`。
