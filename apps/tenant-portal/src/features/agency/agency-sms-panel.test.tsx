import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { it, expect, vi, afterEach } from "vitest";
import { AgencySmsPanel } from "./agency-sms-panel";
const m = vi.hoisted(() => ({
  api: vi.fn(),
  execution: vi.fn(),
  options: vi.fn(),
}));
vi.mock("@24bid/api-client", () => ({
  agencyRequest: m.api,
  executionRequest: m.execution,
  agencyOptions: m.options,
}));
vi.mock("../../lib/use-buyer-permissions", () => ({
  useBuyerPermissions: () => ({ can: () => true }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
async function mount(configured = true, deliveries: unknown[] = []) {
  m.api.mockResolvedValue({
    configured,
    settings: { enabled: configured, dailyLimit: 20, version: 1 },
    contacts: [],
    deliveries,
  });
  m.execution.mockResolvedValue({
    deliveries: [
      {
        delivery: {
          id: "event-1",
          recipientId: "user",
          status: "delivered",
          level: "overdue",
        },
      },
    ],
  });
  m.options.mockResolvedValue({ users: [{ id: "user", name: "合成人员" }] });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AgencySmsPanel
        pkg="package"
        busy={false}
        run={async (f) => {
          await f();
          return true;
        }}
      />
    </QueryClientProvider>,
  );
  const details = screen.getByText("短信通道与外发授权").closest("details")!;
  details.open = true;
  fireEvent(details, new Event("toggle"));
  await screen.findByText(configured ? /网关已配置/ : /网关未配置/);
}
it("requires event-specific explicit consent before enabling a real send", async () => {
  await mount();
  const send = screen.getByRole("button", { name: "授权并排队发送" });
  expect(send).toBeDisabled();
  fireEvent.change(screen.getByLabelText("操作依据"), {
    target: { value: "有权外发依据" },
  });
  fireEvent.change(screen.getByLabelText("选择短信提醒事件"), {
    target: { value: "event-1" },
  });
  expect(send).toBeDisabled();
  fireEvent.click(
    screen.getByLabelText("已核对接收人，授权将此提醒通过短信网关实际外发"),
  );
  expect(send).toBeEnabled();
  fireEvent.click(send);
  await waitFor(() =>
    expect(m.api).toHaveBeenCalledWith("/packages/package/sms", "POST", {
      reminderId: "event-1",
      authorized: true,
      reason: "有权外发依据",
    }),
  );
  expect(send).toBeDisabled();
});
it("keeps gateway acceptance separate from delivery and unknown requests have no retry action", async () => {
  await mount(true, [
    {
      id: "a",
      recipientId: "user",
      status: "accepted",
      providerRef: "ref",
      attempts: 1,
      errorText: "",
    },
    {
      id: "u",
      recipientId: "user",
      status: "unknown",
      providerRef: null,
      attempts: 1,
      errorText: "等待查询",
    },
  ]);
  expect(screen.getByText(/网关受理，尚未送达/)).toBeInTheDocument();
  expect(screen.getByText(/结果未知，禁止盲目重发/)).toBeInTheDocument();
  expect(screen.queryByText("收到送达回执")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "授权重试未受理请求" }),
  ).toBeNull();
});
it("never enables sending while provider configuration is absent", async () => {
  await mount(false);
  fireEvent.change(screen.getByLabelText("操作依据"), {
    target: { value: "依据" },
  });
  fireEvent.change(screen.getByLabelText("选择短信提醒事件"), {
    target: { value: "event-1" },
  });
  fireEvent.click(
    screen.getByLabelText("已核对接收人，授权将此提醒通过短信网关实际外发"),
  );
  expect(screen.getByRole("button", { name: "授权并排队发送" })).toBeDisabled();
  expect(m.api.mock.calls.every((c) => c.length === 1)).toBe(true);
});
