import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Save } from 'lucide-react';
import { FeedbackNotice } from '@24bid/ui';
import {
  numberingRulesKey, previewNumberingRule, saveNumberingRule, useNumberingRules,
  type NumberingPreview, type NumberingRule, type NumberingRuleDraft,
} from '@24bid/api-client/numbering';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

function errorMessage(error: unknown, fallback: string) {
  const value = error as { response?: { data?: { message?: string; error?: { message?: string } } }; message?: string };
  return value?.response?.data?.message || value?.response?.data?.error?.message || value?.message || fallback;
}

function RuleEditor({ rule }: { rule: NumberingRule }) {
  const queryClient = useQueryClient();
  const { businessType } = rule;
  const label = businessType === 'demand' ? '需求' : '招标';
  const [draft, setDraft] = useState<NumberingRuleDraft>({ prefix: rule.prefix, dateFormat: rule.dateFormat, width: rule.width, enabled: rule.enabled });
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [preview, setPreview] = useState<NumberingPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const revision = useRef(0);
  const change = (patch: Partial<NumberingRuleDraft>) => {
    revision.current++;
    setDraft(current => ({ ...current, ...patch }));
    setPreview(null);
    setFeedback(null);
  };
  const valid = /^[A-Za-z0-9_-]{0,20}$/.test(draft.prefix) && (!draft.enabled || !!draft.prefix)
    && Number.isInteger(draft.width) && draft.width >= 1 && draft.width <= 9;

  const runPreview = async () => {
    if (!valid) return;
    const requestedRevision = revision.current;
    setPreviewing(true);
    setPreview(null);
    setFeedback(null);
    try {
      const response = await previewNumberingRule(businessType, draft);
      if (!response.data) throw new Error('编号预览响应为空');
      if (requestedRevision === revision.current) setPreview(response.data);
    } catch (error) {
      if (requestedRevision === revision.current) setFeedback({ tone: 'error', message: errorMessage(error, '编号预览失败') });
    } finally { setPreviewing(false); }
  };
  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setFeedback(null);
    try {
      await saveNumberingRule(businessType, draft);
      setFeedback({ tone: 'success', message: `${label}规则已保存` });
      void queryClient.invalidateQueries({ queryKey: numberingRulesKey });
    } catch (error) {
      setFeedback({ tone: 'error', message: errorMessage(error, '编号规则保存失败') });
    } finally { setSaving(false); }
  };
  const inputClass = 'h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-50';
  return <section className="min-w-0 space-y-4 border-b border-slate-200 py-5 last:border-b-0" aria-label={`${label}编号规则`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-bold text-slate-900">{label}编号</h2>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={draft.enabled} disabled={saving} onChange={event => change({ enabled: event.target.checked })} />
        启用{label}自定义规则
      </label>
    </div>
    <div className="grid min-w-0 gap-4 sm:grid-cols-3">
      <label className="min-w-0 space-y-1.5 text-xs font-semibold text-slate-600">
        <span>{label}前缀</span>
        <input aria-label={`${label}前缀`} className={inputClass} value={draft.prefix} maxLength={20} disabled={saving} onChange={event => change({ prefix: event.target.value })} />
      </label>
      <label className="min-w-0 space-y-1.5 text-xs font-semibold text-slate-600">
        <span>{label}日期格式</span>
        <select aria-label={`${label}日期格式`} className={inputClass} value={draft.dateFormat} disabled={saving} onChange={event => change({ dateFormat: event.target.value as NumberingRuleDraft['dateFormat'] })}>
          <option value="none">无日期</option><option value="yyyy">年（yyyy）</option>
          <option value="yyyyMM">年月（yyyyMM）</option><option value="yyyyMMdd">年月日（yyyyMMdd）</option>
        </select>
      </label>
      <label className="min-w-0 space-y-1.5 text-xs font-semibold text-slate-600">
        <span>{label}流水位数</span>
        <input aria-label={`${label}流水位数`} className={inputClass} type="number" min={1} max={9} step={1} value={Number.isNaN(draft.width) ? '' : draft.width} disabled={saving} onChange={event => change({ width: event.target.valueAsNumber })} />
      </label>
    </div>
    {!valid && <FeedbackNotice tone="error" message="前缀限20位字母、数字、短横线或下划线，启用时不能为空；流水位数须为1至9的整数。" />}
    {!draft.enabled && <p className="text-xs text-slate-500">默认格式：{businessType === 'demand' ? '部门缩写 + 年月日 + 至少3位流水' : 'ZB + 年月日 + 至少3位流水'}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-label={`预览${label}编号`} disabled={!valid || previewing || saving} onClick={() => void runPreview()} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 px-3 text-xs font-bold text-slate-700 disabled:opacity-50">
        <Eye size={14} />{previewing ? '预览中' : '预览'}
      </button>
      <button type="button" aria-label={`保存${label}规则`} disabled={!valid || saving || previewing} onClick={() => void save()} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md bg-blue-600 px-3 text-xs font-bold text-white disabled:opacity-50">
        <Save size={14} />{saving ? '保存中' : '保存'}
      </button>
    </div>
    {preview && <div className="space-y-1 text-sm"><output className="break-all font-mono font-semibold text-slate-900">{preview.example}</output><p className="text-xs text-slate-500">{preview.notice}</p></div>}
    {feedback && <FeedbackNotice tone={feedback.tone} message={feedback.message} />}
  </section>;
}

export function NumberingRulesPage() {
  const { can } = useBuyerPermissions();
  const canManage = can('buyer:role:manage');
  const query = useNumberingRules(canManage);
  if (!canManage) return <FeedbackNotice tone="error" message="无权管理编号规则，需要企业管理权限。" />;
  if (query.isError) return <FeedbackNotice tone="error" message={errorMessage(query.error, '编号规则加载失败')} />;
  if (query.isPending) return <p className="text-sm text-slate-500">正在加载编号规则...</p>;
  if (!query.data?.data) return <FeedbackNotice tone="error" message="编号规则响应为空" />;
  return <div className="min-w-0 space-y-4">
    <header className="space-y-2 border-b border-slate-200 pb-4">
      <h1 className="text-base font-bold text-slate-950">自动编号规则</h1>
      <p className="text-xs leading-6 text-slate-500">仅影响新建需求及招标编号；历史编号和关联不变。合同人工编号、RFQ及订单编号不在此配置范围。</p>
    </header>
    <div>{query.data.data.map(rule => <RuleEditor key={rule.businessType} rule={rule} />)}</div>
  </div>;
}
