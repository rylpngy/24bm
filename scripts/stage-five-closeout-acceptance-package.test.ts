import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five closeout acceptance package', () => {
  it('documents the contract MVP completion state and next-stage decision basis', () => {
    const doc = read('docs/stage-five-closeout-acceptance-package.md');
    const checklist = read('docs/stage-five-execution-checklist.md');

    expect(doc).toContain('# 阶段五合同管理 MVP 收口验收包');
    expect(doc).toContain('Java 真实能力');
    expect(doc).toContain('前端辅助提示');
    expect(doc).toContain('尚未完成边界');
    expect(doc).toContain('验收证据');
    expect(doc).toContain('阶段六建议入口');
    expect(doc).toContain('合同新建编辑保存');
    expect(doc).toContain('合同状态推进和归档写入');
    expect(doc).toContain('合同附件元数据、上传凭证和下载签名');
    expect(doc).toContain('归档复核清单、缺口定位、处理建议、历史风险和归档前动作提示');
    expect(doc).toContain('不替代 Java 服务端归档门禁');
    expect(doc).toContain('真实对象存储、文件预览、病毒扫描、电子签章');
    expect(doc).toContain('优先补真实写入能力');
    expect(doc).toContain('npm test -- scripts/stage-five-closeout-acceptance-package.test.ts');

    expect(checklist).toContain('| 47 | 阶段五合同管理 MVP 收口验收包 |');
    expect(checklist).toContain('docs/stage-five-closeout-acceptance-package.md');
  });
});
