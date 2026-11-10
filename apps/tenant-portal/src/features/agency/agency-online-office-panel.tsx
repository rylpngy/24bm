import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  executionRequest as api,
  type ExecutionDocument,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import { useAuthStore } from "../../lib/auth-store";
type Save = {
  id: string;
  ordinal: number;
  fileVersionId: string;
  fileHash: string;
  createdAt: string;
};
type Session = {
  id: string;
  state: string;
  version: number;
  sourceRevisionId: string;
  baseVersion: number;
  expiresAt: string;
  lastError: string;
  createdBy: string;
  saves: Save[];
  adoptedRevisionId: string | null;
};
type W = { configured: boolean; scriptUrl: string | null; sessions: Session[] };
type Open = {
  session: Session;
  scriptUrl: string;
  config: Record<string, unknown>;
};
type Editor = { destroyEditor: () => void };
type OfficeWindow = Window & {
  DocsAPI?: {
    DocEditor: new (id: string, config: Record<string, unknown>) => Editor;
  };
};
const names: Record<string, string> = {
  active: "编辑中／等待回调",
  ready: "已收到最终保存，待人工采纳",
  adopted: "已采纳为新候选稿",
  cancelled: "已结束，保存副本保留",
  expired: "已过期，保存副本保留",
};
export function AgencyOnlineOfficePanel({
  view,
  busy,
  run,
  dirty,
}: {
  view: ExecutionDocument;
  busy: boolean;
  run: (f: () => Promise<unknown>) => Promise<boolean>;
  dirty: boolean;
}) {
  const { can } = useBuyerPermissions(),
    actor = useAuthStore((s) => s.session?.userId),
    [expanded, setExpanded] = useState(false),
    [opened, setOpened] = useState<Open | null>(null),
    [status, setStatus] = useState(""),
    [reason, setReason] = useState(""),
    [ack, setAck] = useState(""),
    path = `/documents/${view.document.id}/office`,
    q = useQuery({
      queryKey: ["agency-online-office", view.document.id],
      queryFn: () => api<W>(path),
      enabled: expanded,
      refetchInterval: expanded ? 2500 : false,
    }),
    id = useRef("office-" + crypto.randomUUID()),
    editor = useRef<Editor | null>(null);
  const basis = JSON.stringify([q.data, view.document.version, reason, dirty]),
    act = (suffix: string, body: unknown) =>
      run(async () => {
        await api(path + suffix, "POST", body);
        await q.refetch();
        setAck("");
      }),
    close = () => {
      editor.current?.destroyEditor();
      editor.current = null;
      setOpened(null);
      setStatus(
        "编辑器已关闭，正在等待文档服务最终保存回调；此时尚不表示保存完成。",
      );
    };
  useEffect(() => {
    if (!opened) return;
    let disposed = false;
    const mount = () => {
      if (disposed) return;
      try {
        const w = window as OfficeWindow;
        if (!w.DocsAPI) throw Error("编辑服务脚本未就绪");
        editor.current = new w.DocsAPI.DocEditor(id.current, {
          ...opened.config,
          events: {
            onDocumentReady: () =>
              setStatus("编辑器已就绪。保存结果以服务器签名回调为准。"),
            onError: () =>
              setStatus("编辑服务报告错误，请保留未保存内容，检查连接后重试。"),
            onDocumentStateChange: (e: { data: boolean }) =>
              setStatus(
                e.data
                  ? "有未保存修改，等待服务器实际保存确认。"
                  : "编辑器本地无新增修改；服务器保存版本仍以回调列表为准。",
              ),
          },
        });
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "编辑器初始化失败");
      }
    };
    let script: HTMLScriptElement | undefined;
    if ((window as OfficeWindow).DocsAPI) mount();
    else {
      script = document.createElement("script");
      script.src = opened.scriptUrl;
      script.onload = mount;
      script.onerror = () =>
        setStatus(
          "无法连接已配置的Office服务，文档未保存。可保留内容后使用整份Word回退路径。",
        );
      document.head.appendChild(script);
    }
    return () => {
      disposed = true;
      editor.current?.destroyEditor();
      editor.current = null;
      script?.remove();
    };
  }, [opened]);
  if (!can("buyer:agency:document:read")) return null;
  return (
    <details
      className="my-3 rounded border p-3"
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary>Office 在线整稿编辑</summary>
      {expanded && (
        <div className="space-y-3 pt-3">
          {q.error && <p role="alert">{(q.error as Error).message}</p>}
          {q.data && !q.data.configured && (
            <p>
              在线文档服务尚未配置。可以继续下载当前稿、本地Word编辑并上传整份候选稿。
            </p>
          )}
          {status && <p role="status">{status}</p>}
          {q.data?.configured && can("buyer:agency:office:edit") && (
            <>
              <p className="text-sm">
                在线内容先保存为不可变副本，结束编辑并人工核对后才能采纳为新的整稿候选；原审批不会自动继承。结构化章节须另外复核。
              </p>
              <label className="block">
                编辑或采纳依据
                <textarea
                  className="w-full rounded border p-2"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setAck("");
                  }}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={ack === basis}
                  onChange={(e) => setAck(e.target.checked ? basis : "")}
                />
                已核对精确源版本、当前内容和本次办理范围
              </label>
              <button
                className="rounded border p-2 disabled:opacity-40"
                disabled={
                  busy ||
                  dirty ||
                  ack !== basis ||
                  !reason ||
                  !view.document.currentRevisionId ||
                  !!opened ||
                  view.document.status === "reviewing"
                }
                onClick={() =>
                  void run(async () => {
                    const r = await api<Open>(path, "POST", {
                      expectedVersion: view.document.version,
                      sourceRevisionId: view.document.currentRevisionId,
                      reviewed: true,
                      reason,
                      idempotencyKey: crypto.randomUUID(),
                    });
                    setOpened(r);
                    await q.refetch();
                    setAck("");
                  })
                }
              >
                打开当前整稿在线编辑
              </button>
              {opened && (
                <>
                  <button
                    className="rounded border p-2"
                    disabled={busy}
                    onClick={() => void act(`/${opened.session.id}/save`, {})}
                  >
                    请求服务器保存（等待回调）
                  </button>
                  <button className="rounded border p-2" onClick={close}>
                    结束在线编辑并等待最终保存
                  </button>
                </>
              )}
              {dirty && (
                <p>存在未保存的结构化修改，请先保存或处理后再打开整稿。</p>
              )}
            </>
          )}
          {opened && (
            <div id={id.current} className="h-[720px] min-h-96 w-full" />
          )}
          {q.data?.sessions.map((s) => (
            <div className="space-y-2 rounded border p-2" key={s.id}>
              <p>
                {names[s.state]} · 会话 V{s.version} · 源输入 V{s.baseVersion}
              </p>
              {s.lastError && <p role="alert">{s.lastError}</p>}
              {s.saves.length === 0 ? (
                <p>尚无服务器确认的保存副本。</p>
              ) : (
                s.saves.map((v) => (
                  <p key={v.id} className="break-all text-xs">
                    保存 V{v.ordinal} · {v.createdAt} · SHA256 {v.fileHash}
                  </p>
                ))
              )}
              {actor === s.createdBy && can("buyer:agency:office:edit") && (
                <>
                  {s.state === "active" && !opened && (
                    <button
                      className="rounded border p-2"
                      disabled={busy || dirty}
                      onClick={() =>
                        void run(async () => {
                          setOpened(await api<Open>(path + `/${s.id}/config`));
                        })
                      }
                    >
                      恢复本人在线编辑
                    </button>
                  )}
                  {s.state === "ready" && (
                    <button
                      className="rounded border p-2 disabled:opacity-40"
                      disabled={
                        busy ||
                        ack !== basis ||
                        !reason ||
                        !s.saves.length ||
                        !!opened ||
                        dirty
                      }
                      onClick={() =>
                        void act(`/${s.id}/adopt`, {
                          expectedVersion: s.version,
                          saveId: s.saves[0].id,
                          reviewed: true,
                          reason,
                          idempotencyKey: crypto.randomUUID(),
                        })
                      }
                    >
                      核对后采纳最新保存为审批候选
                    </button>
                  )}
                  {["active", "ready", "expired"].includes(s.state) &&
                    !opened && (
                      <button
                        className="rounded border p-2 disabled:opacity-40"
                        disabled={busy || ack !== basis || !reason}
                        onClick={() =>
                          void act(`/${s.id}/cancel`, {
                            expectedVersion: s.version,
                            reviewed: true,
                            reason,
                            idempotencyKey: crypto.randomUUID(),
                          })
                        }
                      >
                        结束本会话并保留副本（不采纳）
                      </button>
                    )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
