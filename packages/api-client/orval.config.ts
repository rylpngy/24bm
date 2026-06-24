import { defineConfig } from 'orval';

// 正向契约：从后端 springdoc 生成的 OpenAPI 派生类型 + TanStack Query hooks。
// S0-2 接通后端 /v3/api-docs 后，将 input.target 指向其导出物。
export default defineConfig({
  procurement: {
    input: {
      // 占位：S0-2 后替换为后端 OpenAPI（本地导出或 http://localhost:8080/v3/api-docs）。
      target: '../../docs/openapi/backend-openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: './src/generated',
      schemas: './src/generated/model',
      client: 'react-query',
      clean: true,
    },
  },
});
