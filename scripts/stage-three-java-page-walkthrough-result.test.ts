import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const resultPath = join(root, 'docs/stage-three-java-page-walkthrough-result.md');

describe('stage three Java page walkthrough result', () => {
  it('records the current Java mode page walkthrough evidence and data-state caveats', () => {
    expect(existsSync(resultPath)).toBe(true);

    const result = readFileSync(resultPath, 'utf8');

    expect(result).toContain('# 阶段三 Java 模式逐页联调结果');
    expect(result).toContain('Java local API smoke passed at http://localhost:8080');
    expect(result).toContain('共验收 21 个页面');
    expect(result).toContain('无加载失败');
    expect(result).toContain('无 argument type mismatch');
    expect(result).toContain('无横向溢出');
    expect(result).toContain('询价项目');
    expect(result).toContain('已定标详情');
    expect(result).toContain('收货验收');
    expect(result).toContain('暂无待收货订单');
    expect(result).toContain('结论：Java 模式逐页联调通过');
  });
});
