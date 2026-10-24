import { expect, it } from 'vitest';
import { derivePlanProgress, findAwardApproval } from './procurement-plan-progress';
it('does not call a receipt an archived procurement project', () => {
  expect(derivePlanProgress({ status: '已定标' }, { status: '已收货' }).stageLabel).toBe('履约结算');
});
it('distinguishes an unpublished plan from active quotation and terminated procurement', () => {
  expect(derivePlanProgress({ status: '草稿' }).currentIndex).toBe(0);
  expect(derivePlanProgress({ status: '报价中' }).stageLabel).toBe('报价征集');
  expect(derivePlanProgress({ status: '已废标' }).terminated).toBe(true);
});
it('finds award approval by parent RFQ and never mistakes an unrelated award id for the project', () => {
  const records = [{ bizType: 'rfq_award', bizId: 'award1', parentBizId: 'rfq1' }, { bizType: 'rfq_award', bizId: 'rfq1', parentBizId: 'other' }];
  expect(findAwardApproval(records, 'rfq1')).toBe(records[0]);
});
