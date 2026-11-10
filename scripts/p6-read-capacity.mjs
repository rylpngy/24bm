import fs from "node:fs/promises";
import os from "node:os";
import assert from "node:assert/strict";
import { fixture } from "./agency-technical-fixture.mjs";
const f = await fixture(".p0/p3-method-invitation-session.json"),
  requests = 120,
  concurrency = 6,
  times = [],
  errors = [];
let next = 0;
const paths = [
    `/packages/${f.s.packageId}/sms`,
    `/execution/packages/${f.s.packageId}`,
    `/execution/packages/${f.s.packageId}/reminders`,
  ],
  start = performance.now();
async function worker() {
  while (true) {
    const i = next++;
    if (i >= requests) return;
    const before = performance.now();
    try {
      const result = await f.call(paths[i % paths.length]);
      assert.ok(result);
      times.push(performance.now() - before);
    } catch (e) {
      errors.push({ request: i, error: "Authenticated response failed" });
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
assert.equal(errors.length, 0);
assert.equal(times.length, requests);
times.sort((a, b) => a - b);
const result = {
  time: new Date().toISOString(),
  requests,
  concurrency,
  errors: errors.length,
  p50Ms: Math.round(times[Math.floor(requests * 0.5)]),
  p95Ms: Math.round(times[Math.floor(requests * 0.95)]),
  maxMs: Math.round(times.at(-1)),
  elapsedMs: Math.round(performance.now() - start),
  host: {
    arch: os.arch(),
    cpus: os.cpus().length,
    memoryGiB: Math.round(os.totalmem() / 1024 ** 3),
  },
  scope:
    "Bounded authenticated read observation on local synthetic dataset; no production SLA, write throughput or heavy document parallelism claim",
};
await fs.writeFile(
  "docs/agency/evidence/p6-read-capacity.json",
  JSON.stringify(result, null, 2),
);
console.log(
  "PASS",
  requests,
  "authenticated reads at concurrency",
  concurrency,
  "with zero failed responses",
);
