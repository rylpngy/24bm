import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { it, expect, vi, afterEach } from "vitest";
import type {
  AgencyDetail,
  AssessmentSession,
  EvaluationView,
} from "@24bid/api-client";
import {
  AgencyDiscussionPanel,
  type DiscussionWorkspace,
} from "./agency-discussion-panel";
const m = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@24bid/api-client", () => ({ evaluationRequest: m.api }));
vi.mock("../../lib/use-buyer-permissions", () => ({
  useBuyerPermissions: () => ({ can: () => true }),
}));
afterEach(cleanup);
const w = {
  mode: "active",
  plan: { mode: "active", version: 1, frozenHash: "hash" },
  fingerprint: "fp1",
  candidates: [
    { participationId: "a", supplierName: "甲" },
    { participationId: "b", supplierName: "乙" },
  ],
  progress: [],
  blockers: [],
  openedAt: "2026-11-09T01:00:00Z",
} as DiscussionWorkspace;
const content = (text: string) => ({
  startedAt: null,
  endedAt: null,
  staffUserIds: [],
  supplierAttendees: "代表",
  agenda: "议题",
  discussion: text,
  supplierResponse: "回应",
  conclusion: "结论",
  changeDisposition: "none",
  changeNote: "",
  evidenceVersionId: "proof",
});
const row = (id: string, participant: string, text: string) => ({
  id,
  participationId: participant,
  ordinal: 1,
  previousId: null,
  status: "draft",
  version: 1,
  contentJson: JSON.stringify(content(text)),
  frozenJson: null,
  frozenHash: null,
  createdAt: "2026-11-09T02:00:00Z",
  voidReason: null,
});
const a = {
    subject: { participationId: "a", supplierName: "甲" },
    records: [row("ra", "a", "甲方私有正文")],
    blockers: [],
  },
  b = {
    subject: { participationId: "b", supplierName: "乙" },
    records: [row("rb", "b", "乙方私有正文")],
    blockers: [],
  };
function mount() {
  m.api.mockImplementation(async (path: string) =>
    path.endsWith("/a") ? a : path.endsWith("/b") ? b : w,
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AgencyDiscussionPanel
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
        round={
          {
            roster: [{ userId: "u", name: "工作人员" }],
          } as unknown as EvaluationView
        }
        busy={false}
        run={async (fn) => {
          await fn();
          return true;
        }}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("逐家谈判／磋商过程"));
  return client;
}
it("does not carry private text to another supplier and requires save or explicit discard before switching", async () => {
  mount();
  await screen.findByLabelText("沟通对象");
  fireEvent.change(screen.getByLabelText("沟通对象"), {
    target: { value: "a" },
  });
  await screen.findByDisplayValue("甲方私有正文");
  fireEvent.change(screen.getByLabelText("逐家沟通正文"), {
    target: { value: "甲方未保存私有修改" },
  });
  await waitFor(() => expect(screen.getByLabelText("沟通对象")).toBeDisabled());
  fireEvent.click(screen.getByText("放弃未保存编辑并读取当前草稿"));
  await waitFor(() =>
    expect(screen.getByLabelText("沟通对象")).not.toBeDisabled(),
  );
  fireEvent.change(screen.getByLabelText("沟通对象"), {
    target: { value: "b" },
  });
  await screen.findByDisplayValue("乙方私有正文");
  expect(
    screen.queryByDisplayValue("甲方未保存私有修改"),
  ).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue("甲方私有正文")).not.toBeInTheDocument();
});
it("a stale draft preserves typed text and requires explicit adoption of the current version", async () => {
  const client = mount();
  await screen.findByLabelText("沟通对象");
  fireEvent.change(screen.getByLabelText("沟通对象"), {
    target: { value: "a" },
  });
  await screen.findByDisplayValue("甲方私有正文");
  fireEvent.change(screen.getByLabelText("逐家沟通正文"), {
    target: { value: "本地未保存内容" },
  });
  fireEvent.change(screen.getByLabelText("沟通草稿维护说明"), {
    target: { value: "继续核对" },
  });
  client.setQueryData(["agency-discussion-ledger", "s", "a"], {
    ...a,
    records: [{ ...a.records[0], version: 2 }],
  });
  await waitFor(() =>
    expect(screen.getByText("保存本对象沟通草稿")).toBeDisabled(),
  );
  expect(screen.getByLabelText("逐家沟通正文")).toHaveValue("本地未保存内容");
  fireEvent.click(screen.getByText("已核对最新草稿，保留当前编辑继续保存"));
  expect(screen.getByText("保存本对象沟通草稿")).not.toBeDisabled();
});
it("changed process fingerprints invalidate confirmation without deleting manual notes", async () => {
  const client = mount();
  await screen.findByLabelText("沟通对象");
  fireEvent.change(screen.getByLabelText("沟通对象"), {
    target: { value: "a" },
  });
  await screen.findByDisplayValue("甲方私有正文");
  fireEvent.change(screen.getByLabelText("第1次沟通线下确认凭证"), {
    target: { value: "proof" },
  });
  fireEvent.change(screen.getByLabelText("第1次沟通线下确认情况"), {
    target: { value: "人工确认说明" },
  });
  fireEvent.click(
    screen.getByLabelText("已核对本对象第1次实际沟通及线下确认凭证"),
  );
  expect(screen.getByText("确认本次沟通并锁定")).not.toBeDisabled();
  client.setQueryData(["agency-discussions", "s"], {
    ...w,
    fingerprint: "fp2",
  });
  await waitFor(() =>
    expect(screen.getByText("确认本次沟通并锁定")).toBeDisabled(),
  );
  expect(screen.getByLabelText("第1次沟通线下确认情况")).toHaveValue(
    "人工确认说明",
  );
});
it("pause keeps unsaved private content visible but disables saving", async () => {
  const client = mount();
  await screen.findByLabelText("沟通对象");
  fireEvent.change(screen.getByLabelText("沟通对象"), {
    target: { value: "a" },
  });
  await screen.findByDisplayValue("甲方私有正文");
  fireEvent.change(screen.getByLabelText("逐家沟通正文"), {
    target: { value: "暂停时保留的未提交内容" },
  });
  client.setQueryData(["agency-discussion-ledger", "s", "a"], {
    ...a,
    blockers: ["本轮已暂停"],
  });
  await waitFor(() =>
    expect(screen.getByLabelText("逐家沟通正文")).toBeDisabled(),
  );
  expect(screen.getByLabelText("逐家沟通正文")).toHaveValue(
    "暂停时保留的未提交内容",
  );
});
