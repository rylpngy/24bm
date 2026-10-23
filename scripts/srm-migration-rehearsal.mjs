import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Read the original database; restore only into a new, separately named acceptance database.
const source = process.env.SRM_SOURCE_CONTAINER;
const sourceDb = process.env.SRM_SOURCE_DATABASE;
const target = process.env.SRM_TARGET_CONTAINER;
if (!source || !sourceDb || !target || source === target) {
  throw new Error('Specify different SRM_SOURCE_CONTAINER and SRM_TARGET_CONTAINER, plus SRM_SOURCE_DATABASE');
}
const stamp = Date.now();
const database = `srm_migration_${stamp}`;
const output = resolve('.tmp', database);
mkdirSync(output, { recursive: true, mode: 0o700 });
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sql = (text) => docker(['exec', '-i', target, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'procurement', '-d', database], text).trim();
const backup = openSync(resolve(output, 'original.dump'), 'wx', 0o600);
try {
  execFileSync('docker', ['exec', source, 'pg_dump', '-U', 'procurement', '-d', sourceDb, '-Fc', '--no-owner', '--no-acl'], { stdio: ['ignore', backup, 'pipe'] });
} finally { closeSync(backup); }
docker(['exec', target, 'createdb', '-U', 'procurement', database]);
docker(['exec', '-i', target, 'pg_restore', '-U', 'procurement', '-d', database, '--no-owner', '--no-acl', '--exit-on-error'], readFileSync(resolve(output, 'original.dump')));
const tables = JSON.parse(sql("select json_agg(tablename order by tablename) from pg_tables where schemaname='public' and tablename <> 'flyway_schema_history'"));
const columns = JSON.parse(sql("select json_object_agg(table_name, names) from (select table_name,json_agg(column_name order by ordinal_position) names from information_schema.columns where table_schema='public' group by table_name) c"));
const fingerprint = () => JSON.parse(sql('BEGIN READ ONLY; select json_agg(t) from (' + tables.map(name => {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Unexpected table name');
  const fields = columns[name].map(column => '"' + column.replaceAll('"', '""') + '"').join(',');
  return `select '${name}' as name,count(*)::int as rows,md5(coalesce(string_agg(md5(row_to_json(r)::text),'' order by md5(row_to_json(r)::text)),'')) as digest from (select ${fields} from public."${name}") r`;
}).join(' union all ') + ') t; COMMIT;'));
const before = fingerprint();
// Use Flyway itself without starting application schedulers or connecting to object storage.
const cpFile = resolve(output, 'classpath.txt');
execFileSync(process.env.MVN || '/opt/homebrew/bin/mvn', ['-q', 'dependency:build-classpath', `-Dmdep.outputFile=${cpFile}`], {
  cwd: resolve('backend-java'), env: { ...process.env, JAVA_HOME: process.env.JAVA_HOME || '/opt/homebrew/opt/openjdk@21' }, stdio: 'pipe',
});
const javaHome = process.env.JAVA_HOME || '/opt/homebrew/opt/openjdk@21';
const port = process.env.SRM_TARGET_DB_PORT || '25432';
if (!/^\d+$/.test(port)) throw new Error('Invalid database port');
const password = process.env.SRM_TARGET_DB_PASSWORD;
if (!password) throw new Error('SRM_TARGET_DB_PASSWORD is required (never written to the report)');
const sourceFile = resolve('scripts/support/SrmMigrationRehearsal.java');
const result = spawn(`${javaHome}/bin/java`, ['--class-path', readFileSync(cpFile, 'utf8').trim(), sourceFile], {
  env: { ...process.env, SRM_REHEARSAL_URL: `jdbc:postgresql://127.0.0.1:${port}/${database}`,
    SRM_REHEARSAL_PASSWORD: password, SRM_REHEARSAL_MIGRATIONS: resolve('backend-java/src/main/resources/db/migration') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
result.stdout.on('data', b => { logs += b; }); result.stderr.on('data', b => { logs += b; });
const code = await new Promise((resolve, reject) => { result.on('close', resolve); result.on('error', reject); });
writeFileSync(resolve(output, 'migration.log'), logs, { mode: 0o600 });
if (code !== 0) throw new Error(`Flyway rehearsal failed; inspect ${output}/migration.log`);
const after = fingerprint();
const differences = after.filter(row => {
  const previous = before.find(item => item.name === row.name);
  return !previous || row.rows !== previous.rows || row.digest !== previous.digest;
});
const migrations = JSON.parse(sql("select json_agg(t) from (select version,description,success from flyway_schema_history where version in ('211','212') order by installed_rank) t"));
const report = { database, sourceDatabase: sourceDb, checkedTables: tables.length, differences, migrations,
  passed: differences.length === 0 && migrations?.length === 2 && migrations.every(x => x.success), backup: resolve(output, 'original.dump') };
writeFileSync(resolve(output, 'result.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
