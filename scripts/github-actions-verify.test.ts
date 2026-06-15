import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('GitHub Actions verification workflow', () => {
  it('runs the same local verification baseline in CI', () => {
    const workflowPath = '.github/workflows/verify.yml';

    expect(existsSync(join(root, workflowPath))).toBe(true);

    const workflow = read(workflowPath);
    expect(workflow).toContain('actions/checkout');
    expect(workflow).toContain('actions/setup-node');
    expect(workflow).toContain('node-version: 22');
    expect(workflow).toContain('actions/setup-java');
    expect(workflow).toContain('java-version: 21');
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npm run verify');
  });
});
