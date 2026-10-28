import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, RefreshCw } from 'lucide-react';
import {
  projectReopenPreview,
  projectLifecycleSubmit,
  type ProcProject,
} from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import {
  ProjectDialog,
  projectButton as button,
  projectInput as input,
  projectMoney as money,
} from './project-dialog';

export function ProjectReopenPanel({
  project: p,
  onChanged,
}: {
  project: ProcProject;
  onChanged: () => Promise<void>;
}) {
  const { can } = useBuyerPermissions();
  const [open, setOpen] = useState(false),
    [lot, setLot] = useState(''),
    [reason, setReason] = useState(''),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const preview = useQuery({
    queryKey: ['project-reopen-preview', p.id, p.revision, lot],
    queryFn: () => projectReopenPreview(p.id, lot || undefined),
    enabled: open,
  });
  const closed = ['closed', 'terminated'].includes(p.status);
  if (
    !can('buyer:project:manage') ||
    !['approved', 'closed', 'terminated'].includes(p.status)
  )
    return null;
  return (
    <section
      aria-label="项目及分包受控重开"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4"
    >
      <h2 className="text-base font-bold">项目及分包受控重开</h2>
      <button
        className={button}
        onClick={() => {
          setOpen(true);
          setLot('');
          setReason('');
          setError('');
        }}
      >
        <RotateCcw size={14} />
        {closed ? '申请项目重开' : '申请分包重开'}
      </button>
      {open && !review && (
        <ProjectDialog
          title="申请受控重开"
          onClose={() => !busy && setOpen(false)}
        >
          <div className="space-y-4">
            <label className="block text-sm">
              重开范围
              <select
                aria-label="重开范围"
                className={input + ' mt-2'}
                value={lot}
                onChange={(e) => {
                  setLot(e.target.value);
                  setError('');
                }}
              >
                <option value="">
                  {closed ? '仅恢复项目办理权限' : '请选择已结项分包'}
                </option>
                {preview.data?.packages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </label>
            {preview.isPending && <p role="status">核验关闭记录与资金责任…</p>}
            {preview.isError && (
              <FeedbackNotice
                tone="error"
                message="重开依据加载失败，请刷新或核对数据权限。"
              />
            )}
            {preview.data && (
              <>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-500">原责任年度</dt>
                    <dd>{preview.data.period}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">拟恢复专项责任</dt>
                    <dd className="font-semibold">
                      {money(preview.data.restoreAmount)}
                    </dd>
                  </div>
                </dl>
                {!!preview.data.funds.length && (
                  <ul className="space-y-2 text-sm">
                    {preview.data.funds.map((f) => (
                      <li
                        key={f.fundId}
                        className="flex flex-wrap justify-between gap-2"
                      >
                        <span>{f.name}</span>
                        <strong>{money(f.restoreAmount)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                {preview.data.blockers.map((b) => (
                  <FeedbackNotice key={b} tone="error" message={b} />
                ))}
              </>
            )}
            <label className="block text-sm">
              重开原因 <span className="text-red-600">*</span>
              <textarea
                aria-label="重开原因"
                className={input + ' mt-2 min-h-24'}
                value={reason}
                maxLength={1000}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {error && <FeedbackNotice tone="error" message={error} />}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                className={button}
                title="刷新重开依据"
                aria-label="刷新重开依据"
                onClick={() => void preview.refetch()}
              >
                <RefreshCw size={14} />
              </button>
              <button className={button} onClick={() => setOpen(false)}>
                取消
              </button>
              <button
                className={button}
                disabled={
                  busy ||
                  !reason.trim() ||
                  !preview.data ||
                  preview.isFetching ||
                  preview.isError ||
                  !!preview.data.blockers.length ||
                  (!closed && !lot)
                }
                onClick={() => setReview(true)}
              >
                提交重开审批
              </button>
            </div>
          </div>
        </ProjectDialog>
      )}
      {open && review && (
        <WorkflowSubmitDialog
          businessType="project_reopen"
          title="项目及分包受控重开"
          busy={busy}
          submissionError={error ? new Error(error) : undefined}
          onClose={() => !busy && setReview(false)}
          onSubmit={async (formData) => {
            if (busy) return;
            setBusy(true);
            setError('');
            try {
              await projectLifecycleSubmit(p.id, {
                revision: p.revision,
                kind: 'reopen',
                reason: reason.trim(),
                formData,
                ...(lot
                  ? {
                      packageId: lot,
                      packageRevision: preview.data?.packages.find(
                        (l) => l.id === lot,
                      )?.revision,
                    }
                  : {}),
              });
              setReview(false);
              setOpen(false);
              await onChanged();
            } catch (e) {
              setError(
                (e as { response?: { data?: { message?: string } } }).response
                  ?.data?.message ||
                  (e instanceof Error ? e.message : '提交失败，请重试'),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="whitespace-pre-wrap break-words text-sm">{reason}</p>
        </WorkflowSubmitDialog>
      )}
    </section>
  );
}
