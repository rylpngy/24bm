import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('local verification command', () => {
  it('exposes a single command that runs OpenAPI, frontend, and Java baseline checks', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

    expect(packageJson.scripts.verify).toBe('node scripts/verify-local.mjs');
    expect(existsSync(join(root, 'scripts/verify-local.mjs'))).toBe(true);

    const verifier = read('scripts/verify-local.mjs');
    expect(verifier).toContain("['run', 'openapi:check']");
    expect(verifier).toContain("['test']");
    expect(verifier).toContain("['run', 'build']");
    expect(verifier).toContain("['clean', 'test']");
    expect(verifier).toContain("run('mvn'");
    expect(verifier).toContain('backend-java');

    const doc = read('docs/local-java-integration.md');
    expect(doc).toContain('npm run verify');
    expect(doc).toContain('npm run openapi:check');
    expect(doc).toContain('mvn verify -Pintegration');
  });
});
