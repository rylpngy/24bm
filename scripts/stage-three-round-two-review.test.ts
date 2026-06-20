import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const reviewPath = join(root, 'docs/stage-three-round-two-review.md');

describe('stage three round two review', () => {
  it('records the current round two completion picture and the next execution decision', () => {
    expect(existsSync(reviewPath)).toBe(true);

    const review = readFileSync(reviewPath, 'utf8');

    expect(review).toContain('# 阶段三第二轮阶段性验收复盘');
    expect(review).toContain('## 当前结论');
    expect(review).toContain('后台可操作雏形已经成立');
    expect(review).toContain('第二轮仍不能直接整体收口');

    expect(review).toContain('## 已完成能力归类');
    expect(review).toContain('| 采购方主流程 |');
    expect(review).toContain('| 平台运营端 |');
    expect(review).toContain('| 供应商协同端 |');
    expect(review).toContain('| 通用后台能力 |');
    expect(review).toContain('50 个小步增量');

    expect(review).toContain('## 仍未收口的缺口');
    expect(review).toContain('Java 模式逐页联调');
    expect(review).toContain('持久化动作边界');
    expect(review).toContain('详情编辑闭环');
    expect(review).toContain('视觉和移动端人工验收');

    expect(review).toContain('## 下一步执行顺序');
    expect(review).toContain('P0：Java 模式逐页联调复核已完成');
    expect(review).toContain('P0：Java 模式逐页联调复核');
    expect(review).toContain('P1：采购方详情编辑闭环');
    expect(review).toContain('采购需求草稿编辑已完成');
    expect(review).toContain('RFQ 报价中编辑已完成');
    expect(review).toContain('订单预计到货日期编辑已完成');
    expect(review).toContain('发票付款状态编辑已完成');
    expect(review).toContain('平台公告编辑和撤回已完成');
    expect(review).toContain('供应商档案维护已完成');
    expect(review).toContain('企业审核详情持久化已完成');
    expect(review).toContain('供应商报价修改已完成');
    expect(review).toContain('供应商物流信息维护已完成');
    expect(review).toContain('供应商应收对账备注已完成');
    expect(review).toContain('供应商应收逾期提醒已完成');
    expect(review).toContain('发票对账单摘要已完成');
    expect(review).toContain('对账单台账雏形已完成');
    expect(review).toContain('对账单编号和状态流转已完成');
    expect(review).toContain('独立对账单落库已完成');
    expect(review).toContain('独立对账单查询 API 已完成');
    expect(review).toContain('供应商侧独立应收对账查询已完成');
    expect(review).toContain('对账台账表格化已完成');
    expect(review).toContain('对账差异处理和付款计划提示已完成');
    expect(review).toContain('共享组件长文本抗挤压已完成');
    expect(review).toContain('操作面板按钮密度收口已完成');
    expect(review).toContain('共享表格滚动可读性收口已完成');
    expect(review).toContain('共享空态稳定区域收口已完成');
    expect(review).toContain('mock 浏览器视觉复核记录已完成');
    expect(review).toContain('采购方首页、需求、RFQ、订单、发票和供应商询价邀请');
    expect(review).toContain('P1：平台和供应商持久化边界补强');
    expect(review).toContain('P2：视觉 QA 和移动端收口');

    expect(review).toContain('## 验收门槛');
    expect(review).toContain('npm test');
    expect(review).toContain('npm run build');
    expect(review).toContain('http://localhost:5173/');
  });
});
