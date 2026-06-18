import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const walkthroughPath = join(root, 'docs/stage-three-java-page-walkthrough.md');

describe('stage three Java mode page walkthrough', () => {
  it('documents the browser page-by-page Java verification gate before stage two UI work', () => {
    expect(existsSync(walkthroughPath)).toBe(true);

    const doc = readFileSync(walkthroughPath, 'utf8');

    expect(doc).toContain('# 阶段三 Java 模式逐页联调清单');
    expect(doc).toContain('mvn clean spring-boot:run -Dspring-boot.run.profiles=local');
    expect(doc).toContain('npm run java:smoke');
    expect(doc).toContain('npm run dev:java');
    expect(doc).toContain('http://localhost:3000/');
    expect(doc).toContain('| 角色 | 页面 | 必须看到的 Java 模式信号 | 不允许出现 |');
    expect(doc).toContain('| 采购方 | 采购需求 |');
    expect(doc).toContain('| 采购方 | 发票付款 |');
    expect(doc).toContain('| 平台 | 租户列表 |');
    expect(doc).toContain('| 平台 | 平台公告 |');
    expect(doc).toContain('| 供应商 | 询价邀请 |');
    expect(doc).toContain('| 供应商 | 企业档案 |');
    expect(doc).toContain('加载失败');
    expect(doc).toContain('argument type mismatch');
    expect(doc).toContain('横向溢出');
    expect(doc).toContain('通过标准');
    expect(doc).toContain('进入第二轮');
  });
});
