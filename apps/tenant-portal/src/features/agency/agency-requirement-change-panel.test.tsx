import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { it, expect, vi, afterEach } from "vitest";
import type { AgencyDetail, AssessmentSession } from "@24bid/api-client";
import {
  AgencyRequirementChangePanel,
  type ChangeWorkspace,
} from "./agency-requirement-change-panel";
const m = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@24bid/api-client", () => ({ evaluationRequest: m.api }));
vi.mock("../../lib/use-buyer-permissions", () => ({
  useBuyerPermissions: () => ({ can: () => true }),
}));
afterEach(cleanup);
const subjects = [
    { participationId: "a", supplierName: "甲" },
    { participationId: "b", supplierName: "乙" },
  ],
  path = "/packages/p/sessions/s/requirement-changes";
function workspace(): ChangeWorkspace {
  return {
    fingerprint: "fp1",
    changes: [],
    receipts: [],
    pendingSources: [
      { recordId: "r", participationId: "a", ordinal: 1, frozenHash: "rh" },
    ],
    subjects,
    blockers: [],
  };
}
function change() {
  return {
    id: "c",
    ordinal: 1,
    status: "authorized",
    version: 1,
    frozenHash: "ch",
    completionHash: null,
    snapshotJson: JSON.stringify({
      subjects,
      content: {
        locator: "第3条",
        beforeText: "原共同需求",
        afterText: "新共同需求",
        authorityName: "外部确认人",
        authorityRole: "授权代表",
        authorityScope: "书面授权",
        requirementsVersionId: "requirements",
        channel: "签收",
        sentAt: "2026-11-09T03:00:00Z",
        responseDeadlineAt: "2026-11-10T03:00:00Z",
      },
      evidenceHashes: {
        authorization: "authhash",
        requirements: "reqhash",
        notice: "noticehash",
      },
    }),
  };
}
function mount(w: ChangeWorkspace) {
  m.api.mockImplementation(async () => w);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AgencyRequirementChangePanel
        detail={
          {
            record: { id: "p" },
            files: [
              {
                file: { visibility: "project", name: "脱敏凭证" },
                versions: [{ id: "proof", ordinal: 1, status: "sealed" }],
              },
            ],
          } as unknown as AgencyDetail
        }
        session={{ id: "s" } as AssessmentSession}
        busy={false}
        run={async (fn) => {
          await fn();
          return true;
        }}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("授权需求变更与同步通知凭证"));
  return client;
}
it("preserves entered facts and requires renewed review when the process fingerprint changes", async () => {
  const w = workspace(),
    client = mount(w);
  await screen.findByLabelText("变更前共同内容");
  fireEvent.change(screen.getByLabelText("变更前共同内容"), {
    target: { value: "正在核对的外部授权事实" },
  });
  fireEvent.click(screen.getByLabelText(/已核对外部授权及允许范围/));
  expect(
    screen.getByRole("button", { name: "确认登记授权变更" }),
  ).toBeEnabled();
  client.setQueryData(["agency-requirement-changes", "s"], {
    ...w,
    fingerprint: "fp2",
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "确认登记授权变更" }),
    ).toBeDisabled(),
  );
  expect(screen.getByLabelText("变更前共同内容")).toHaveValue(
    "正在核对的外部授权事实",
  );
});
it("isolates receipt facts when switching recipients and binds registration to the chosen frozen participant", async () => {
  const w = workspace();
  w.changes = [change()];
  mount(w);
  await screen.findByLabelText("通知送达对象");
  fireEvent.change(screen.getByLabelText("通知送达对象"), {
    target: { value: "a" },
  });
  fireEvent.change(screen.getByLabelText("实际接收人及身份来源"), {
    target: { value: "甲的接收人" },
  });
  expect(screen.getByLabelText("通知送达对象")).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "放弃本对象未保存的送达凭证" }),
  );
  fireEvent.change(screen.getByLabelText("通知送达对象"), {
    target: { value: "b" },
  });
  expect(screen.getByLabelText("实际接收人及身份来源")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("实际接收人及身份来源"), {
    target: { value: "乙的接收人" },
  });
  fireEvent.change(screen.getByLabelText("实际接收通知时间"), {
    target: { value: "2026-11-09T11:05" },
  });
  fireEvent.change(screen.getByLabelText("本对象通知送达凭证"), {
    target: { value: "proof" },
  });
  fireEvent.change(screen.getByLabelText("本对象送达核对说明"), {
    target: { value: "核对同一通知内容" },
  });
  fireEvent.click(screen.getByLabelText(/已核对本对象收到同一冻结通知/));
  fireEvent.click(screen.getByRole("button", { name: "保存本对象送达凭证" }));
  await waitFor(() =>
    expect(m.api).toHaveBeenCalledWith(
      path + "/c/receipts",
      "POST",
      expect.objectContaining({
        participationId: "b",
        recipient: "乙的接收人",
        expectedPreviousId: null,
        expectedFingerprint: "fp1",
        contentChecked: true,
      }),
    ),
  );
  expect(
    screen.getByRole("button", { name: "锁定全部通知复核" }),
  ).toBeDisabled();
});
it("preserves unsaved receipt facts but disables registration after pause", async () => {
  const w = workspace();
  w.changes = [change()];
  const client = mount(w);
  await screen.findByLabelText("通知送达对象");
  fireEvent.change(screen.getByLabelText("通知送达对象"), {
    target: { value: "a" },
  });
  fireEvent.change(screen.getByLabelText("实际接收人及身份来源"), {
    target: { value: "暂停前未保存" },
  });
  client.setQueryData(["agency-requirement-changes", "s"], {
    ...w,
    fingerprint: "fp2",
    blockers: ["本轮已暂停"],
  });
  await waitFor(() =>
    expect(screen.getByLabelText("实际接收人及身份来源")).toBeDisabled(),
  );
  expect(screen.getByLabelText("实际接收人及身份来源")).toHaveValue(
    "暂停前未保存",
  );
  expect(
    screen.getByRole("button", { name: "保存本对象送达凭证" }),
  ).toBeDisabled();
});
it("keeps confirmed history visible and removes write controls after notification reconciliation", async () => {
  const w = workspace();
  w.pendingSources = [];
  w.changes = [{ ...change(), status: "notified", completionHash: "donehash" }];
  w.receipts = [1, 2].map((n) => ({
    id: "n" + n,
    changeId: "c",
    participationId: "a",
    ordinal: n,
    frozenHash: "nh" + n,
    snapshotJson: JSON.stringify({
      supplierName: "甲",
      content: {
        recipient: "接收人",
        receivedAt: "2026-11-09T03:05:00Z",
        note: "同一通知",
        replacementReason: n === 2 ? "更正接收时点" : "",
      },
      evidenceHash: "proofhash",
    }),
  }));
  mount(w);
  await screen.findByText(/全部通知已复核锁定/);
  expect(screen.queryByLabelText("通知送达对象")).toBeNull();
  expect(screen.queryByRole("button", { name: "锁定全部通知复核" })).toBeNull();
  expect(screen.getByText("甲第1版送达凭证（历史保留）")).toBeInTheDocument();
  expect(screen.getByText("甲第2版送达凭证（当前）")).toBeInTheDocument();
});
