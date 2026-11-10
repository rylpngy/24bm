import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { it, expect, vi, afterEach, beforeEach } from "vitest";
import type { AgencyDetail, EvaluationView } from "@24bid/api-client";
import {
  AgencyIncidentPanel,
  type IncidentWorkspace,
} from "./agency-incident-panel";
const m = vi.hoisted(() => ({ api: vi.fn(), session: { userId: "org" } }));
vi.mock("@24bid/api-client", () => ({ evaluationRequest: m.api }));
vi.mock("../../lib/auth-store", () => ({
  useAuthStore: (select: (s: unknown) => unknown) =>
    select({ session: m.session }),
}));
vi.mock("../../lib/use-buyer-permissions", () => ({
  useBuyerPermissions: () => ({ can: () => true }),
}));
afterEach(cleanup);
beforeEach(() => {
  m.api.mockReset();
  m.session = { userId: "org" };
});
const detail = {
    record: { id: "p" },
    members: [],
    files: [
      {
        file: { name: "脱敏凭证", visibility: "project" },
        versions: [{ id: "proof", status: "sealed", ordinal: 1 }],
      },
    ],
  } as unknown as AgencyDetail,
  round = {
    round: { id: "r" },
    config: {
      members: [
        { userId: "org", roles: ["organizer"] },
        { userId: "reviewer", roles: ["review_member"] },
      ],
    },
    roster: [{ userId: "org", name: "组织人员" }],
  } as unknown as EvaluationView;
const workspace = () =>
  ({
    control: { state: "paused", version: 2 },
    casesFingerprint: "fp1",
    incidents: [],
    events: [],
    resumeBlockers: [],
  }) as IncidentWorkspace;
function mount(w: IncidentWorkspace) {
  m.api.mockImplementation(async (path: string) =>
    path.endsWith("/control")
      ? {
          state: w.control.state,
          version: w.control.version,
          openCount: w.incidents.length,
          blockers: ["本轮评审已暂停"],
        }
      : w,
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AgencyIncidentPanel
        detail={detail}
        round={round}
        busy={false}
        run={async (fn) => {
          await fn();
          return true;
        }}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("评审异常与暂停恢复"));
  return client;
}
async function reviewResume() {
  await screen.findByLabelText("轮次控制操作");
  fireEvent.change(screen.getByLabelText("轮次控制脱敏凭证"), {
    target: { value: "proof" },
  });
  fireEvent.change(screen.getByLabelText("轮次控制决定及授权依据"), {
    target: { value: "人工核对全部恢复条件及授权依据" },
  });
  fireEvent.click(screen.getByLabelText("已核对本轮状态、全部异常及控制决定"));
}
it("a frozen reviewer sees only neutral control status and never fetches incident details", async () => {
  m.session = { userId: "reviewer" };
  mount(workspace());
  await screen.findByText("未处理异常 0 项");
  expect(
    m.api.mock.calls.every(([path]) => !String(path).endsWith("/incidents")),
  ).toBe(true);
  expect(screen.queryByText("登记评审异常")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("轮次控制操作")).not.toBeInTheDocument();
});
it("an unresolved incident prevents resume even after manual review is checked", async () => {
  const w = workspace();
  w.resumeBlockers = ["仍有未处理异常"];
  mount(w);
  await reviewResume();
  expect(screen.getByText("执行已复核的轮次控制")).toBeDisabled();
  expect(screen.getByText("恢复阻断：仍有未处理异常")).toBeInTheDocument();
});
it("changed incident/control versions invalidate old confirmation and preserve written reasons", async () => {
  const w = workspace(),
    client = mount(w);
  await reviewResume();
  expect(screen.getByText("执行已复核的轮次控制")).not.toBeDisabled();
  client.setQueryData(["agency-incidents", "r"], {
    ...w,
    control: { state: "paused", version: 3 },
    casesFingerprint: "fp2",
  });
  await waitFor(() =>
    expect(screen.getByText("执行已复核的轮次控制")).toBeDisabled(),
  );
  expect(screen.getByLabelText("轮次控制决定及授权依据")).toHaveValue(
    "人工核对全部恢复条件及授权依据",
  );
});
it("a terminated round remains read-only and does not offer new incident registration", async () => {
  const w = workspace();
  w.control.state = "terminated";
  mount(w);
  await screen.findByLabelText("轮次控制操作");
  expect(screen.getByLabelText("轮次控制操作")).toBeDisabled();
  expect(screen.getByText("执行已复核的轮次控制")).toBeDisabled();
  expect(screen.queryByText("登记评审异常")).not.toBeInTheDocument();
  expect(screen.getByText(/异常处理与控制历史/)).toBeInTheDocument();
});
