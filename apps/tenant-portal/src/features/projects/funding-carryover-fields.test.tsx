import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import {
  FundingCarryoverFields,
  FundingCarryoverEvidence,
  type FundingTarget,
} from "./funding-carryover-fields";
const state = vi.hoisted(() => ({ fail: false, calls: vi.fn() }));
vi.mock("@24bid/api-client/http-client", () => ({
  customInstance: async (request: unknown) => {
    state.calls(request);
    if (state.fail) throw new Error("无权访问");
    return {
      data: {
        enabled: true,
        priorPaidAmount: 50,
        sourcePeriod: "2026",
        sources: [
          {
            fundId: "a",
            code: "A",
            name: "原资金",
            paidAmount: 50,
            remainingAmount: 100,
          },
        ],
        choices: [
          { id: "next", code: "N", name: "目标资金", availableAmount: 200 },
        ],
      },
    };
  },
}));
beforeEach(() => {
  state.fail = false;
  state.calls.mockClear();
});
function show(target = "2027") {
  function Form() {
    const [rows, setRows] = useState<FundingTarget[]>([]),
      [ready, setReady] = useState(false);
    return (
      <>
        <FundingCarryoverFields
          projectId="p"
          target={target}
          value={rows}
          onChange={setRows}
          onReady={setReady}
        />
        <button disabled={!ready}>提交资金承接</button>
      </>
    );
  }
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Form />
    </QueryClientProvider>,
  );
}
it("requires an explicit target choice before allowing carryover", async () => {
  show();
  const field = await screen.findByLabelText("承接资金来源 A");
  expect(
    (screen.getByRole("button", { name: "提交资金承接" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.change(field, { target: { value: "next" } });
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "提交资金承接",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  expect(state.calls.mock.calls[0][0]).toMatchObject({
    params: { targetPeriod: "2027" },
  });
});
it("does not query with incomplete years", () => {
  show("202");
  expect(state.calls).not.toHaveBeenCalled();
});
it("blocks submission and shows a retry/permission message after lookup failure", async () => {
  state.fail = true;
  show();
  expect(
    await screen.findByText("目标资金来源加载失败，请刷新或核对预算查看权限。"),
  ).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "提交资金承接" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
it("shows retained paid cash and explicit source inheritance in read-only history", () => {
  render(
    <FundingCarryoverEvidence
      snapshot={JSON.stringify({
        fundingCarryover: {
          sourcePeriod: "2026",
          targetPeriod: "2027",
          paidBasis: 50,
          lines: [
            {
              sourceCode: "A",
              sourceName: "原来源",
              targetCode: "N",
              targetName: "新来源",
              retainedPaidAmount: 50,
              amount: 100,
            },
          ],
        },
      })}
    />,
  );
  expect(screen.getByText("A · 原来源")).toBeTruthy();
  expect(screen.getByText("N · 新来源")).toBeTruthy();
  expect(screen.queryByRole("combobox")).toBeNull();
});
