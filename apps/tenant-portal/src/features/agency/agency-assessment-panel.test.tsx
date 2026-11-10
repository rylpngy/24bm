import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, it, expect, vi } from "vitest";
import type {
  AgencyDetail,
  EvaluationView,
  AssessmentMine,
} from "@24bid/api-client";
import { AgencyAssessmentPanel } from "./agency-assessment-panel";
vi.mock("./agency-opening-panel",()=>({AgencyStagePanel:()=>null,stageNames:{evaluation:"评审"}}));
const m = vi.hoisted(() => ({
  api: vi.fn(),
  permissions: ["buyer:*"],
  user: "reviewer",
}));
vi.mock("@24bid/api-client", () => ({ evaluationRequest: m.api }));
vi.mock("../../lib/use-buyer-permissions", () => ({
  useBuyerPermissions: () => ({
    can: (p: string) =>
      m.permissions.includes("buyer:*") || m.permissions.includes(p),
  }),
}));
vi.mock("../../lib/auth-store", () => ({
  useAuthStore: (s: (v: unknown) => unknown) =>
    s({ session: { userId: m.user } }),
}));
vi.mock("../workflow/workflow-instance-panel", () => ({
  WorkflowStatusPanel: () => null,
}));
vi.mock("../workflow/workflow-submit-dialog", () => ({
  WorkflowSubmitDialog: () => null,
}));
const criterion = {
  key: "T1",
  title: "技术方案",
  stage: "technical",
  applicableTo: "实质响应供应商",
  resultType: "score",
  minimum: 0,
  maximum: 10,
  weight: 100,
  formula: "weighted_normalized",
  evidenceRequired: true,
  scale: 2,
  rounding: "HALF_UP",
};
const detail = { record: { id: "p" }, files: [] } as unknown as AgencyDetail;
const round = {
  round: { id: "round", version: 2, status: "frozen" },
  config: {
    members: [
      { userId: "organizer", roles: ["organizer"] },
      { userId: "reviewer", roles: ["review_member"] },
    ],
    rules: [{ configuredRule: criterion }],
  },
} as unknown as EvaluationView;
let mine: AssessmentMine;
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AgencyAssessmentPanel
        detail={detail}
        round={round}
        busy={false}
        run={async (fn) => {
          await fn();
          return true;
        }}
      />
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.user = "reviewer";
  m.permissions = ["buyer:*"];
  mine = {
    session: {
      id: "session",
      roundId: "round",
      roundHash: "hash",
      subjectsJson: "[]",
      openedAt: "2026-11-09T01:00:00Z",
      openingHash: "hash",
      note: "合成开启",
    },
    subjects: [{ participationId: "a", supplierName: "合成供应商" }],
    criteria: [criterion],
    sheets: [
      {
        id: "sheet",
        userId: "reviewer",
        ordinal: 1,
        status: "draft",
        entriesJson: "[]",
        version: 1,
      },
    ],
    corrections: [],
    writable: true,
    blockers: [],
  };
  m.api.mockImplementation(async (path: string) =>
    path.endsWith("/assessment")
      ? { sessions: [mine.session], availableSubjects: [] }
      : structuredClone(mine),
  );
});
it("reviewer wildcard permissions do not expose organizer progress and do not fill opinions", async () => {
  setup();
  fireEvent.click(screen.getByText("独立评审任务"));
  await screen.findByRole("region", { name: "本人独立评审" });
  expect(screen.getByLabelText("合成供应商 T1分值")).toHaveValue(null);
  expect(screen.getByLabelText("合成供应商 T1意见")).toHaveValue("");
  expect(
    screen.queryByText("查看完成进度（不含个人意见）"),
  ).not.toBeInTheDocument();
  expect(screen.getByText("本人独立提交并锁定")).toBeDisabled();
});
it("background version changes retain local edits and prevent an overwrite or submission", async () => {
  const client = setup();
  fireEvent.click(screen.getByText("独立评审任务"));
  await screen.findByLabelText("合成供应商 T1分值");
  fireEvent.change(screen.getByLabelText("合成供应商 T1分值"), {
    target: { value: "8" },
  });
  mine.sheets[0].version = 2;
  client.setQueryData(
    ["agency-assessment-mine", "session", ""],
    structuredClone(mine),
  );
  await waitFor(() =>
    expect(screen.getByText(/意见版本已变化/)).toBeInTheDocument(),
  );
  expect(screen.getByLabelText("合成供应商 T1分值")).toHaveValue(8);
  expect(screen.getByText("保存本人草稿")).toBeDisabled();
  expect(screen.getByText("本人独立提交并锁定")).toBeDisabled();
});
it("submitted versions stay read-only and correction drafts unlock only approved cells", async () => {
  mine.sheets[0].status = "submitted";
  mine.sheets[0].entriesJson = JSON.stringify([
    {
      participationId: "a",
      criterionKey: "T1",
      score: 8,
      conclusion: null,
      evidence: "第1页",
      opinion: "本人意见",
    },
  ]);
  setup();
  fireEvent.click(screen.getByText("独立评审任务"));
  await screen.findByLabelText("合成供应商 T1分值");
  expect(screen.getByLabelText("合成供应商 T1分值")).toBeDisabled();
  expect(screen.queryByText("本人独立提交并锁定")).not.toBeInTheDocument();
  expect(screen.getByText("申请受控更正")).toBeInTheDocument();
});
