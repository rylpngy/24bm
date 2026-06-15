import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('legacy Node backend boundary', () => {
  it('keeps legacy Node scripts explicitly named and out of the primary backend path', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

    expect(packageJson.scripts['api:dev']).toBeUndefined();
    expect(packageJson.scripts['api:demo']).toBeUndefined();
    expect(packageJson.scripts['backend:demo']).toBeUndefined();
    expect(packageJson.scripts['legacy:api:dev']).toBe('node scripts/api-server.mjs');
    expect(packageJson.scripts['legacy:api:demo']).toBe('node scripts/api-demo.mjs');
    expect(packageJson.scripts['legacy:backend:demo']).toBe('node scripts/backend-demo.mjs');
    expect(packageJson.scripts['java:smoke']).toBe('node scripts/java-local-smoke.mjs');
  });

  it('marks Node server files and demo scripts as legacy prototype code', () => {
    const files = [
      'server/httpApp.ts',
      'server/procurementBackend.ts',
      'scripts/api-server.mjs',
      'scripts/api-demo.mjs',
      'scripts/backend-demo.mjs',
    ];

    for (const file of files) {
      const source = read(file);
      expect(source).toContain('LEGACY NODE PROTOTYPE');
      expect(source).toContain('backend-java');
    }
  });

  it('documents that new backend work belongs in Java, not the Node prototype', () => {
    const nodeDoc = read('docs/backend-skeleton.md');
    const javaDoc = read('docs/local-java-integration.md');
    const backendReadme = read('backend-java/README.md');
    const client = read('services/procurementApiClient.ts');

    expect(nodeDoc).toContain('只读参考');
    expect(nodeDoc).toContain('不要继续扩展 Node 后端原型');
    expect(nodeDoc).toContain('npm run legacy:api:dev');
    expect(javaDoc).toContain('npm run java:smoke');
    expect(javaDoc).toContain('The Node backend remains a legacy prototype only');
    expect(backendReadme).toContain('New backend work should be implemented here');
    expect(backendReadme).toContain('VITE_JAVA_API_BASE_URL');
    expect(backendReadme).not.toContain('through `VITE_API_BASE_URL`');
    expect(client).toContain('VITE_API_BASE_URL is retained for old Hono demos only');
    expect(client).toContain('VITE_JAVA_API_BASE_URL');
  });
});
