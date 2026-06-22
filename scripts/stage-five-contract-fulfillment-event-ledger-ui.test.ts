import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract fulfillment event ledger UI', () => {
  it('wires Java persisted contract fulfillment events into the contract detail page', () => {
    const app = read('App.tsx');
    const api = read('services/procurementApiClient.ts');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');
    const smoke = read('scripts/java-local-smoke.mjs');

    expect(api).toContain('JavaContractFulfillmentEventDto');
    expect(api).toContain('ContractFulfillmentEventRecord');
    expect(api).toContain('CreateContractFulfillmentEventPayload');
    expect(api).toContain('listBuyerContractFulfillmentEvents');
    expect(api).toContain('createBuyerContractFulfillmentEvent');
    expect(api).toContain('/api/v1/buyer/contracts/${contractId}/fulfillment-events');

    expect(app).toContain('contractFulfillmentEventsById');
    expect(app).toContain('loadBuyerContractFulfillmentEvents');
    expect(app).toContain('createBuyerContractFulfillmentEvent');
    expect(app).toContain('后端履约事件台账');
    expect(app).toContain('Java 持久化事件');

    expect(smoke).toContain('/fulfillment-events');
    expect(smoke).toContain('Contract fulfillment event persisted');

    expect(checklist).toContain('| 22 | 合同履约事件持久化台账 |');
    expect(walkthrough).toContain('合同履约事件持久化台账');
  });
});
