import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { serializeOpenApiDraft } from '../data/apiContract.ts';

const outputPath = resolve('docs/openapi-draft.json');

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, serializeOpenApiDraft(), 'utf8');

console.log(`Wrote ${outputPath}`);
