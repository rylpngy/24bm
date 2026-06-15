import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serializeOpenApiDraft } from '../data/apiContract.ts';

const outputPath = resolve('docs/openapi-draft.json');
const expected = serializeOpenApiDraft();
const actual = await readFile(outputPath, 'utf8');

if (actual !== expected) {
  console.error('OpenAPI draft is out of sync. Run `npm run openapi:export` and commit the updated docs/openapi-draft.json.');
  process.exit(1);
}

console.log('OpenAPI draft is synchronized.');
