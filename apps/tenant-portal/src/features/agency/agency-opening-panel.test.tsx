import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, it, expect, vi } from "vitest";
import type {
  AgencyDetail,
  EvaluationView,
  OpeningWorkspace,
  AssessmentStageBoard,
} from "@24bid/api-client";
import { AgencyOpeningPanel, AgencyStagePanel } from "./agency-opening-panel";
const m = vi.hoisted(() => ({
  api: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
}));
vi.mock("@24bid/api-client", () => ({
  evaluationRequest: m.api,
  agencyFileUpload: m.upload,
  agencyFileDownload: m.download,
}));
vi.mock("../../lib/auth-store", () => ({
  useAuthStore: (f: (s: unknown) => unknown) => f({ session: { userId: "u" } }),
}));
vi.mock("../../lib/use-buyer-permissions", () => ({
  useBuyerPermissions: () => ({ can: () => true }),
}));
const detail = {
  record: { id: "p" },
  files: [
    {
      file: {
        id: "proof",
        name: "阶段凭证.txt",
        visibility: "project",
        category: "other",
      },
      versions: [{ id: "fv", status: "sealed", ordinal: 1 }],
    },
  ],
} as unknown as AgencyDetail;
const round = {
  round: { id: "r", status: "frozen", version: 2 },
  config: { members: [{ userId: "u", roles: ["organizer"] }] },
} as unknown as EvaluationView;
let workspace: OpeningWorkspace, board: AssessmentStageBoard;
function setup(stage = false) {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={c}>
      {stage ? (
        <AgencyStagePanel
          detail={detail}
          session="session"
          busy={false}
          run={async (f) => {
            await f();
            return true;
          }}
        />
      ) : (
        <AgencyOpeningPanel
          detail={detail}
          round={round}
          busy={false}
          run={async (f) => {
            await f();
            return true;
          }}
        />
      )}
    </QueryClientProvider>,
  );
  return c;
}
beforeEach(() => {
  vi.clearAllMocks();
  workspace = {
    plan: { roundId: "r", status: "draft", version: 1 },
    config: {
      cutoffAt: "2026-11-09T01:00:00Z",
      notBefore: "2026-11-09T02:00:00Z",
      minimumSubjects: 1,
      ruleBasis: "合成依据",
      items: [],
    },
    receipts: [],
    opening: null,
    issues: [],
  };
  board = {
    stages: [
      {
        stageKey: "evaluation",
        released: false,
        complete: false,
        candidates: [
          { participationId: "a", supplierName: "甲", priorPassed: true },
        ],
        prerequisiteHash: "first",
      },
    ],
  };
  m.api.mockImplementation(async (path: string) =>
    path.endsWith("/assessment")
      ? { sessions: [], availableSubjects: [] }
      : path.endsWith("/stages")
        ? structuredClone(board)
        : structuredClone(workspace),
  );
});
it("receipt metadata does not offer downloads before opening and reader roles are not preselected", async () => {
  workspace.plan = null;
  workspace.receipts = [
    {
      receipt: {
        id: "receipt",
        participationId: "a",
        itemKey: "response",
        receivedAt: "2026-11-09T00:00:00Z",
        originalType: "electronic_copy",
        sourceNote: "合成",
        lateEntryReason: "",
        status: "received",
        version: 1,
        withdrawReason: "",
      },
      file: {
        file: {
          id: "file",
          name: "响应.txt",
          visibility: "restricted",
          category: "response_material",
        },
        versions: [
          {
            id: "v",
            ordinal: 1,
            status: "sealed",
            hash: "hash",
            createdAt: "",
            reason: "",
          },
        ],
      },
      readable: false,
    },
  ];
  setup();
  fireEvent.click(screen.getByText("材料接收与正式开启"));
  await screen.findByText(/内容未开放/);
  expect(screen.queryByText("下载已开启响应材料")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("新增材料清单项"));
  expect(screen.getByLabelText("材料项1可读 评审成员")).not.toBeChecked();
  expect(m.download).not.toHaveBeenCalled();
});
it("a changed plan version invalidates the manual plan confirmation while preserving the note", async () => {
  const client = setup();
  fireEvent.click(screen.getByText("材料接收与正式开启"));
  await screen.findByText("确认并锁定接收计划");
  fireEvent.change(screen.getByLabelText("接收计划维护原因"), {
    target: { value: "我已核对本版" },
  });
  fireEvent.click(
    screen.getByLabelText(
      "已按定稿核对材料清单、截止、开启时间及对象门槛，确认锁定",
    ),
  );
  expect(screen.getByText("确认并锁定接收计划")).not.toBeDisabled();
  workspace.plan!.version = 2;
  client.setQueryData(["agency-materials", "r"], structuredClone(workspace));
  await waitFor(() =>
    expect(screen.getByText("确认并锁定接收计划")).toBeDisabled(),
  );
  expect(screen.getByLabelText("接收计划维护原因")).toHaveValue("我已核对本版");
});
it("a changed prerequisite hash clears only the confirmation and retains phase handling notes", async () => {
  const client = setup(true);
  fireEvent.click(screen.getByText("阶段条件与后续开放"));
  await screen.findByLabelText("下一阶段对象 甲");
  fireEvent.click(screen.getByLabelText("下一阶段对象 甲"));
  fireEvent.change(screen.getByLabelText("阶段依据版本 evaluation"), {
    target: { value: "fv" },
  });
  fireEvent.change(screen.getByLabelText("阶段核对说明 evaluation"), {
    target: { value: "已核对前阶段" },
  });
  fireEvent.click(screen.getByLabelText("已核对阶段 evaluation"));
  expect(
    screen.getByRole("button", { name: "确认开放评审或专业协商意见" }),
  ).not.toBeDisabled();
  board.stages[0].prerequisiteHash = "second";
  client.setQueryData(["agency-stages", "session"], structuredClone(board));
  await waitFor(() =>
    expect(screen.getByLabelText("已核对阶段 evaluation")).not.toBeChecked(),
  );
  expect(screen.getByLabelText("阶段核对说明 evaluation")).toHaveValue(
    "已核对前阶段",
  );
});
