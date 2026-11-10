import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, it, expect, vi } from "vitest";
import type {
  AgencyDetail,
  PreparationFormsWorkspace,
  PreparationFormView,
} from "@24bid/api-client";
import { AgencyPreparationFormsPanel } from "./agency-preparation-forms-panel";
const mocks = vi.hoisted(() => ({ request: vi.fn(), download: vi.fn() }));
vi.mock("@24bid/api-client", () => ({
  executionRequest: mocks.request,
  agencyFileDownload: mocks.download,
}));
const person = {
  id: "person",
  name: "张某",
  organization: "合成单位",
  role: "organizer",
  status: "active",
  version: 1,
  reason: "登记",
};
const detail = {
  record: { id: "p" },
  files: [
    {
      file: {
        id: "s",
        name: "受限签署件",
        category: "preparation_signed",
        visibility: "restricted",
      },
      versions: [{ id: "proof", ordinal: 1, status: "sealed" }],
    },
    {
      file: {
        id: "o",
        name: "普通文档",
        category: "other",
        visibility: "project",
      },
      versions: [{ id: "ordinary", ordinal: 1, status: "sealed" }],
    },
  ],
} as AgencyDetail;
let ws: PreparationFormsWorkspace;
const formView = (): PreparationFormView => ({
  form: {
    id: "form",
    groupId: "group",
    ordinal: 1,
    kind: "attendance",
    code: "PF-TEST",
    title: "已有签到表",
    bodyText: "合成正文",
    fileVersionId: "form-fv",
    fileHash: "abc",
    status: "generated",
    version: 1,
    createdAt: "2026-11-08T00:00:00Z",
  },
  people: [person],
  stale: false,
  currentReturnedPeople: [],
});
beforeEach(() => {
  vi.resetAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  ws = {
    people: [person],
    forms: [],
    returns: [],
    packageVersion: 2,
    preparationVersion: 0,
  };
  mocks.request.mockImplementation(async (_path: string, method = "GET") => {
    if (method === "GET") return ws;
    const f = formView();
    ws = { ...ws, forms: [f] };
    return f;
  });
});
function mount(editable = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AgencyPreparationFormsPanel
        detail={detail}
        editable={editable}
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
it("read-only staff can view history without seeing roster mutation or generation controls", async () => {
  mount(false);
  await screen.findByText(/准备人员名单/);
  expect(screen.queryByText("生成打印表单")).toBeNull();
  expect(screen.queryByRole("button", { name: "新增准备人员" })).toBeNull();
});
it("keeps local body text and blocks generation after the selected person version changes", async () => {
  const client = mount();
  await screen.findByText(/准备人员名单/);
  fireEvent.click(screen.getByText("生成打印表单"));
  fireEvent.click(screen.getByLabelText("打印人员 张某"));
  fireEvent.change(screen.getByLabelText("打印表单类型"), {
    target: { value: "confidentiality" },
  });
  fireEvent.change(screen.getByLabelText("经人工复核的表单正文"), {
    target: { value: "仅用于技术测试的适用正文" },
  });
  fireEvent.click(
    screen.getByLabelText("已核对表单内容、人员和适用性，确认生成未签署打印稿"),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "生成未签署打印稿" }),
    ).toBeEnabled(),
  );
  ws = { ...ws, people: [{ ...person, version: 2 }] };
  client.setQueryData(["agency-preparation-forms", "p"], ws);
  await screen.findByText(
    "项目、准备信息或所选人员已变化，请核对后更新生成基线。",
  );
  expect(screen.getByLabelText("经人工复核的表单正文")).toHaveValue(
    "仅用于技术测试的适用正文",
  );
  expect(
    screen.getByRole("button", { name: "生成未签署打印稿" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "复核并更新生成基线" }));
  await waitFor(() =>
    expect(
      screen.getByLabelText(
        "已核对表单内容、人员和适用性，确认生成未签署打印稿",
      ),
    ).not.toBeChecked(),
  );
  fireEvent.click(
    screen.getByLabelText("已核对表单内容、人员和适用性，确认生成未签署打印稿"),
  );
  fireEvent.click(screen.getByRole("button", { name: "生成未签署打印稿" }));
  await waitFor(() =>
    expect(mocks.request.mock.calls.some(([, m]) => m === "POST")).toBe(true),
  );
  const submitted = mocks.request.mock.calls.find(([, m]) => m === "POST")![2];
  expect(submitted.peopleVersions).toEqual({ person: 2 });
  expect(submitted.body).toBe("仅用于技术测试的适用正文");
});
it("never preselects signers or a signature date and excludes generic files from proof choices", async () => {
  ws = { ...ws, forms: [formView()] };
  mount();
  await screen.findByText(/已有签到表/);
  fireEvent.click(screen.getByText(/已有签到表/));
  fireEvent.click(screen.getByRole("button", { name: "登记本表签署回传" }));
  expect(screen.getByLabelText("实际签署人员 张某")).not.toBeChecked();
  expect(screen.getByLabelText("实际签署日期")).toHaveValue("");
  expect(screen.queryByRole("option", { name: /普通文档/ })).toBeNull();
  expect(
    screen.getByRole("button", { name: "保存人工核对回传记录" }),
  ).toBeDisabled();
  expect(mocks.request.mock.calls.some(([p]) => p.endsWith("/returns"))).toBe(
    false,
  );
});
