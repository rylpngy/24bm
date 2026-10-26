import { useEffect, useState } from 'react';
import { Download, FileCheck, RefreshCw, Truck } from 'lucide-react';

interface Event {
  id: string;
  kind: string;
  quantity: number;
  referenceNo: string;
  note: string;
  fileName: string;
  sha256: string;
  actorId: string;
  actorRole: string;
  createdAt: string;
}
interface View {
  stage: string;
  actions: string[];
  events: Event[];
  financialStatus: string;
}
const names: Record<string, string> = {
  待寄回: '待寄回',
  return_dispatch: '买方登记寄回',
  return_receipt: '供应商核验签收',
  replacement_dispatch: '供应商换货补发',
  inspection_pass: '买方复验合格',
  inspection_fail: '买方复验不合格',
};
const field =
  'w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
const button =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border px-3 text-sm disabled:opacity-50';
export function PhysicalAfterSalesPanel({
  root,
  id,
  quantity,
  canManage,
  request,
  download,
}: {
  root: string;
  id: string;
  quantity: number;
  canManage: boolean;
  request: (path: string, body?: unknown) => Promise<unknown>;
  download: (path: string, filename: string) => Promise<void>;
}) {
  const path = `${root}/${encodeURIComponent(id)}/physical`;
  const [data, setData] = useState<View>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('');
  const [referenceNo, setReference] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File>();
  async function load() {
    try {
      setData((await request(path)) as View);
      setError('');
    } catch {
      setError('实物台账加载失败，请重试');
    }
  }
  useEffect(() => {
    let live = true;
    request(path)
      .then((value) => {
        if (live) setData(value as View);
      })
      .catch(() => {
        if (live) setError('实物台账加载失败，请重试');
      });
    return () => {
      live = false;
    };
  }, [path, request]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !referenceNo.trim() || !note.trim()) {
      setError('请填写交接/物流编号、处理说明并上传凭证原件');
      return;
    }
    if (!file.size || file.size > 2097152) {
      setError('凭证须为非空文件，最大2MB');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let raw = '';
      for (let start = 0; start < bytes.length; start += 8192)
        raw += String.fromCharCode(...bytes.subarray(start, start + 8192));
      const next = await request(path, {
        requestKey: crypto.randomUUID(),
        kind: kind || data?.actions[0],
        quantity,
        referenceNo: referenceNo.trim(),
        note: note.trim(),
        fileName: file.name,
        fileBase64: btoa(raw),
      });
      setData(next as View);
      setKind('');
      setReference('');
      setNote('');
      setFile(undefined);
    } catch (cause) {
      const response = (
        cause as {
          response?: {
            data?: { message?: string; error?: { message?: string } };
          };
        }
      ).response?.data;
      setError(
        response?.message ||
          response?.error?.message ||
          '交接登记失败，请核对当前阶段后重试',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="实物退换货台账"
      className="space-y-3 border-t border-slate-200 pt-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Truck size={16} />
          实物退换货
        </h3>
        <button
          className={button}
          title="刷新实物台账"
          aria-label="刷新实物台账"
          onClick={() => void load()}
        >
          <RefreshCw size={14} />
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {data && (
        <>
          <p className="text-sm">当前交接：{names[data.stage] ?? data.stage}</p>
          <p className="text-xs text-amber-800">{data.financialStatus}</p>
          <ol className="space-y-2">
            {data.events.map((e) => (
              <li
                key={e.id}
                className="border-l-2 border-blue-200 pl-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>
                    {names[e.kind]} · {e.quantity}
                  </strong>
                  <button
                    className={button}
                    onClick={() =>
                      void download(
                        `${path}/${encodeURIComponent(e.id)}/file`,
                        e.fileName,
                      ).catch(() => setError('凭证下载失败，请重试'))
                    }
                  >
                    <Download size={14} />
                    凭证
                  </button>
                </div>
                <p className="break-words">
                  {e.referenceNo} · {e.note}
                </p>
                <p className="break-all text-xs text-slate-500">
                  {e.createdAt} ·{' '}
                  {e.actorRole === 'buyer' ? '采购方' : '供应商'} {e.actorId}
                </p>
                <p className="break-all text-xs text-slate-500">
                  SHA256：{e.sha256}
                </p>
              </li>
            ))}
          </ol>
          {canManage && data.actions.length > 0 && (
            <form
              className="grid min-w-0 gap-3 sm:grid-cols-2"
              onSubmit={submit}
            >
              <label className="text-sm">
                交接操作
                <select
                  className={field}
                  value={kind || data.actions[0]}
                  onChange={(e) => setKind(e.target.value)}
                >
                  {data.actions.map((k) => (
                    <option key={k} value={k}>
                      {names[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                交接数量
                <input className={field} value={quantity} readOnly />
              </label>
              <label className="text-sm">
                物流 / 签收 / 复验编号
                <input
                  className={field}
                  required
                  maxLength={200}
                  value={referenceNo}
                  onChange={(e) => setReference(e.target.value)}
                />
              </label>
              <label className="min-w-0 text-sm">
                凭证原件（最大2MB）
                <input
                  className={`${field} text-xs`}
                  type="file"
                  required
                  key={data.events.length}
                  onChange={(e) => setFile(e.target.files?.[0])}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                交接及核验说明
                <textarea
                  className={field}
                  required
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <div>
                <button
                  className={`${button} border-blue-600 bg-blue-600 text-white`}
                  disabled={busy}
                >
                  <FileCheck size={14} />
                  {busy ? '提交中' : '登记交接'}
                </button>
              </div>
            </form>
          )}
          {canManage && !data.actions.length && (
            <p className="text-sm text-slate-500">
              当前岗位无待办交接，请按售后进度办理或等待对方操作。
            </p>
          )}
        </>
      )}
    </section>
  );
}
