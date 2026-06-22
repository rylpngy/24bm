import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const resultPath = join(root, 'docs/stage-three-round-two-java-walkthrough-result.md');

describe('stage three round two Java walkthrough result', () => {
  it('records Java-mode verification for round two screens and remaining boundaries', () => {
    expect(existsSync(resultPath)).toBe(true);

    const result = readFileSync(resultPath, 'utf8');

    expect(result).toContain('# 阶段三第二轮 Java 模式逐页联调结果');
    expect(result).toContain('## 本次环境');
    expect(result).toContain('http://localhost:8080');
    expect(result).toContain('http://localhost:3000/');
    expect(result).toContain('npm run java:smoke');
    expect(result).toContain('Java local API smoke passed');
    expect(result).toContain('## 2026-06-20 Java smoke 回归复核');
    expect(result).toContain('schema public 当前版本 101');
    expect(result).toContain('Successfully validated 9 migrations');
    expect(result).toContain('GET /api/v1/health');
    expect(result).toContain('Loaded 23 purchase demands');
    expect(result).toContain('Loaded 19 purchase orders, 18 invoices, 50 audit logs');
    expect(result).toContain('Loaded supplier 晨光科技供应商, 21 RFQs, 20 quotes, 19 orders, 18 invoices');
    expect(result).toContain('Created demand dem-46fe98c4-eb93-4304-b40a-9ccc6a3673d1');
    expect(result).toContain('payment status 已付款');
    expect(result).toContain('## 2026-06-20 跨角色只读卡片 Java 视觉回归补跑');
    expect(result).toContain('Java 后端健康检查返回 `ok`');
    expect(result).toContain('前端 Java 模式 `http://localhost:3000/` 返回 `200 OK`');
    expect(result).toContain('首屏 Java API 探针全部返回 `200`');
    expect(result).toContain('`/api/v1/buyer/invoice-reconciliations`');
    expect(result).toContain('`/api/v1/supplier/invoice-reconciliations`');
    expect(result).toContain('平台：企业审核、平台公告');
    expect(result).toContain('供应商：报价记录、发票应收');
    expect(result).toContain('采购方：询价项目、采购订单、发票付款');
    expect(result).toContain('1280x720');
    expect(result).toContain('390x844');
    expect(result).toContain('Java 数据源');
    expect(result).toContain('ReadonlyDetailCardSurface');
    expect(result).toContain('无加载失败');
    expect(result).toContain('无浏览器错误日志');
    expect(result).toContain('无整页横向溢出');

    expect(result).toContain('## 第二轮新增能力复核');
    expect(result).toContain('详情面板');
    expect(result).toContain('筛选摘要');
    expect(result).toContain('动作表单');
    expect(result).toContain('附件中心入口');
    expect(result).toContain('消息中心入口');
    expect(result).toContain('权限差异提示');

    expect(result).toContain('## 逐页复核矩阵');
    expect(result).toContain('21 个页面逐页点击复核已完成');
    expect(result).toContain('第一段 16 页');
    expect(result).toContain('第二段补跑 5 页');
    expect(result).toContain('无加载失败');
    expect(result).toContain('无 `argument type mismatch`');
    expect(result).toContain('无控制台错误');
    expect(result).toContain('| 采购方 | 采购需求 |');
    expect(result).toContain('| 采购方 | 询价项目 |');
    expect(result).toContain('| 采购方 | 发票付款 |');
    expect(result).toContain('| 平台 | 企业审核 |');
    expect(result).toContain('| 平台 | 平台公告 |');
    expect(result).toContain('| 供应商 | 企业档案 |');
    expect(result).not.toContain('待逐页点击复核');
    expect(result).toContain('| 供应商 | 发票应收 |');

    expect(result).toContain('## 未收口边界');
    expect(result).toContain('平台公告编辑/撤回仍是前端生命周期入口');
    expect(result).toContain('租户功能开关详情仍以说明和只读核对为主');
    expect(result).toContain('供应商档案维护入口尚未完成 Java 持久化闭环');

    expect(result).toContain('## 结论');
    expect(result).toContain('第二轮 P0 Java 模式逐页联调复核已完成');
  });
});
