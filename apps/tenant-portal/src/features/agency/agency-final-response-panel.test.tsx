import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, it, expect, afterEach } from "vitest";
import type { AgencyDetail, AssessmentSession } from "@24bid/api-client";
import {
  AgencyFinalResponsePanel,
  type FinalResponseWorkspace,
  type FinalResponseMine,
} from "./agency-final-response-panel";
const m = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@24bid/api-client", () => ({
  evaluationRequest: m.api,
  agencyFileDownload: vi.fn(),
}));
vi.mock("../../lib/use-buyer-permissions", () => ({
  useBuyerPermissions: () => ({ can: () => true }),
}));
afterEach(cleanup);
const snapshot = {
  subjects: [
    {
      participationId: "a",
      supplierName: "甲",
      fileVersionId: "file",
      attachmentId: "attachment",
      responseHash: "bytes",
    },
  ],
  clauses: [],
  criteria: [
    {
      key: "complete",
      title: "共同需求",
      stage: "conformity",
      applicableTo: "全部",
      resultType: "pass_fail",
      minimum: 0,
      maximum: 0,
      weight: 0,
      formula: "",
      evidenceRequired: true,
      scale: 0,
      rounding: "HALF_UP",
    },
  ],
  members: [
    { userId: "u", name: "评审甲" },
    { userId: "v", name: "评审乙" },
  ],
  requirementsVersionId: "requirements",
  requirementsHash: "hash",
};
const workspace = (): FinalResponseWorkspace => ({
  mode: "active",
  branch: {
    procurementMethod: "竞争性磋商",
    evaluationMethod: "comprehensive",
    priceSource: "final_original",
    finalResponseRequired: true,
    scoringAllowed: true,
    competitive: true,
    remainingProcesses: ["受控推荐"],
  },
  fingerprint: "fp",
  plan: { version: 1, frozenHash: "ph" },
  snapshot,
  progress: [
    { userId: "u", name: "评审甲", status: "draft" },
    { userId: "v", name: "评审乙", status: "submitted" },
  ],
  blockers: [],
});
const mine = (): FinalResponseMine => ({
  fingerprint: "fp",
  plan: { frozenHash: "ph" },
  snapshot,
  sheet: {
    id: "s",
    status: "draft",
    version: 1,
    entriesJson: "[]",
    frozenHash: null,
  },
  blockers: [],
});
function mount(actor = "u") {
  const w = workspace(),
    v = mine();
  m.api.mockImplementation(async (p: string) => (p.endsWith("/mine") ? v : w));
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={c}>
      <AgencyFinalResponsePanel
        detail={
          {
            record: { id: "p" },
            files: [
              {
                file: { visibility: "project", name: "凭证" },
                versions: [{ id: "proof", ordinal: 1, status: "sealed" }],
              },
            ],
          } as unknown as AgencyDetail
        }
        session={{ id: "session" } as AssessmentSession}
        actor={actor}
        organize={actor === "organizer"}
        busy={false}
        run={async (f) => {
          await f();
          return true;
        }}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("最终响应复核与方式分支"));
  return { c, w, v };
}
it("does not expose other member opinions to an organizer without a review assignment", async () => {
  mount("organizer");
  await screen.findByText("评审乙：已独立提交");
  expect(screen.queryByText(/本人最终响应独立意见/)).toBeNull();
  expect(m.api.mock.calls.some(([p]) => (p as string).endsWith("/mine"))).toBe(
    false,
  );
});
it("keeps unsaved independent facts and invalidates confirmation when the basis or control fingerprint changes", async () => {
  const { c, v } = mount();
  await screen.findByLabelText("最终响应意见 甲 共同需求");
  fireEvent.change(screen.getByLabelText("最终响应意见 甲 共同需求"), {
    target: { value: "本人尚未保存的私有事实" },
  });
  fireEvent.change(screen.getByLabelText("本人最终响应复核凭证"), {
    target: { value: "proof" },
  });
  fireEvent.click(screen.getByLabelText(/已本人核对最终需求与实际响应/));
  expect(
    screen.getByRole("button", { name: "独立提交本人最终响应意见" }),
  ).toBeDisabled();
  c.setQueryData(["agency-final-response-mine", "session", "u"], {
    ...v,
    fingerprint: "fp2",
  });
  await waitFor(() =>
    expect(
      screen.getByLabelText(/已本人核对最终需求与实际响应/),
    ).not.toBeChecked(),
  );
  expect(screen.getByLabelText("最终响应意见 甲 共同需求")).toHaveValue(
    "本人尚未保存的私有事实",
  );
});
it("preserves local facts on a newer server draft and requires explicit version adoption, while pause disables edits", async () => {
  const { c, v } = mount();
  await screen.findByLabelText("最终响应意见 甲 共同需求");
  fireEvent.change(screen.getByLabelText("最终响应意见 甲 共同需求"), {
    target: { value: "保留本地事实" },
  });
  c.setQueryData(["agency-final-response-mine", "session", "u"], {
    ...v,
    sheet: { ...v.sheet, version: 2 },
  });
  await screen.findByText(/服务端草稿版本已变化/);
  expect(
    screen.getByRole("button", { name: "保存本人最终响应草稿" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("最终响应意见 甲 共同需求")).toHaveValue(
    "保留本地事实",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "保留本地内容并绑定最新草稿" }),
  );
  expect(
    screen.getByRole("button", { name: "保存本人最终响应草稿" }),
  ).toBeEnabled();
  c.setQueryData(["agency-final-response-mine", "session", "u"], {
    ...v,
    fingerprint: "paused",
    sheet: { ...v.sheet, version: 2 },
    blockers: ["本轮暂停"],
  });
  await waitFor(() =>
    expect(screen.getByLabelText("最终响应意见 甲 共同需求")).toBeDisabled(),
  );
  expect(screen.getByLabelText("最终响应意见 甲 共同需求")).toHaveValue(
    "保留本地事实",
  );
});
it("renders actual server-submitted facts rather than a concurrent unsaved local draft after locking", async () => {
  const { c, v } = mount();
  await screen.findByLabelText("最终响应意见 甲 共同需求");
  fireEvent.change(screen.getByLabelText("最终响应意见 甲 共同需求"), {
    target: { value: "未提交的本地稿" },
  });
  c.setQueryData(["agency-final-response-mine", "session", "u"], {
    ...v,
    sheet: {
      ...v.sheet,
      status: "submitted",
      version: 2,
      frozenHash: "submittedhash",
      entriesJson: JSON.stringify([
        {
          participationId: "a",
          criterionKey: "complete",
          score: null,
          conclusion: "pass",
          evidence: "实际响应第2页",
          opinion: "已提交的真实服务端意见",
        },
      ]),
    },
  });
  await waitFor(() =>
    expect(screen.getByLabelText("最终响应意见 甲 共同需求")).toHaveValue(
      "已提交的真实服务端意见",
    ),
  );
  expect(screen.getByLabelText("最终响应意见 甲 共同需求")).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "独立提交本人最终响应意见" }),
  ).toBeNull();
});
it("allows only approved correction cells in the appended draft while keeping other cells read-only", async () => {
  const { c, v } = mount();
  await screen.findByLabelText("最终响应意见 甲 共同需求");
  c.setQueryData(["agency-final-response-mine", "session", "u"], {
    ...v,
    snapshot: {
      ...v.snapshot,
      criteria: [
        ...v.snapshot.criteria,
        { ...v.snapshot.criteria[0], key: "other", title: "其他" },
      ],
    },
    sheet: {
      ...v.sheet,
      id: "next",
      ordinal: 2,
      previousId: "s",
      correctionId: "r",
      entriesJson: JSON.stringify([
        {
          participationId: "a",
          criterionKey: "complete",
          score: null,
          conclusion: "pass",
          evidence: "原文",
          opinion: "原意见",
        },
        {
          participationId: "a",
          criterionKey: "other",
          score: null,
          conclusion: "pass",
          evidence: "不可改原文",
          opinion: "不可改意见",
        },
      ]),
    },
    corrections: [
      {
        id: "r",
        status: "approved",
        sheetId: "s",
        sheetHash: "original",
        cellsJson: JSON.stringify([
          { participationId: "a", criterionKey: "complete" },
        ]),
        reason: "限定更正",
        workflowId: null,
        resultNote: "",
      },
    ],
  });
  await waitFor(() =>
    expect(screen.getByLabelText("最终响应意见 甲 其他")).toBeDisabled(),
  );
  expect(screen.getByLabelText("最终响应意见 甲 共同需求")).toBeEnabled();
  expect(screen.getByLabelText("最终响应意见 甲 其他")).toHaveValue(
    "不可改意见",
  );
});
