import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Vite fixed local port contract', () => {
  it('keeps Java frontend verification pinned to localhost port 3000', () => {
    const viteConfig = read('vite.config.ts');

    expect(viteConfig).toContain('server: {');
    expect(viteConfig).toContain('port: 3000');
    expect(viteConfig).toContain('strictPort: true');
  });
});
