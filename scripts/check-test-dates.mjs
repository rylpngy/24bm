#!/usr/bin/env node
// 测试定时炸弹检查:测试源码中「当前仍在未来」的日期字面量总有一天会翻成过去,
// 悄悄改变断言行为(本仓已三次踩雷:报价截止/发票到期/e2e 未来日期)。
// 规则:扫描测试文件里的 YYYY-MM-DD 字面量,任何 >= 今天 的日期直接失败——
// 请改用相对时间(now().plusDays/plusYears);历史日期夹具(已成过去)无害放行。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['e2e', 'backend-java/src/test'];
const FILE_RE = /\.(spec\.ts|java)$/;
const DATE_RE = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;

const today = new Date().toISOString().slice(0, 10);
const offenders = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (FILE_RE.test(name)) scan(p);
  }
}

function scan(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(DATE_RE)) {
      const literal = m[0];
      if (literal >= today) {
        offenders.push(`${file}:${i + 1}  ${literal}  ←  ${line.trim().slice(0, 100)}`);
      }
    }
  });
}

ROOTS.forEach(walk);

if (offenders.length > 0) {
  console.error('✗ 测试源码存在未来日期字面量(定时炸弹,随时间流逝会改变断言行为):\n');
  offenders.forEach((o) => console.error('  ' + o));
  console.error('\n请改用相对时间:Java 用 LocalDate/OffsetDateTime.now().plusDays(N),e2e 用 Date.now() 偏移。');
  process.exit(1);
}
console.log(`✓ 测试日期检查通过:无未来日期字面量(基准 ${today})。`);
