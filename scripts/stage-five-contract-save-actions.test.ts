import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract save actions', () => {
  it('exposes Java contract create and update APIs through backend and frontend client', () => {
    const controller = read('backend-java/src/main/java/com/procurement/contract/api/BuyerContractController.java');
    const service = read('backend-java/src/main/java/com/procurement/contract/application/ContractApplicationService.java');
    const mapper = read('backend-java/src/main/java/com/procurement/contract/infrastructure/ContractMapper.java');
    const client = read('services/procurementApiClient.ts');

    expect(controller).toContain('@PostMapping');
    expect(controller).toContain('CreateContractRequest');
    expect(controller).toContain('@PutMapping("/{contractId}")');
    expect(controller).toContain('UpdateContractRequest');
    expect(service).toContain('createCurrentTenantContract');
    expect(service).toContain('updateCurrentTenantContract');
    expect(service).toContain('purchaseOrderMapper.findByTenantAndId');
    expect(mapper).toContain('void insert(');
    expect(mapper).toContain('int updateDetails(');
    expect(client).toContain('CreateContractPayload');
    expect(client).toContain('UpdateContractPayload');
    expect(client).toContain('createBuyerContract');
    expect(client).toContain('updateBuyerContract');
    expect(client).toContain("buyerRequest<JavaContractDto>('/api/v1/buyer/contracts'");
    expect(client).toContain("`/api/v1/buyer/contracts/${contractId}`");
  });

  it('adds buyer contract create and edit entry points to the contract page', () => {
    const app = read('App.tsx');

    expect(app).toContain('createBuyerContractLedger');
    expect(app).toContain('updateBuyerContractLedger');
    expect(app).toContain('onSaveContract');
    expect(app).toContain('ContractSavePanel');
    expect(app).toContain('新建合同');
    expect(app).toContain('保存合同');
    expect(app).toContain('编辑选中合同');
    expect(app).toContain('javaApiClient.createBuyerContract');
    expect(app).toContain('javaApiClient.updateBuyerContract');
    expect(app).toContain('contract-save:create');
    expect(app).toContain('contract-save:update');
  });

  it('records the contract save round in stage-five documentation', () => {
    const checklist = read('docs/stage-five-execution-checklist.md');

    expect(checklist).toContain('| 12 | 合同新建编辑保存接口 |');
    expect(checklist).toContain('第12轮已新增合同新建和编辑保存');
    expect(checklist).toContain('scripts/stage-five-contract-save-actions.test.ts');
  });
});
