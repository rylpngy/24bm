// orval `clean:true` 会清空 generated 目录，因此每次 generate 后重建 controllers.ts 汇总桶。
import { readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const genDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/generated');
const lines = ['// 自动汇总各 controller 的 orval 产物（generate 后由 build-controllers-barrel 重建）。'];

for (const name of readdirSync(genDir).sort()) {
  if (name === 'model') continue;
  const dir = resolve(genDir, name);
  if (!statSync(dir).isDirectory()) continue;
  if (existsSync(resolve(dir, `${name}.ts`))) {
    lines.push(`export * from './${name}/${name}';`);
  }
}

writeFileSync(resolve(genDir, 'controllers.ts'), `${lines.join('\n')}\n`, 'utf8');
console.log(`controllers.ts 已重建（${lines.length - 1} 个 controller）`);
