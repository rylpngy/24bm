import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { it, vi, expect, afterEach } from "vitest";
import type { AgencyDetail, EvaluationView } from "@24bid/api-client";
import { AgencyMethodProcedurePanel } from "./agency-method-procedure-panel";
const m = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@24bid/api-client", () => ({ evaluationRequest: m.api }));
vi.mock("../../lib/use-buyer-permissions", () => ({
  useBuyerPermissions: () => ({ can: () => true }),
}));
vi.mock("../../lib/auth-store", () => ({
  useAuthStore: (f: (s: unknown) => unknown) =>
    f({ session: { userId: "org" } }),
}));
afterEach(cleanup);
function mount(
  method = "邀请招标",
  history: unknown[] = [],
  legacy: string[] = [],
) {
  const w = {
    method,
    history,
    legacyKinds: legacy,
    participants: [
      { id: "a", supplierName: "甲" },
      { id: "b", supplierName: "乙" },
    ],
    subjects: [
      { participationId: "a", supplierName: "甲" },
      { participationId: "b", supplierName: "乙" },
    ],
    blockers: [],
  };
  m.api.mockImplementation(async (p: string) =>
    p.endsWith("/assessment")
      ? { sessions: method === "询价" ? [{ id: "session" }] : [] }
      : p.endsWith("/quotes")
        ? [
            { id: "qa", participationId: "a" },
            { id: "qb", participationId: "b" },
          ]
        : w,
  );
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={c}>
      <AgencyMethodProcedurePanel
        detail={
          {
            record: { id: "p", procurementMethod: method, currency: "CNY" },
            files: [
              {
                file: { visibility: "project", name: "脱敏依据" },
                versions: [{ id: "proof", ordinal: 1, status: "sealed" }],
              },
            ],
          } as unknown as AgencyDetail
        }
        round={
          {
            round: { id: "r", status: "frozen", frozenHash: "h" },
            config: { members: [{ userId: "org", roles: ["organizer"] }] },
            roster: [{ userId: "org", name: "组织人员", roles: ["organizer"] }],
          } as unknown as EvaluationView
        }
        busy={false}
        run={async (f) => {
          await f();
          return true;
        }}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText(method + "专有程序与凭证"));
  return { c, w };
}
it("does not default invitation prequalification and requires renewed acknowledgment after edits", async () => {
  mount();
  await screen.findByLabelText("名单形成方式");
  fireEvent.click(screen.getByLabelText("甲", { exact: true }));
  expect(screen.getByLabelText("甲 核验适用类型")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("邀请名单形成与逐家送达登记依据"), {
    target: { value: "有据形成及实际送达核对" },
  });
  fireEvent.click(screen.getByLabelText(/已核对适用依据、实际程序/));
  expect(
    screen.getByRole("button", { name: "确认记录邀请名单形成与逐家送达" }),
  ).toBeEnabled();
  fireEvent.change(screen.getByLabelText("甲 名单来源"), {
    target: { value: "变更后的实际来源" },
  });
  expect(screen.getByLabelText(/已核对适用依据、实际程序/)).not.toBeChecked();
});
it("submits the selected invitation identities with explicit provenance rather than silently selecting all suppliers", async () => {
  mount();
  await screen.findByLabelText("名单形成方式");
  fireEvent.click(screen.getByLabelText("甲", { exact: true }));
  fireEvent.change(screen.getByLabelText("甲 核验适用类型"), {
    target: { value: "not_applicable" },
  });
  fireEvent.change(screen.getByLabelText("邀请名单形成与逐家送达登记依据"), {
    target: { value: "本轮实际依据" },
  });
  fireEvent.click(screen.getByLabelText(/已核对适用依据、实际程序/));
  fireEvent.click(
    screen.getByRole("button", { name: "确认记录邀请名单形成与逐家送达" }),
  );
  await waitFor(() =>
    expect(m.api).toHaveBeenCalledWith(
      "/packages/p/rounds/r/procedures/invitation",
      "POST",
      expect.objectContaining({
        expectedPreviousHash: null,
        participants: [
          { participationId: "a", verificationMode: "not_applicable" },
        ],
        reviewed: true,
      }),
    ),
  );
});
it("invalidates inquiry acknowledgment when an exact quote source changes while preserving entered facts", async () => {
  const { c } = mount("询价");
  await screen.findByLabelText("甲 有效性与异常处理依据");
  fireEvent.change(screen.getByLabelText("甲 有效性与异常处理依据"), {
    target: { value: "已录入的实际核对说明" },
  });
  fireEvent.change(screen.getByLabelText("一次报价登记依据"), {
    target: { value: "一次报价来源核对" },
  });
  fireEvent.click(screen.getByLabelText(/已逐家核对一次报价、原始金额/));
  expect(
    screen.getByRole("button", { name: "确认一次报价有效性记录" }),
  ).toBeEnabled();
  c.setQueryData(
    ["agency-inquiry-quotes", "session"],
    [
      { id: "new", participationId: "a" },
      { id: "qb", participationId: "b" },
    ],
  );
  await waitFor(() =>
    expect(
      screen.getByLabelText(/已逐家核对一次报价、原始金额/),
    ).not.toBeChecked(),
  );
  expect(screen.getByLabelText("甲 有效性与异常处理依据")).toHaveValue(
    "已录入的实际核对说明",
  );
});
it("presents readable immutable procedure evidence and keeps transport keys out of business history", async () => {
  mount(
    "单一来源",
    [
      {
        id: "row",
        kind: "single_basis",
        ordinal: 1,
        frozenHash: "sha",
        snapshotJson: JSON.stringify({
          content: {
            grounds: "实际适用理由",
            reason: "实际核对",
            idempotencyKey: "INTERNAL-TRANSPORT-KEY",
          },
          evidenceHashes: { grounds: "proofhash" },
        }),
      },
    ],
    ["single_basis"],
  );
  await screen.findByText(/历史线下依据路径/);
  fireEvent.click(screen.getByText(/不可变程序历史/));
  fireEvent.click(screen.getByText(/单一来源适用依据 · 第1版/));
  expect(screen.getByText("实际适用理由")).toBeInTheDocument();
  expect(screen.queryByText(/INTERNAL-TRANSPORT-KEY/)).toBeNull();
});
