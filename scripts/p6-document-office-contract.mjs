// Isolated HTTP contract fixture, not a real OnlyOffice editor acceptance test.
import fs from "node:fs/promises";
import http from "node:http";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { fixture } from "./agency-technical-fixture.mjs";
const f = await fixture(".p0/p3-method-invitation-session.json"),
  { s, call, key, token, base } = f,
  checks = [];
const pass = (x) => {
  checks.push(x);
  console.log("PASS", x);
};
const secret = (await fs.readFile(".p0/p6-office.env", "utf8"))
  .split("\n")
  .find((x) => x.startsWith("OFFICE_JWT_SECRET="))
  .split("=")
  .slice(1)
  .join("=");
const sign = (p) => {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    v = Buffer.from(
      JSON.stringify({ ...p, exp: Math.floor(Date.now() / 1000) + 600 }),
    ).toString("base64url");
  return (
    h +
    "." +
    v +
    "." +
    crypto
      .createHmac("sha256", secret)
      .update(h + "." + v)
      .digest("base64url")
  );
};
const edited = await fs.readFile(".p0/office-contract/revision-2.docx");
const server = http.createServer((req, res) => {
  if (req.url.startsWith("/cache/files/")) {
    res.writeHead(200, {
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    res.end(edited);
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"error":0}');
  }
});
await new Promise((r, j) =>
  server.once("error", j).listen(18088, "127.0.0.1", r),
);
try {
  let w = await call(`/execution/packages/${s.packageId}`),
    d = w.documents.find((x) => x.document.kind === "purchase"),
    doc = d.document,
    revision = d.revisions.find((x) => x.id === doc.currentRevisionId);
  assert.ok(revision);
  const path = `/execution/documents/${doc.id}/office`,
    start = {
      expectedVersion: doc.version,
      sourceRevisionId: revision.id,
      reviewed: true,
      reason: "合成HTTP契约验证，不代表实际编辑器兼容验收",
      idempotencyKey: key(),
    },
    opened = await call(path, "POST", start),
    session = opened.session.id;
  assert.ok(opened.config.token);
  assert.equal((await call(path, "POST", start)).session.id, session);
  pass("Office session start is idempotent and binds exact current DOCX");
  const url = new URL(opened.config.document.url);
  url.hostname = "127.0.0.1";
  let r = await fetch(url);
  assert.equal(r.status, 200);
  const source = Buffer.from(await r.arrayBuffer());
  assert.equal(
    crypto.createHash("sha256").update(source).digest("hex"),
    revision.hash,
  );
  url.searchParams.set("ticket", "invalid");
  assert.equal((await fetch(url)).status, 403);
  pass(
    "Source capability downloads actual sealed bytes and rejects invalid ticket",
  );
  const cb =
      base +
      `/api/v1/buyer/agency/office-bridge/${s.tenantId}/${session}/callback`,
    payload = {
      key: opened.config.document.key,
      status: 6,
      url: "http://127.0.0.1:18088/cache/files/contract.docx",
    },
    callback = async (p, signed = p) =>
      fetch(cb, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...p, token: sign(signed) }),
      });
  assert.equal(
    (await callback({ ...payload, status: 2 }, payload)).status,
    403,
  );
  assert.equal(
    (await callback({ ...payload, url: "http://127.0.0.1:19020/private" }))
      .status,
    400,
  );
  pass(
    "Callback rejects signature/body mismatch and unapproved download origin",
  );
  let force = await call(path + `/${session}/save`, "POST");
  assert.equal(force.saved, false);
  await callback(payload).then(async (r) =>
    assert.equal(r.status, 200, await r.text()),
  );
  await callback(payload).then((r) => assert.equal(r.status, 200));
  let view = (await call(path)).sessions.find((x) => x.id === session);
  assert.equal(view.saves.length, 1);
  assert.equal(view.state, "active");
  const command = {
    expectedVersion: view.version,
    saveId: view.saves[0].id,
    reviewed: true,
    reason: "已逐项核对合成保存版本",
    idempotencyKey: key(),
  };
  await assert.rejects(
    () => call(path + `/${session}/adopt`, "POST", command),
    /400/,
  );
  pass(
    "Accepted force-save is not saved; callback replay deduplicates; active editing cannot be adopted",
  );
  await callback({ ...payload, status: 2 }).then(async (r) =>
    assert.equal(r.status, 200, await r.text()),
  );
  view = (await call(path)).sessions.find((x) => x.id === session);
  assert.equal(view.state, "ready");
  assert.equal(view.saves.length, 1);
  let adopted = await call(path + `/${session}/adopt`, "POST", {
    ...command,
    expectedVersion: view.version,
  });
  assert.equal(adopted.status, "candidate");
  assert.equal(adopted.hash, view.saves[0].fileHash);
  assert.equal(
    (
      await call(path + `/${session}/adopt`, "POST", {
        ...command,
        expectedVersion: view.version,
      })
    ).id,
    adopted.id,
  );
  pass(
    "Final save creates manually adopted draft without inheriting approval and adoption replay is idempotent",
  );
  assert.equal((await callback({...payload,status:7})).status,409);
  const otherOwner=await f.login(s.ids.reviewer);
  await assert.rejects(()=>call(path+`/${session}/config`,"GET",undefined,otherOwner),/403/);
  pass("Ended session rejects new late callbacks; another otherwise authorized member cannot resume the owner's editor");
  let job = await call(`/execution/revisions/${adopted.id}/previews`, "POST", {
    idempotencyKey: key(),
  });
  for (
    let i = 0;
    i < 100 && ["queued", "processing"].includes(job.status);
    i++
  ) {
    await new Promise((r) => setTimeout(r, 500));
    job = await call("/execution/jobs/" + job.id);
  }
  assert.equal(job.status, "success", job.errorText);
  const previews = await call(`/execution/revisions/${adopted.id}/previews`);
  assert.equal(previews.length, 1);
  r = await fetch(
    base + `/api/v1/buyer/attachments/${previews[0].attachmentId}/download`,
    { headers: { authorization: "Bearer " + token } },
  );
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /application\/pdf/);
  let pdf = Buffer.from(await r.arrayBuffer());
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.equal(
    crypto.createHash("sha256").update(pdf).digest("hex"),
    previews[0].preview.fileHash,
  );
  pass(
    "Actual LibreOffice asynchronous preview is sealed PDF with matching source and artifact hashes",
  );
  const outsider = await f.login(s.ids.outsider);
  await assert.rejects(() => call(path, "GET", undefined, outsider), /403/);
  await assert.rejects(
    () =>
      call(
        `/execution/revisions/${adopted.id}/previews`,
        "GET",
        undefined,
        outsider,
      ),
    /403/,
  );
  pass("Out-of-scope account cannot access Office history or derived PDF");
  await fs.writeFile(
    "docs/agency/evidence/p6-document-office-contract.json",
    JSON.stringify(
      {
        time: new Date().toISOString(),
        kind: "local signed HTTP contract + actual LibreOffice conversion; not editor roundtrip",
        checks,
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise((r) => server.close(r));
}
