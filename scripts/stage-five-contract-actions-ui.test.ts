import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract action UI', () => {
  it('wires contract status and archive actions through Java API client', () => {
    const client = read('services/procurementApiClient.ts');
    const app = read('App.tsx');

    expect(client).toContain('UpdateContractStatusPayload');
    expect(client).toContain('updateBuyerContractStatus');
    expect(client).toContain("`/api/v1/buyer/contracts/${contractId}/status`");
    expect(client).toContain('updateBuyerContractArchiveStatus');
    expect(client).toContain("`/api/v1/buyer/contracts/${contractId}/archive-status`");

    expect(app).toContain('推进履约');
    expect(app).toContain('归档合同');
    expect(app).toContain('onUpdateContractStatus');
    expect(app).toContain('onArchiveContract');
    expect(app).toContain('onUpdateContractStatus={updateBuyerContractStatus}');
    expect(app).toContain('onArchiveContract={archiveBuyerContract}');
    expect(app).toContain('onUpdateContractStatus={onUpdateContractStatus}');
    expect(app).toContain('onArchiveContract={onArchiveContract}');
    expect(app).toContain('onUpdateContractStatus: (contractId: string, status: string, fulfillmentProgress: string) => void;');
    expect(app).toContain('onArchiveContract: (contractId: string) => void;');
  });

  it('records stage-five contract action round in the execution checklist', () => {
    const checklist = read('docs/stage-five-execution-checklist.md');

    expect(checklist).toContain('| 7 | 合同状态与归档写入 |');
    expect(checklist).toContain('第7轮已新增合同状态推进和归档写入');
    expect(checklist).toContain('scripts/stage-five-contract-actions-ui.test.ts');
  });
});
