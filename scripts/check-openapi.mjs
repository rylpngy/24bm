import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const backendSpecPath = resolve('docs/openapi/backend-openapi.json');
const generatedClientPath = resolve('packages/api-client/src/generated/controllers.ts');
const generatedModelIndexPath = resolve('packages/api-client/src/generated/model/index.ts');

const backendSpec = JSON.parse(await readFile(backendSpecPath, 'utf8'));
const generatedClient = await readFile(generatedClientPath, 'utf8');
const generatedModelIndex = await readFile(generatedModelIndexPath, 'utf8');

const requiredPaths = [
  '/api/v1/auth/login',
  '/api/v1/buyer/contracts',
  '/api/v1/buyer/contracts/scan-expiry',
  '/api/v1/buyer/payment-batches',
  '/api/v1/buyer/payment-execution-records',
  '/api/v1/platform/workspace',
  '/api/v1/supplier/qualifications',
];

const missingPaths = requiredPaths.filter((path) => !backendSpec.paths?.[path]);
if (missingPaths.length > 0) {
  console.error(`Backend OpenAPI snapshot is missing paths: ${missingPaths.join(', ')}`);
  console.error('Run `pnpm openapi:backend` against a running backend and commit docs/openapi/backend-openapi.json.');
  process.exit(1);
}

const requiredGeneratedMarkers = [
  'buyerContractScanExpiry',
  'buyerContractList',
  'buyerFinanceActionPaymentBatches',
  'buyerFinanceActionPaymentExecutionRecords',
  "export * from './scanExpiryResponse';",
  "export * from './paymentExecutionRecordResponse';",
];

const missingMarkers = requiredGeneratedMarkers.filter(
  (marker) => !generatedClient.includes(marker) && !generatedModelIndex.includes(marker),
);
if (missingMarkers.length > 0) {
  console.error(`Generated API client is missing markers: ${missingMarkers.join(', ')}`);
  console.error('Regenerate packages/api-client from docs/openapi/backend-openapi.json and commit the result.');
  process.exit(1);
}

console.log('Backend OpenAPI snapshot and generated client markers are synchronized.');
