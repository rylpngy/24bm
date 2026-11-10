import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, it, expect, vi } from "vitest";
import type {
  AgencyDetail,
  EvaluationConfig,
  EvaluationWorkspace,
} from "@24bid/api-client";
import { AgencyEvaluationPanel } from "./agency-evaluation-panel";
vi.mock("./agency-method-procedure-panel",()=>({AgencyMethodProcedurePanel:()=>null}));
vi.mock("./agency-assessment-panel",()=>({AgencyAssessmentPanel:()=>null}));
vi.mock("./agency-opening-panel",()=>({AgencyOpeningPanel:()=>null}));
vi.mock("./agency-incident-panel",()=>({AgencyIncidentPanel:()=>null}));
const m = vi.hoisted(() => ({ api: vi.fn(), options: vi.fn() }));
vi.mock("@24bid/api-client", () => ({
  evaluationRequest: m.api,
  agencyOptions: m.options,
}));
const config: EvaluationConfig = {
  title: "合成第一轮",
  documentRevisionId: "rev",
  evaluationMethod: "comprehensive",
  ruleVersion: "V1",
  ruleBasis: "已记录来源",
  venue: "测试室",
  scheduledAt: "2026-11-10T01:00:00Z",
  members: [{ userId: "owner", roles: ["organizer", "review_member"] }],
  rules: [
    {
      documentRule: {
        key: "T",
        title: "技术方案",
        stage: "technical",
        applicableTo: "供应商",
        resultType: "score",
        minimum: "0",
        maximum: "10",
        weight: "100",
        formula: "weighted_normalized",
        evidenceRequired: true,
        scale: 2,
        rounding: "HALF_UP",
      },
      configuredRule: {
        key: "T",
        title: "技术方案",
        stage: "technical",
        applicableTo: "供应商",
        resultType: "score",
        minimum: "0",
        maximum: "10",
        weight: "100",
        formula: "weighted_normalized",
        evidenceRequired: true,
        scale: 2,
        rounding: "HALF_UP",
      },
      locator: "第1页",
      manuallyChecked: true,
    },
  ],
  tieRule: "同分交人工核对",
};
let ws: EvaluationWorkspace;
const detail = {
  record: { id: "p", ownerId: "owner" },
  data: { ownerId: "owner" },
  members: [],
} as unknown as AgencyDetail;
function setup(editable = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AgencyEvaluationPanel
        detail={detail}
        editable={editable}
        canFreeze={true}
        busy={false}
        run={async (f) => {
          await f();
          return true;
        }}
      />
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  ws = {
    sources: [
      {
        revisionId: "rev",
        inputVersion: 1,
        fileVersionId: "fv",
        hash: "hash",
        current: true,
        basisStale: false,
      },
    ],
    rounds: [
      {
        round: {
          id: "r",
          ordinal: 1,
          status: "draft",
          version: 1,
          voidReason: "",
        },
        config: structuredClone(config),
        roster: [
          {
            userId: "owner",
            name: "张某",
            roles: ["organizer", "review_member"],
          },
        ],
        differences: [],
        blockers: [],
        frozenBasisStale: false,
      },
    ],
  };
  m.api.mockImplementation(async () => structuredClone(ws));
  m.options.mockResolvedValue({ users: [{ id: "owner", name: "张某" }] });
});
it("read-only readers inspect source rules and duties without configuration actions", async () => {
  setup(false);
  await screen.findByRole("heading", { name: /第1轮/ });
  fireEvent.click(screen.getByText("查看人员职责与规则内容"));
  expect(screen.getByText(/张某 · 项目组织人员、评审成员/)).toBeInTheDocument();
  expect(screen.queryByText("保存评审准备草稿")).not.toBeInTheDocument();
  expect(screen.queryByText("冻结第1轮准备配置")).not.toBeInTheDocument();
});
it("editing either source or configured rule clears its manual confirmation", async () => {
  setup();
  fireEvent.click(await screen.findByText("打开此轮草稿"));
  expect(screen.getByLabelText("已核对规则1")).toBeChecked();
  fireEvent.change(screen.getByLabelText("规则1系统配置满分"), {
    target: { value: "20" },
  });
  expect(screen.getByLabelText("已核对规则1")).not.toBeChecked();
  expect(screen.getByLabelText("规则1文件原文满分")).toHaveValue("10");
  expect(
    screen.getByRole("button", { name: "冻结第1轮准备配置" }),
  ).toBeDisabled();
});
it("a background version change preserves edits and invalidates the freeze attestation", async () => {
  const client = setup();
  await screen.findByText("打开此轮草稿");
  fireEvent.change(screen.getByLabelText("第1轮确认依据"), {
    target: { value: "已核对" },
  });
  fireEvent.click(screen.getByLabelText("第1轮业务规则已复核"));
  expect(
    screen.getByRole("button", { name: "冻结第1轮准备配置" }),
  ).not.toBeDisabled();
  fireEvent.click(screen.getByText("打开此轮草稿"));
  fireEvent.change(screen.getByLabelText("评审轮次名称"), {
    target: { value: "未保存内容" },
  });
  ws.rounds[0].round.version = 2;
  client.setQueryData(["agency-evaluation", "p"], structuredClone(ws));
  await waitFor(() =>
    expect(screen.getByLabelText("第1轮业务规则已复核")).not.toBeChecked(),
  );
  expect(screen.getByLabelText("评审轮次名称")).toHaveValue("未保存内容");
  expect(screen.getByText(/当前轮次已被修改或冻结/)).toBeInTheDocument();
  expect(screen.getByText("保存评审准备草稿")).toBeDisabled();
});
