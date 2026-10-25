import { Plus, Trash2 } from 'lucide-react';
import {
  useMaterialList,
  projectOptions,
  type ProcProjectDraft,
  type ProcProjectLine,
} from '@24bid/api-client';
import { useQuery } from '@tanstack/react-query';
import { FeedbackNotice } from '@24bid/ui';
import { projectAmount } from './project-amount';
import {
  projectInput as input,
  projectButton as btn,
  projectMoney as money,
} from './project-dialog';

export function ProjectChangeEditor({
  draft,
  onChange,
  locked,
  busy,
}: {
  draft: ProcProjectDraft;
  onChange: (d: ProcProjectDraft) => void;
  locked: boolean;
  busy: boolean;
}) {
  const options = useQuery({
      queryKey: ['project-options'],
      queryFn: projectOptions,
    }),
    materials = useMaterialList();
  const patch = (value: Partial<ProcProjectDraft>) =>
    onChange({ ...draft, ...value });
  const line = (i: number, value: Partial<ProcProjectLine>) =>
    patch({
      lines: draft.lines.map((l, n) => (n === i ? { ...l, ...value } : l)),
    });
  const disabled =
    busy ||
    options.isLoading ||
    options.isError ||
    materials.isLoading ||
    materials.isError;
  return (
    <>
      {(options.isError || materials.isError) && (
        <FeedbackNotice
          tone="error"
          message="基础资料加载失败，不能保存变更。"
        />
      )}
      <fieldset disabled={disabled} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-slate-500">
            项目名称 *
            <input
              aria-label="变更项目名称"
              className={input}
              required
              maxLength={200}
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-xs text-slate-500">
            申报部门 *
            <select
              aria-label="变更申报部门"
              className={input}
              required
              disabled={locked}
              value={draft.departmentId}
              onChange={(e) =>
                patch({ departmentId: e.target.value, ownerId: '' })
              }
            >
              {options.data?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-500">
            项目负责人 *
            <select
              aria-label="变更项目负责人"
              className={input}
              required
              value={draft.ownerId}
              onChange={(e) => patch({ ownerId: e.target.value })}
            >
              <option value="">请选择</option>
              {options.data?.users
                .filter((u) => u.departmentId === draft.departmentId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-500">
            项目年度 *
            <input
              aria-label="变更项目年度"
              className={input}
              required
              disabled={locked}
              pattern="20[0-9]{2}"
              value={draft.period}
              onChange={(e) => patch({ period: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-xs text-slate-500">
            资金来源 *
            <input
              aria-label="变更资金来源"
              className={input}
              required
              maxLength={200}
              value={draft.fundingSource}
              onChange={(e) => patch({ fundingSource: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-xs text-slate-500">
            变更后金额
            <output className="flex h-10 items-center font-bold text-slate-950">
              {money(projectAmount(draft.lines))}
            </output>
          </label>
        </div>
        <label className="block space-y-1 text-xs text-slate-500">
          立项依据及用途 *
          <textarea
            aria-label="变更立项依据及用途"
            className={input}
            required
            maxLength={4000}
            value={draft.purpose}
            onChange={(e) => patch({ purpose: e.target.value })}
          />
        </label>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">变更后采购明细</h3>
          <button
            type="button"
            className={btn}
            onClick={() =>
              patch({
                lines: [
                  ...draft.lines,
                  { materialId: '', quantity: 1, unitPrice: 0, purpose: '' },
                ],
              })
            }
            disabled={draft.lines.length >= 100}
          >
            <Plus size={14} />
            添加物料
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {['物料 *', '数量 *', '预算单价 *', '金额', '用途', '操作'].map(
                  (h) => (
                    <th className="p-2" key={h}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((l, i) => (
                <tr key={i}>
                  <td className="min-w-44 p-2">
                    <select
                      aria-label={`变更物料${i + 1}`}
                      className={input}
                      required
                      value={l.materialId}
                      onChange={(e) => {
                        const m = materials.data?.data?.find(
                          (m) => m.id === e.target.value,
                        );
                        line(i, {
                          materialId: e.target.value,
                          unitPrice: m?.referencePrice || 0,
                        });
                      }}
                    >
                      <option value="">请选择</option>
                      {materials.data?.data?.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="w-28 p-2">
                    <input
                      aria-label={`变更数量${i + 1}`}
                      className={input}
                      required
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={l.quantity}
                      onChange={(e) =>
                        line(i, { quantity: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="w-32 p-2">
                    <input
                      aria-label={`变更单价${i + 1}`}
                      className={input}
                      required
                      type="number"
                      min="0"
                      step="0.0001"
                      value={l.unitPrice}
                      onChange={(e) =>
                        line(i, { unitPrice: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="whitespace-nowrap p-2">
                    {money(projectAmount([l]))}
                  </td>
                  <td className="p-2">
                    <input
                      aria-label={`变更用途${i + 1}`}
                      className={input}
                      maxLength={1000}
                      value={l.purpose}
                      onChange={(e) => line(i, { purpose: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      className={btn}
                      title="移除物料"
                      aria-label={`移除变更物料${i + 1}`}
                      onClick={() =>
                        patch({ lines: draft.lines.filter((_, n) => n !== i) })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>
    </>
  );
}

export function ProjectPlanSummary({
  plan,
  lines,
}: {
  plan: Partial<ProcProjectDraft> & { plannedAmount?: number };
  lines: ProcProjectLine[];
}) {
  const options = useQuery({queryKey:['project-options'], queryFn:projectOptions, enabled:!!plan.title});
  return (
    <div className="space-y-3">
      {plan.title && (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {[
            ['名称', plan.title],
          ['部门', options.data?.departments.find(d=>d.id===plan.departmentId)?.name || plan.departmentId],
          ['负责人', options.data?.users.find(u=>u.id===plan.ownerId)?.name || plan.ownerId],
            ['年度', plan.period],
            ['资金来源', plan.fundingSource],
            ['金额', money(plan.plannedAmount ?? projectAmount(lines))],
            ['依据及用途', plan.purpose],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-slate-400">{k}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">
                {v || '—'}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {['物料 / 规格', '数量 / 单位', '单价', '金额', '用途'].map(
                (h) => (
                  <th key={h} className="p-2">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id || i} className="border-b border-slate-100">
                <td className="p-2">
                  {l.name || l.materialId}
                  <p className="text-slate-400">{l.specification}</p>
                </td>
                <td className="whitespace-nowrap p-2">
                  {l.quantity} {l.unit}
                </td>
                <td className="whitespace-nowrap p-2">{money(l.unitPrice)}</td>
                <td className="whitespace-nowrap p-2">
                  {money(projectAmount([l]))}
                </td>
                <td className="p-2">{l.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
