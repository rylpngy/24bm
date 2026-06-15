import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('OpenAPI generated artifact check', () => {
  it('exposes a command that checks docs/openapi-draft.json is synchronized with data/apiContract.ts', () => {
    const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

    expect(packageJson.scripts['openapi:check']).toBe('node scripts/check-openapi.mjs');
    expect(existsSync(join(root, 'scripts/check-openapi.mjs'))).toBe(true);

    const checker = read('scripts/check-openapi.mjs');
    expect(checker).toContain('serializeOpenApiDraft');
    expect(checker).toContain('docs/openapi-draft.json');
    expect(checker).toContain('OpenAPI draft is out of sync');
  });
});
