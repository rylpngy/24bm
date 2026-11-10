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
import { AgencyPricePanel, type PriceWorkspace } from "./agency-price-panel";
const m = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@24bid/api-client", () => ({ evaluationRequest: m.api }));
vi.mock("../../lib/use-buyer-permissions", () => ({
  useBuyerPermissions: () => ({ can: () => true }),
}));
afterEach(cleanup);
const r = {
  priceSource: "final_original",
  formula: "minimum_ratio",
  criterionKey: "P1",
  fullScore: "30",
  scale: 2,
  rounding: "HALF_UP",
  tieRule: "按定稿同分依据另行处理",
};
const workspace = () =>
  ({
    rule: { id: "rule", status: "frozen", version: 2, frozenHash: "rulehash" },
    config: {
      ruleVersion: "v1",
      basis: "basis",
      locator: "p1",
      documentRule: r,
      configuredRule: r,
    },
    differences: [],
    ruleBlockers: [],
    candidates: [{ participationId: "a", supplierName: "甲" }],
    basisFingerprint: "basis1",
    blockers: [],
    history: [],
  }) as PriceWorkspace;
const detail = {
  record: { id: "p" },
  files: [
    {
      file: { name: "脱敏凭证", visibility: "project" },
      versions: [{ id: "proof", status: "sealed", ordinal: 1 }],
    },
  ],
} as unknown as AgencyDetail;
function mount(w: PriceWorkspace) {
  m.api.mockImplementation(async (path: string) =>
    path.endsWith("/preview")
      ? {
          fingerprint: "preview1",
          basisFingerprint: "basis1",
          scope: { participationIds: ["a"], exclusions: {} },
          blockers: [],
          trace: {
            formula: "minimum_ratio",
            minimum: "999999999999999999.99",
            fullScore: "30",
            scale: 2,
            rounding: "HALF_UP",
            roundingOrder: "仅最终除法舍入",
            lines: [
              {
                participationId: "a",
                supplierName: "甲",
                sourceId: "receipt",
                sourceHash: "h",
                sourceKind: "final_original",
                price: "999999999999999999.99",
                currency: "CNY",
                numerator: "29999999999999999999.70",
                score: "30.00",
              },
            ],
          },
        }
      : w,
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AgencyPricePanel
        detail={detail}
        session={{ id: "s" } as AssessmentSession}
        busy={false}
        run={async (fn) => {
          await fn();
          return true;
        }}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("价格规则与计算明细"));
  return client;
}
it("preserves exact money, and invalidates reviewed preview on changed input while keeping manual text", async () => {
  const w = workspace(),
    client = mount(w);
  await screen.findByLabelText("纳入价格计算 甲");
  fireEvent.click(screen.getByLabelText("纳入价格计算 甲"));
  fireEvent.click(screen.getByText("生成价格计算预览"));
  await screen.findByText("999999999999999999.99 CNY");
  fireEvent.change(screen.getByLabelText("价格计算复核凭证"), {
    target: { value: "proof" },
  });
  fireEvent.change(screen.getByLabelText("价格计算复核说明"), {
    target: { value: "人工逐项复核说明" },
  });
  fireEvent.click(
    screen.getByLabelText("已复核指定价格来源、逐家处理及全部计算明细"),
  );
  expect(screen.getByText("确认并保存独立价格计算")).not.toBeDisabled();
  client.setQueryData(["agency-price-calculations", "s"], {
    ...w,
    basisFingerprint: "basis2",
  });
  await waitFor(() =>
    expect(screen.getByText("确认并保存独立价格计算")).toBeDisabled(),
  );
  expect(screen.getByLabelText("价格计算复核说明")).toHaveValue(
    "人工逐项复核说明",
  );
  expect(
    screen.getByText("输入或范围已变化，请重新生成价格计算预览。"),
  ).toBeInTheDocument();
});
it("a persisted source/configuration difference prevents freezing", async () => {
  const w = workspace();
  w.rule!.status = "draft";
  w.differences = ["价格来源"];
  mount(w);
  await screen.findByText("原文差异：价格来源");
  fireEvent.change(screen.getByLabelText("价格规则维护说明"), {
    target: { value: "已核对但存在差异" },
  });
  fireEvent.click(
    screen.getByLabelText("已逐项核对原文、价格来源、权重及仅最终除法舍入"),
  );
  expect(screen.getByText("冻结本版价格规则")).toBeDisabled();
});
it("shows stale immutable historical calculations distinctly", async () => {
  const w = workspace();
  w.history = [
    {
      stale: true,
      calculation: {
        id: "old",
        createdAt: "2026-11-09T01:00:00Z",
        reason: "历史核对",
        ruleHash: "oldhash",
        scopeJson: '{"participationIds":["a"],"exclusions":{}}',
        traceJson: JSON.stringify({
          formula: "price_comparison",
          minimum: "0.00",
          fullScore: "0",
          scale: 2,
          rounding: "DOWN",
          roundingOrder: "不舍入价格",
          lines: [],
        }),
      },
    },
  ];
  mount(w);
  await screen.findByText(/输入已变化，须重新复核/);
  expect(screen.getByText("历史核对")).toBeInTheDocument();
});
