import { projectMoney as money } from './project-dialog';
import { projectReopenArchive } from '@24bid/api-client';
import { Download } from 'lucide-react';
import { useState } from 'react';

export function ProjectReopenEvidence({ snapshot }: { snapshot: string }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  let b: {
    project?: { status?: string };
    packageId?: string;
    packages?: { id: string; title: string }[];
    funding?: { fundId: string; name: string; restoreAmount: number }[];
    period?: string;
  };
  try {
    b = JSON.parse(snapshot).reopen;
    if (!b) return null;
  } catch {
    return null;
  }
  return (
    <section
      aria-label="重开依据"
      className="space-y-3 border-t border-slate-200 pt-3 text-sm"
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">原关闭状态</dt>
          <dd>
            {b.project?.status === 'terminated'
              ? '已终止'
              : b.project?.status === 'closed'
                ? '已结项'
                : '项目已批准'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">责任年度（不改写）</dt>
          <dd>{b.period}</dd>
        </div>
        <div>
          <dt className="text-slate-500">本次重开分包</dt>
          <dd>
            {b.packages?.find((p) => p.id === b.packageId)?.title ||
              '仅恢复项目，已结项分包保持关闭'}
          </dd>
        </div>
      </dl>
      {!!b.funding?.length && (
        <ul className="space-y-2">
          {b.funding.map((f) => (
            <li key={f.fundId} className="flex flex-wrap justify-between gap-2">
              <span>{f.name}</span>
              <strong>恢复专项责任 {money(f.restoreAmount)}</strong>
            </li>
          ))}
        </ul>
      )}
      {!!JSON.parse(snapshot).closureArchive && (
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              const s = JSON.parse(snapshot),
                blob = await projectReopenArchive(
                  s.projectId,
                  s.reopenRequestId,
                ),
                url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'project-closure.zip';
              a.click();
              URL.revokeObjectURL(url);
            } catch {
              setError('关闭档案下载失败，请检查权限或重试。');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={14} />
          下载原关闭档案
        </button>
      )}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
