import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract approval entry UI', () => {
  it('derives contract approval readiness in the buyer contract detail model', () => {
    const model = read('data/buyerAdminUi.ts');

    expect(model).toContain('ContractApprovalReadiness');
    expect(model).toContain('approvalReadiness: ContractApprovalReadiness;');
    expect(model).toContain("status: '待提交审批'");
    expect(model).toContain("reason: '合同草案已形成，可提交合同审批'");
    expect(model).toContain("status: '审批中'");
    expect(model).toContain("status: '已审批'");
    expect(model).toContain("status: '已归档'");
  });

  it('adds a contract approval entry panel with disabled boundary hints', () => {
    const app = read('App.tsx');
    const client = read('services/procurementApiClient.ts');

    expect(app).toContain('ContractApprovalEntryPanel');
    expect(app).toContain('合同审批');
    expect(app).toContain('提交合同审批');
    expect(app).toContain('审批就绪');
    expect(app).toContain('审批阻断原因');
    expect(app).toContain('javaApiClient.submitBuyerContractApproval');
    expect(app).toContain("approval.bizType === 'contract_approval'");
    expect(app).toContain('javaApiClient.reviewBuyerContractApproval');
    expect(app).toContain('onSubmitContractApproval');
    expect(client).toContain('submitBuyerContractApproval(contractId: string)');
    expect(client).toContain('reviewBuyerContractApproval(contractId: string, approved: boolean)');
    expect(client).toContain("`/api/v1/buyer/contracts/${contractId}/approval`");
    expect(client).toContain("`/api/v1/buyer/contracts/${contractId}/approval-review`");
  });

  it('records the contract approval entry round in stage-five documentation', () => {
    const checklist = read('docs/stage-five-execution-checklist.md');

    expect(checklist).toContain('| 15 | 合同审批任务创建与回写 |');
    expect(checklist).toContain('第15轮已将合同审批入口接入 Java 审批任务');
    expect(checklist).toContain('scripts/stage-five-contract-approval-entry-ui.test.ts');
  });
});
