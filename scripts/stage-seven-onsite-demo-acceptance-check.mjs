import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const artifactDir = process.env.STAGE_SEVEN_ONSITE_DEMO_ARTIFACT_DIR ?? 'docs/artifacts';
const buyerScript = 'scripts/stage-seven-real-action-click-check.mjs';
const supplierScript = 'scripts/stage-seven-supplier-real-action-click-check.mjs';
const platformScript = 'scripts/stage-seven-platform-real-action-click-check.mjs';
const buyerArtifactPath = 'docs/artifacts/stage-seven-java-real-action-click-result.json';
const supplierArtifactPath = 'docs/artifacts/stage-seven-supplier-java-real-action-click-result.json';
const platformArtifactPath = 'docs/artifacts/stage-seven-platform-java-real-action-click-result.json';
const outputArtifactPath = join(artifactDir, 'stage-seven-onsite-demo-acceptance-result.json');
const runbookPath = 'docs/stage-seven-onsite-demo-acceptance-package.md';

const runNodeScript = (scriptPath) => {
  const result = spawnSync('node', [scriptPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    scriptPath,
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

const readJson = (path) => {
  if (!existsSync(path)) {
    throw new Error(`Missing artifact: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
};

const summarizeArtifact = (artifactPath, artifact) => ({
  artifactPath,
  actionCount: artifact.results.length,
  failedCount: Array.isArray(artifact.failed) ? artifact.failed.length : artifact.failed,
  actions: artifact.results.map((result) => ({
    action: result.action,
    module: result.module,
    attemptedRealClick: result.attemptedRealClick,
    successVisible: result.successVisible,
    outcome: result.outcome ?? (result.passed ? '真实点击完成并出现业务反馈' : result.failure),
  })),
});

const main = () => {
  mkdirSync(artifactDir, { recursive: true });

  const buyerRun = runNodeScript(buyerScript);
  const supplierRun = runNodeScript(supplierScript);
  const platformRun = runNodeScript(platformScript);

  const buyerArtifact = readJson(buyerArtifactPath);
  const supplierArtifact = readJson(supplierArtifactPath);
  const platformArtifact = readJson(platformArtifactPath);
  const buyer = summarizeArtifact(buyerArtifactPath, buyerArtifact);
  const supplier = summarizeArtifact(supplierArtifactPath, supplierArtifact);
  const platform = summarizeArtifact(platformArtifactPath, platformArtifact);
  const scriptFailures = [buyerRun, supplierRun, platformRun].filter((run) => run.status !== 0);
  const failedTotal = buyer.failedCount + supplier.failedCount + platform.failedCount + scriptFailures.length;
  const output = {
    generatedAt: new Date().toISOString(),
    dataSource: 'Java 数据源',
    runbookPath,
    resetSeed: 'backend-java/src/main/resources/db/dev/V120__stage_seven_real_action_demo_seed.sql',
    command: 'node scripts/stage-seven-onsite-demo-acceptance-check.mjs',
    totalActions: buyer.actionCount + supplier.actionCount + platform.actionCount,
    failedTotal,
    buyer,
    supplier,
    platform,
    scriptRuns: [
      {
        scriptPath: buyerRun.scriptPath,
        status: buyerRun.status,
      },
      {
        scriptPath: supplierRun.scriptPath,
        status: supplierRun.status,
      },
      {
        scriptPath: platformRun.scriptPath,
        status: platformRun.status,
      },
    ],
    failed: [
      ...buyerArtifact.failed.map((item) => ({ role: 'buyer', ...item })),
      ...supplierArtifact.failed.map((item) => ({ role: 'supplier', ...item })),
      ...platformArtifact.results
        .filter((item) => !item.passed)
        .map((item) => ({ role: 'platform', ...item })),
      ...scriptFailures.map((run) => ({
        role: run.scriptPath.includes('supplier') ? 'supplier' : run.scriptPath.includes('platform') ? 'platform' : 'buyer',
        action: 'script',
        module: 'acceptance',
        outcome: `${run.scriptPath} exited with ${run.status}`,
        stderr: run.stderr,
      })),
    ],
  };

  writeFileSync(outputArtifactPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output, null, 2));
  if (failedTotal > 0) process.exitCode = 1;
};

main();
