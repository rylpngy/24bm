// 从运行中的后端抓取 springdoc 生成的 OpenAPI，写入 docs/openapi/backend-openapi.json。
// 正向契约：后端是唯一事实源，前端 orval 据此派生。
// 用法：先启动后端(java:dev)，再 `node scripts/export-backend-openapi.mjs`。

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const url = process.env.BACKEND_OPENAPI_URL ?? 'http://localhost:8080/v3/api-docs';
const outputPath = resolve('docs/openapi/backend-openapi.json');

const response = await fetch(url);
if (!response.ok) {
  console.error(`抓取 OpenAPI 失败：${url} -> ${response.status} ${response.statusText}`);
  console.error('请确认后端已启动（pnpm java:dev 或 mvn spring-boot:run）。');
  process.exit(1);
}

const spec = await response.json();
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

const pathCount = Object.keys(spec.paths ?? {}).length;
console.log(`已写入 ${outputPath}（${pathCount} 条路径）`);
