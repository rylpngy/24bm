import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { it, expect, vi } from "vitest";
import type { AgencyReminders, ExecutionMilestone } from "@24bid/api-client";
import { AgencyReminderPanel } from "./agency-reminder-panel";
const mocks = vi.hoisted(() => ({ request: vi.fn(), options: vi.fn() }));
vi.mock("@24bid/api-client", () => ({
  executionRequest: mocks.request,
  agencyOptions: mocks.options,
}));
it("prevents editing before the selected policy loads and retains other tiers when switching nodes", async () => {
  let resolve!: (v: AgencyReminders) => void;
  mocks.request.mockReturnValue(
    new Promise<AgencyReminders>((r) => (resolve = r)),
  );
  mocks.options.mockResolvedValue({ users: [] });
  const nodes = [
    { id: "a", title: "节点甲" },
    { id: "b", title: "节点乙" },
  ] as ExecutionMilestone[];
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AgencyReminderPanel
        pkg="p"
        nodes={nodes}
        editable
        busy={false}
        run={async (f) => {
          await f();
          return true;
        }}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("提醒策略与站内送达记录"));
  expect(screen.getByLabelText("项目提醒临近1小时")).toBeDisabled();
  resolve({
    policies: [
      {
        milestoneId: "a",
        version: 0,
        reason: "",
        settingsJson: JSON.stringify({
          enabled: true,
          leadHours: [24],
          overdueHours: [0],
          escalationAfterHours: 24,
        }),
      },
      {
        milestoneId: "b",
        version: 2,
        reason: "",
        settingsJson: JSON.stringify({
          enabled: true,
          leadHours: [4, 24, 72],
          overdueHours: [0, 24],
          escalationAfterHours: 24,
        }),
      },
    ],
    deliveries: [],
    smsEnabled: false,
  });
  await waitFor(() =>
    expect(screen.getByLabelText("项目提醒临近1小时")).toBeEnabled(),
  );
  fireEvent.change(screen.getByLabelText("提醒对应节点"), {
    target: { value: "b" },
  });
  await waitFor(() =>
    expect(screen.getByLabelText("项目提醒临近3小时")).toHaveValue(72),
  );
  fireEvent.change(screen.getByLabelText("项目提醒临近1小时"), {
    target: { value: "3" },
  });
  expect(screen.getByLabelText("项目提醒临近2小时")).toHaveValue(24);
  expect(screen.getByLabelText("项目提醒临近3小时")).toHaveValue(72);
  expect(screen.getByLabelText("提醒对应节点")).toBeDisabled();
});
