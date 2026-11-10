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
import { AgencyTotalPanel, type TotalWorkspace } from "./agency-total-panel";
const m = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@24bid/api-client", () => ({ evaluationRequest: m.api }));
vi.mock("../../lib/use-buyer-permissions", () => ({
  useBuyerPermissions: () => ({ can: () => true }),
}));
afterEach(cleanup);
const rule = {
  method: "mean_raw_then_weight",
  totalScale: 2,
  totalRounding: "HALF_UP",
  tieHandling: "manual_pending",
  sources: [
    { criterionKey: "T1", source: "member_mean" },
    { criterionKey: "P1", source: "objective_price" },
  ],
};
const workspace = () =>
  ({
    rule: { id: "r", status: "frozen", version: 2, frozenHash: "rh" },
    config: {
      ruleVersion: "v1",
      basis: "basis",
      locator: "p1",
      documentRule: rule,
      configuredRule: rule,
    },
    differences: [],
    ruleBlockers: [],
    basisFingerprint: "basis1",
    prices: [{ id: "price1", createdAt: "2026-11-09T00:00:00Z", stale: false }],
    history: [],
    blockers: [],
  }) as TotalWorkspace;
const detail = {
    record: { id: "p" },
    files: [
      {
        file: { name: "脱敏凭证", visibility: "project" },
        versions: [{ id: "proof", status: "sealed", ordinal: 1 }],
      },
    ],
  } as unknown as AgencyDetail,
  round = {
    config: {
      rules: ["T1", "P1"].map((key) => ({
        configuredRule: {
          key,
          title: key,
          resultType: "score",
          weight: "30",
          scale: 2,
          rounding: "HALF_UP",
        },
      })),
    },
  } as unknown as EvaluationView;
const trace = {
  method: "mean_raw_then_weight",
  totalScale: 2,
  totalRounding: "HALF_UP",
  roundingOrder: "精确计算",
  priceCalculationId: "price1",
  priceInputFingerprint: "pf",
  scopeJson: '{"exclusions":{}}',
  tieRule: "按冻结依据另行处理",
  subjects: [
    {
      participationId: "a",
      supplierName: "甲",
      components: [],
      componentSum: "79.00",
      total: "79.00",
    },
    {
      participationId: "b",
      supplierName: "乙",
      components: [],
      componentSum: "79.00",
      total: "79.00",
    },
  ],
  ties: [{ total: "79.00", participationIds: ["a", "b"] }],
};
function mount(w: TotalWorkspace) {
  m.api.mockImplementation(async (p: string) =>
    p.endsWith("/preview")
      ? { basisFingerprint: "basis1", fingerprint: "fp", trace, blockers: [] }
      : w,
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AgencyTotalPanel
        detail={detail}
        round={round}
        session={{ id: "s" } as AssessmentSession}
        busy={false}
        run={async (fn) => {
          await fn();
          return true;
        }}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("综合评分受控汇总"));
  return client;
}
it("requires explicit price selection and invalidates confirmation on changed input while preserving manual review", async () => {
  const w = workspace(),
    client = mount(w);
  await screen.findByLabelText("汇总价格计算版本");
  expect(screen.getByText("生成受控汇总预览")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("汇总价格计算版本"), {
    target: { value: "price1" },
  });
  fireEvent.click(screen.getByText("生成受控汇总预览"));
  await screen.findByText(/同分 79.00/);
  fireEvent.change(screen.getByLabelText("汇总复核凭证"), {
    target: { value: "proof" },
  });
  fireEvent.change(screen.getByLabelText("汇总复核说明"), {
    target: { value: "保留逐项人工核对说明" },
  });
  fireEvent.click(
    screen.getByLabelText("已逐项复核唯一计分来源、成员版本及汇总明细"),
  );
  expect(screen.getByText("确认并保存受控汇总")).not.toBeDisabled();
  client.setQueryData(["agency-totals", "s"], {
    ...w,
    basisFingerprint: "basis2",
  });
  await waitFor(() =>
    expect(screen.getByText("确认并保存受控汇总")).toBeDisabled(),
  );
  expect(screen.getByLabelText("汇总复核说明")).toHaveValue(
    "保留逐项人工核对说明",
  );
  expect(screen.getByLabelText("汇总价格计算版本")).toHaveValue("price1");
});
it("rule source differences cannot be frozen even after checking review", async () => {
  const w = workspace();
  w.rule!.status = "draft";
  w.differences = ["逐项计分来源"];
  mount(w);
  await screen.findByText("原文差异：逐项计分来源");
  fireEvent.change(screen.getByLabelText("汇总规则维护说明"), {
    target: { value: "尚有价格重复计分差异" },
  });
  fireEvent.click(
    screen.getByLabelText("已核对原文汇总、成员范围、唯一计分来源及舍入顺序"),
  );
  expect(screen.getByText("冻结本版汇总规则")).toBeDisabled();
});
it("historical ties remain pending manual handling and stale snapshots are clearly marked", async () => {
  const w = workspace();
  w.history = [
    {
      stale: true,
      snapshot: {
        id: "old",
        createdAt: "2026-11-09T00:00:00Z",
        reason: "独立汇总保留记录",
        ruleHash: "oldhash",
        traceJson: JSON.stringify(trace),
      },
    },
  ];
  mount(w);
  await screen.findByText(/输入已变化，须重新复核/);
  expect(screen.getByText(/同分 79.00：甲、乙/)).toBeInTheDocument();
  expect(screen.queryByText(/第一名|中标人/)).not.toBeInTheDocument();
});
