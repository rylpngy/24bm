import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { it, expect, vi } from "vitest";
import type { AgencyDetail, AssessmentSession } from "@24bid/api-client";
import { AgencyQuotePanel } from "./agency-quote-panel";
const m = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@24bid/api-client", () => ({ evaluationRequest: m.api }));
vi.mock("../../lib/use-buyer-permissions", () => ({
  useBuyerPermissions: () => ({ can: () => true }),
}));
it("keeps exact decimal display and invalidates review when the chain tip changes", async () => {
  let rows = [
    {
      id: "v1",
      participationId: "a",
      ordinal: 1,
      originalAmount: "999999999999999999.99",
      correctedAmount: null,
      evaluationAmount: null,
      currency: "CNY",
      reason: "original",
    },
  ];
  m.api.mockImplementation(async () => rows);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const detail = {
    record: { id: "p" },
    files: [
      {
        file: { name: "proof", visibility: "project" },
        versions: [{ id: "fv", status: "sealed", ordinal: 1 }],
      },
    ],
  } as unknown as AgencyDetail;
  const session = {
    id: "s",
    subjectsJson: JSON.stringify([
      { participationId: "a", supplierName: "甲" },
    ]),
  } as AssessmentSession;
  render(
    <QueryClientProvider client={client}>
      <AgencyQuotePanel
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
  await screen.findByText("999999999999999999.99");
  fireEvent.click(screen.getByText("人工报价分层记录"));
  fireEvent.change(screen.getByLabelText("报价对象"), {
    target: { value: "a" },
  });
  fireEvent.change(screen.getByLabelText("报价层类型"), {
    target: { value: "correction" },
  });
  fireEvent.change(screen.getByLabelText("报价金额"), {
    target: { value: "0.00" },
  });
  fireEvent.change(screen.getByLabelText("报价脱敏依据版本"), {
    target: { value: "fv" },
  });
  fireEvent.change(screen.getByLabelText("报价核对说明"), {
    target: { value: "待核对内容" },
  });
  fireEvent.click(
    screen.getByLabelText("已核对本次价格层、最新版本及适用依据"),
  );
  expect(screen.getByText("追加报价记录并保留历史")).not.toBeDisabled();
  rows = [{ ...rows[0], id: "v2", ordinal: 2 }];
  client.setQueryData(["agency-quotes", "s"], rows);
  await waitFor(() =>
    expect(screen.getByText("追加报价记录并保留历史")).toBeDisabled(),
  );
  expect(screen.getByLabelText("报价金额")).toHaveValue("0.00");
  expect(screen.getByLabelText("报价核对说明")).toHaveValue("待核对内容");
});
