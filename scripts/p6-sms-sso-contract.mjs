// Own loopback contract servers only: no vendor SMS or enterprise IdP is contacted.
import fs from "node:fs/promises";
import http from "node:http";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { fixture } from "./agency-technical-fixture.mjs";
const secrets = Object.fromEntries(
    (await fs.readFile(".p0/p6-sms.env", "utf8"))
      .trim()
      .split("\n")
      .map((x) => {
        const i = x.indexOf("=");
        return [x.slice(0, i), x.slice(i + 1)];
      }),
  ),
  checks = [],
  pass = (x) => {
    checks.push(x);
    console.log("PASS", x);
  },
  signature = (ts, b) =>
    crypto
      .createHmac("sha256", secrets.SMS_SECRET)
      .update(ts + ".")
      .update(b)
      .digest("hex");
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  }),
  jwk = {
    ...publicKey.export({ format: "jwk" }),
    kid: "p6-owned-contract-" + crypto.randomUUID(),
    use: "sig",
    alg: "RS256",
  },
  issuer = "http://127.0.0.1:18090/realms/agency-contract";
const oidc = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ keys: [jwk] }));
  }),
  requests = [],
  mode = { value: "accepted" };
const sms = http.createServer(async (req, res) => {
  try {
    let chunks = [];
    for await (const b of req) chunks.push(b);
    const body = Buffer.concat(chunks),
      ts = req.headers["x-24bm-timestamp"];
    assert.equal(req.headers["x-24bm-signature"], signature(ts, body));
    const v = JSON.parse(body);
    assert.ok(v.tenantId.startsWith("agency-"));
    assert.equal(v.recipient, "+12025550123");
    assert.equal(req.headers["idempotency-key"], v.clientId);
    requests.push(v.clientId);
    const result = Buffer.from(
        JSON.stringify({
          clientId: v.clientId,
          status: mode.value,
          providerRef: "contract-" + v.clientId,
        }),
      ),
      stamp = String(Math.floor(Date.now() / 1000));
    res.writeHead(200, {
      "content-type": "application/json",
      "X-24BM-Timestamp": stamp,
      "X-24BM-Signature":
        mode.value === "invalid" ? "bad" : signature(stamp, result),
    });
    res.end(result);
  } catch (e) {
    res.writeHead(400);
    res.end("contract rejected");
  }
});
await Promise.all([
  new Promise((r, j) => oidc.once("error", j).listen(18090, "127.0.0.1", r)),
  new Promise((r, j) => sms.once("error", j).listen(18089, "127.0.0.1", r)),
]);
try {
  const f = await fixture(".p0/p3-method-invitation-session.json"),
    { s, call, raw, key, base, token } = f,
    p = `/packages/${s.packageId}/sms`;
  const subject = "p6-contract-" + key(),
    binding = await raw("/api/v1/buyer/identity-bindings", "POST", {
      userId: s.ids.reviewer,
      subject,
      reason: "合成本地JWKS真实验签联调；非正式客户身份源",
    });
  const jwt = (claims = {}) => {
    let ts = Math.floor(Date.now() / 1000),
      h = Buffer.from(
        JSON.stringify({ alg: "RS256", typ: "JWT", kid: jwk.kid }),
      ).toString("base64url"),
      v = Buffer.from(
        JSON.stringify({
          iss: issuer,
          sub: subject,
          aud: ["24bm-agency"],
          iat: ts,
          exp: ts + 300,
          authScope: "BUYER",
          tenantId: "malicious-claim",
          userId: s.ids.outsider,
          roles: ["*"],
          ...claims,
        }),
      ).toString("base64url");
    return (
      h +
      "." +
      v +
      "." +
      crypto
        .sign("RSA-SHA256", Buffer.from(h + "." + v), privateKey)
        .toString("base64url")
    );
  };
  const auth = async (
    t,
    path = `/api/v1/buyer/agency/packages/${s.packageId}`,
  ) => fetch(base + path, { headers: { authorization: "Bearer " + t } });
  assert.equal((await auth(jwt())).status, 200);
  pass(
    "Real HTTP JWKS + RS256 validation maps issuer/subject to local reviewer and ignores forged user/tenant/role claims",
  );
  for (const claims of [
    { aud: ["wrong"] },
    { iss: "http://untrusted.invalid" },
    { exp: Math.floor(Date.now() / 1000) - 300 },
    { sub: "unmapped-" + key() },
  ])
    assert.equal((await auth(jwt(claims))).status, 401);
  pass("Wrong audience, issuer, expired token and unmapped buyer are rejected");
  await raw(`/api/v1/buyer/identity-bindings/${binding.id}/status`, "POST", {
    enabled: false,
    revision: binding.revision,
    reason: "验证停用即时拒绝旧会话",
  });
  assert.equal((await auth(jwt())).status, 401);
  pass(
    "Disabled local identity binding rejects already-issued external tokens immediately",
  );
  let v = await call(p);
  assert.ok(v.configured);
  let cfg = await call(p + "/settings", "PUT", {
    expectedVersion: v.settings?.version ?? null,
    enabled: true,
    dailyLimit: 2,
    reason: "仅允许自有回环契约网关的合成号码验证",
  });
  await assert.rejects(
    () =>
      call(p + "/settings", "PUT", {
        expectedVersion: cfg.version - 1,
        enabled: true,
        dailyLimit: 3,
        reason: "过期配置",
      }),
    /409/,
  );
  await assert.rejects(
    () =>
      call(p + "/contacts/" + s.userId, "PUT", {
        expectedVersion: 0,
        phone: "+12025550123",
        consented: true,
        verified: false,
        reason: "缺少人工核验",
      }),
    /400/,
  );
  const existing = (await call(p)).contacts.find((c) => c.userId === s.userId);
  let contact = await call(p + "/contacts/" + s.userId, "PUT", {
    expectedVersion: existing?.version ?? 0,
    phone: "+12025550123",
    consented: true,
    verified: true,
    reason: "合成保留号段，不联系任何真实接收人",
  });
  assert.ok(!JSON.stringify(contact).includes("+12025550123"));
  pass(
    "SMS settings use optimistic revision; contact requires verification/consent and returns only masked number",
  );
  async function event() {
    const m = await call(
      `/execution/packages/${s.packageId}/milestones`,
      "POST",
      {
        title: "合成网关契约提醒 " + key(),
        ownerId: s.userId,
        startsAt: null,
        dueAt: new Date(Date.now() - 3600000).toISOString(),
        dependencies: [],
        materialRequirement: "合成内部验证",
        status: "planned",
        resultNote: "",
        reason: "仅创建合成站内事件以测试外发授权",
        legalDeadline: null,
        legalBasis: null,
      },
    );
    for (let i = 0; i < 100; i++) {
      let r = await call(`/execution/packages/${s.packageId}/reminders`),
        d = r.deliveries.find(
          (x) =>
            x.delivery.milestoneId === m.id &&
            x.delivery.status === "delivered",
        );
      if (d) return d.delivery.id;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw Error("No actual in-app event");
  }
  const event1 = await event();
  await assert.rejects(
    () =>
      call(p, "POST", {
        reminderId: event1,
        authorized: false,
        reason: "未授权不得发送",
      }),
    /400/,
  );
  assert.equal(requests.length, 0);
  let d = await call(p, "POST", {
    reminderId: event1,
    authorized: true,
    reason: "仅向自有回环HTTP契约服务发送合成保留号段",
  });
  assert.equal(
    (
      await call(p, "POST", {
        reminderId: event1,
        authorized: true,
        reason: "相同事件重复授权",
      })
    ).id,
    d.id,
  );
  async function state(id, expected) {
    for (let i = 0; i < 80; i++) {
      let v = await call(p),
        d = v.deliveries.find((x) => x.id === id);
      if (d.status === expected) return d;
      if (["cancelled", "failed"].includes(d.status) && expected !== "failed")
        throw Error(d.errorText);
      await new Promise((r) => setTimeout(r, 250));
    }
    throw Error("delivery state timeout " + expected);
  }
  d = await state(d.id, "accepted");
  assert.equal(requests.filter((x) => x === d.id).length, 1);
  pass(
    "Explicitly authorized SMS event queues once, signs a real loopback HTTP request, and records accepted without claiming delivery",
  );
  const receipt = {
      tenantId: s.tenantId,
      deliveryId: d.id,
      providerRef: d.providerRef,
      status: "delivered",
    },
    callback = async (body, valid = true) => {
      const b = Buffer.from(JSON.stringify(body)),
        ts = String(Math.floor(Date.now() / 1000));
      return fetch(base + "/api/v1/buyer/agency/sms-bridge/receipt", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-24BM-Timestamp": ts,
          "X-24BM-Signature": valid ? signature(ts, b) : "invalid",
        },
        body: b,
      });
    };
  assert.equal((await callback(receipt, false)).status, 403);
  assert.equal((await callback(receipt)).status, 200);
  assert.equal((await callback(receipt)).status, 200);
  assert.equal((await callback({ ...receipt, status: "failed" })).status, 400);
  await state(d.id, "delivered");
  pass(
    "Signed delivery receipt is required, replay is idempotent and delivered terminal state cannot regress",
  );
  mode.value = "invalid";
  const event2 = await event();
  let unknown = await call(p, "POST", {
    reminderId: event2,
    authorized: true,
    reason: "回环网关错误签名验证，不外发",
  });
  unknown = await state(unknown.id, "unknown");
  await assert.rejects(
    () =>
      call(p + "/" + unknown.id + "/retry", "POST", {
        reason: "结果未知禁止重发",
      }),
    /400/,
  );
  assert.equal(requests.filter((x) => x === unknown.id).length, 1);
  pass(
    "Unverifiable provider result remains unknown and cannot be blindly retried",
  );
  const event3 = await event();
  let limited = await call(p, "POST", {
    reminderId: event3,
    authorized: true,
    reason: "回环网关日配额验证",
  });
  await state(limited.id, "cancelled");
  assert.equal(requests.length, 2);
  pass("Tenant daily quota prevents a third actual gateway request");
  let outsider = await f.login(s.ids.outsider);
  await assert.rejects(() => call(p, "GET", undefined, outsider), /403/);
  pass("SMS view is isolated by project scope");
  await call(p + "/settings", "PUT", {
    expectedVersion: cfg.version,
    enabled: false,
    dailyLimit: 2,
    reason: "合成契约验证完成，通道恢复停用",
  });
  await fs.writeFile(
    "docs/agency/evidence/p6-sms-sso-contract.json",
    JSON.stringify(
      {
        time: new Date().toISOString(),
        scope:
          "Own loopback SMS and RS256/JWKS contract; no actual SMS or customer IdP acceptance",
        checks,
      },
      null,
      2,
    ),
  );
} finally {
  await Promise.all([
    new Promise((r) => sms.close(r)),
    new Promise((r) => oidc.close(r)),
  ]);
}
