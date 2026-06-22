import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage six RFQ deadline and demand link guard', () => {
  it('guards RFQ deadline and concurrent demand link creation in Java service', () => {
    const transition = read('backend-java/src/main/java/com/procurement/sourcing/domain/RfqSourcingStatusTransition.java');
    const service = read('backend-java/src/main/java/com/procurement/sourcing/application/RfqApplicationService.java');
    const creationTest = read('backend-java/src/test/java/com/procurement/RfqCreationStateTransitionTests.java');
    const transitionTest = read('backend-java/src/test/java/com/procurement/RfqSourcingStatusTransitionTests.java');

    expect(transition).toContain('requireFutureDeadline');
    expect(transition).toContain('RFQ deadline must be in the future');
    expect(service).toContain('rfqSourcingStatusTransition.requireFutureDeadline(request.deadlineAt(), "new RFQ")');
    expect(service).toContain('rfqSourcingStatusTransition.requireFutureDeadline(request.deadlineAt(), rfqId)');
    expect(service).toContain('DuplicateKeyException');
    expect(service).toContain('RfqDemandLinkPolicy.requireUnlinkedDemand(1, demandId)');
    expect(creationTest).toContain('createTranslatesConcurrentDemandLinkDuplicateIntoBusinessError');
    expect(transitionTest).toContain('requiresFutureDeadlineForRfqCreationAndUpdate');
  });

  it('adds a database uniqueness guard for one RFQ per tenant demand', () => {
    const migrationPath = 'backend-java/src/main/resources/db/migration/V118__rfq_demand_unique_link.sql';

    expect(existsSync(migrationPath)).toBe(true);
    const migration = read(migrationPath);
    expect(migration).toContain('alter table rfq_demands');
    expect(migration).toContain('unique (tenant_id, demand_id)');
  });

  it('records the seventh stage-six increment in the execution checklist', () => {
    const checklist = read('docs/stage-six-execution-checklist.md');

    expect(checklist).toContain('| 7 | RFQ 截止时间与需求关联并发保护 |');
    expect(checklist).toContain('截止时间必须晚于当前时间');
    expect(checklist).toContain('`rfq_demands` 增加 `(tenant_id, demand_id)` 唯一约束');
    expect(checklist).toContain('scripts/stage-six-rfq-deadline-and-demand-link-guard.test.ts');
    expect(checklist).toContain('阶段七建议入口：优先做 Java 模式真实演示闭环、页面细节修复和主流程演示路径固化');
  });
});
