import fs from "node:fs/promises";
import assert from "node:assert/strict";
export async function fixture(path = ".p0/p3-report-session.json") {
  const base = "http://127.0.0.1:18080",
    s = JSON.parse(await fs.readFile(path));
  assert.ok(s.tenantId.startsWith("agency-"));
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(base + "/actuator/health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  async function login(userId) {
    const r = await fetch(base + "/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        account: userId + "@example.com",
        password: "demo123456",
        scope: "BUYER",
        tenantId: s.tenantId,
      }),
    });
    assert.equal(r.status, 200);
    return (await r.json()).data.accessToken;
  }
  const token = await login(s.userId),
    reviewer = await login(s.ids.reviewer);
  async function raw(path, method = "GET", body, t = token) {
    const r = await fetch(base + path, {
      method,
      headers: {
        authorization: "Bearer " + t,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    if (!text)
      throw Error(r.status + " empty API response: " + method + " " + path);
    const j = JSON.parse(text);
    if (!r.ok)
      throw Error(
        r.status + " " + j.message + " [" + method + " " + path + "]",
      );
    return j.data;
  }
  const call = (p, m, b, t) => raw("/api/v1/buyer/agency" + p, m, b, t),
    bad = (p, m, b, code = 400, t) =>
      assert.rejects(() => call(p, m, b, t), new RegExp(String(code))),
    key = () => crypto.randomUUID();
  async function definition(type) {
    let ds = await raw("/api/v1/buyer/process-definitions"),
      d = ds.find((v) => v.businessType === type);
    if (!d)
      d = await raw("/api/v1/buyer/process-definitions", "POST", {
        name: "合成独立审核 " + type,
        businessType: type,
      });
    await raw("/api/v1/buyer/process-definitions/" + d.id, "PUT", {
      name: d.name,
      status: "draft",
      businessType: type,
      formSchema: JSON.stringify({ fields: [] }),
      flowSchema: JSON.stringify({
        steps: [
          {
            id: "review",
            type: "approver",
            title: "独立有权核对",
            assignment: { type: "user", userId: s.ids.reviewer },
          },
        ],
      }),
    });
    await raw("/api/v1/buyer/process-definitions/" + d.id + "/publish", "POST");
  }
  async function approve(id, action = "approve") {
    const tasks = await raw(
        "/api/v1/buyer/workflow/tasks",
        "GET",
        undefined,
        reviewer,
      ),
      task = tasks.find((t) => t.businessId === id);
    assert.ok(task, "Actual assigned Flowable task must exist");
    return raw(
      "/api/v1/buyer/workflow/tasks/" + task.taskId + "/complete",
      "POST",
      { action, comment: "合成独立逐项核对 " + action },
      reviewer,
    );
  }
  return {
    s,
    base,
    token,
    reviewer,
    raw,
    call,
    bad,
    key,
    definition,
    approve,
    login,
  };
}
export async function uploadProof(f, name, text) {
  const { s, call, raw, base, token } = f;
  const file = await call(`/packages/${s.packageId}/files`, "POST", {
      name,
      category: "other",
      visibility: "project",
    }),
    v = file.versions[0],
    b = {
      ownerType: "agency_file_version",
      ownerId: v.id,
      fileName: name,
      visibility: "buyer_internal",
    },
    ticket = await raw("/api/v1/buyer/attachments/upload-ticket", "POST", b),
    r = await fetch(base + ticket.uploadUrl, {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/octet-stream",
      },
      body: Buffer.from(text),
    });
  assert.equal(r.status, 200);
  const a = await raw("/api/v1/buyer/attachments", "POST", {
    ...b,
    storageKey: ticket.storageKey,
  });
  return call(`/file-versions/${v.id}/seal`, "POST", { attachmentId: a.id });
}
