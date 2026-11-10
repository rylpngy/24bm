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
  AgencyFinalQuotePanel,
  type FinalQuoteWorkspace,
} from "./agency-final-quote-panel";
const m = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@24bid/api-client", () => ({
  evaluationRequest: m.api,
  agencyFileUpload: vi.fn(),
  agencyFileDownload: vi.fn(),
}));
vi.mock("../../lib/use-buyer-permissions", () => ({
  useBuyerPermissions: () => ({ can: () => true }),
}));
afterEach(cleanup);
const detail = {
  record: { id: "p", currency: "CNY" },
  files: [
    {
      file: { name: "脱敏凭证", visibility: "project" },
      versions: [{ id: "proof", status: "sealed", ordinal: 1 }],
    },
  ],
} as unknown as AgencyDetail;
const session = { id: "s" } as AssessmentSession;
const workspace = (status = "collecting") =>
  ({
    campaign: {
      id: "c",
      status,
      version: 1,
      cutoffAt: "2020-01-01T10:00:00Z",
      initiatedAt: "2020-01-01T09:00:00Z",
      exclusionsJson: "{}",
    },
    candidates: [],
    subjects: [{ participationId: "a", supplierName: "甲" }],
    receipts: [],
    results: [],
    blockers: [],
    receiptFingerprint: "hash1",
  }) as unknown as FinalQuoteWorkspace;
function mount(w: FinalQuoteWorkspace) {
  m.api.mockResolvedValue(w);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AgencyFinalQuotePanel
        detail={detail}
        session={session}
        busy={false}
        run={async (f) => {
          await f();
          return true;
        }}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("线下最后报价（谈判/磋商）"));
  return client;
}
it("invalidates confirmation when sealed material changes and preserves all manual decisions", async () => {
  const w = workspace(),
    client = mount(w);
  await screen.findByText("截止后逐家核对与确认");
  fireEvent.change(screen.getByLabelText("最后报价处理 甲"), {
    target: { value: "not_submitted" },
  });
  fireEvent.change(screen.getByLabelText("最后报价处理依据 甲"), {
    target: { value: "未提交的有权处理依据" },
  });
  fireEvent.change(screen.getByLabelText("最后报价确认凭证"), {
    target: { value: "proof" },
  });
  fireEvent.change(screen.getByLabelText("最后报价确认及后续处理说明"), {
    target: { value: "待后续按规则处理，不自动继续" },
  });
  fireEvent.click(
    screen.getByLabelText("已逐家核对最终响应、实际接收时点及异常处理"),
  );
  expect(screen.getByText("确认最后报价及逐家处理并锁定")).not.toBeDisabled();
  client.setQueryData(["agency-final-quotes", "s"], {
    ...w,
    receiptFingerprint: "hash2",
  });
  await waitFor(() =>
    expect(screen.getByText("确认最后报价及逐家处理并锁定")).toBeDisabled(),
  );
  expect(screen.getByLabelText("最后报价处理 甲")).toHaveValue("not_submitted");
  expect(screen.getByLabelText("最后报价处理依据 甲")).toHaveValue(
    "未提交的有权处理依据",
  );
});
it("shows a missing final quote without inventing an amount or download", async () => {
  const w = workspace("confirmed");
  w.results = [
    {
      participationId: "a",
      receiptId: null,
      status: "not_submitted",
      reason: "未提交，不用初次报价替代",
      amount: null,
      currency: null,
      fileVersionId: null,
      hash: null,
    },
  ];
  mount(w);
  await screen.findByText("未形成有效最后报价");
  expect(screen.getByText("未提交最后报价")).toBeInTheDocument();
  expect(screen.queryByText("下载已确认最后报价材料")).not.toBeInTheDocument();
  expect(
    screen.queryByText("确认最后报价及逐家处理并锁定"),
  ).not.toBeInTheDocument();
});
