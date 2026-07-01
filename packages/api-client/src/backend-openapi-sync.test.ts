import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('backend OpenAPI generated client sync', () => {
  it('keeps the buyer contract client aligned with expiry scan API', () => {
    const backendOpenApi = read('docs/openapi/backend-openapi.json');
    const buyerContractClient = read('packages/api-client/src/generated/buyer-contract-controller/buyer-contract-controller.ts');
    const modelIndex = read('packages/api-client/src/generated/model/index.ts');

    expect(backendOpenApi).toContain('/api/v1/buyer/contracts/scan-expiry');
    expect(backendOpenApi).toContain('ApiResponseScanExpiryResponse');
    expect(backendOpenApi).toContain('ScanExpiryResponse');
    expect(buyerContractClient).toContain('buyerContractScanExpiry');
    expect(buyerContractClient).toContain('/api/v1/buyer/contracts/scan-expiry');
    expect(modelIndex).toContain("export * from './scanExpiryResponse';");
    expect(modelIndex).toContain("export * from './apiResponseScanExpiryResponse';");
  });
});
