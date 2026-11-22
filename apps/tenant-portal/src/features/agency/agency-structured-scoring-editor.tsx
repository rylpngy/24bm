import type { EvaluationCriterion } from '@24bid/api-client';

export type ScoringMethod = { criteria: EvaluationCriterion[]; tieRule: string };
const input = 'w-full rounded border border-slate-200 px-2 py-1.5 text-sm';

export function readScoringMethod(raw?: string): ScoringMethod {
  return raw ? JSON.parse(raw) : { criteria: [], tieRule: '' };
}

export function StructuredScoringEditor({ value, disabled, onChange }: {
  value: ScoringMethod;
  disabled: boolean;
  onChange: (value: ScoringMethod) => void;
}) {
  const update = (index: number, patch: Partial<EvaluationCriterion>) =>
    onChange({ ...value, criteria: value.criteria.map((row, i) => i === index ? { ...row, ...patch } : row) });
  const add = () => {
    let number = value.criteria.length + 1;
    while (value.criteria.some(row => row.key === 'S' + number)) number++;
    onChange({ ...value, criteria: [...value.criteria, {
      key: 'S' + number, title: '', stage: 'technical', applicableTo: '', resultType: 'score',
      minimum: '0', maximum: '10', weight: value.criteria.length ? '0' : '100',
      formula: 'weighted_normalized', evidenceRequired: true, scale: 2, rounding: 'HALF_UP',
    }] });
  };

  return (
    <fieldset disabled={disabled} className="space-y-3 rounded border border-slate-200 p-4">
      <legend className="px-2 text-sm font-semibold">结构化评分办法</legend>
      <p className="text-sm text-slate-600">系统合成的评审办法章节和专家评分表共用此处内容。分值按原始分 ÷ 满分 × 权重折算，权重合计须为 100。</p>
      {value.criteria.map((rule, i) => (
        <div key={i} className="space-y-2 rounded border border-slate-200 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">评分项编号<input className={input} value={rule.key} onChange={e => update(i, { key: e.target.value })} /></label>
            <label className="text-xs">评分项名称<input className={input} value={rule.title} onChange={e => update(i, { title: e.target.value })} /></label>
            <label className="text-xs">评分类别<select className={input} value={rule.stage} onChange={e => {
              const stage = e.target.value;
              const check = stage === 'qualification' || stage === 'conformity';
              update(i, { stage, resultType: check ? 'pass_fail' : 'score', formula: check ? 'none' : 'weighted_normalized',
                maximum: check ? '0' : rule.resultType === 'pass_fail' ? '10' : rule.maximum,
                weight: check ? '0' : rule.weight });
            }}><option value="qualification">资格审查</option><option value="conformity">符合性审查</option><option value="technical">技术</option><option value="commercial">商务</option></select></label>
            {rule.resultType === "score" && <>
            <label className="text-xs">满分<input className={input} type="number" min="0" step="any" value={rule.maximum} onChange={e => update(i, { maximum: e.target.value })} /></label>
            <label className="text-xs">权重<input className={input} type="number" min="0" max="100" step="any" value={rule.weight} onChange={e => update(i, { weight: e.target.value })} /></label>
            <label className="text-xs">保留小数位<input className={input} type="number" min="0" max="6" value={rule.scale} onChange={e => update(i, { scale: Number(e.target.value) })} /></label>
            </>}
          </div>
          <label className="block text-xs">评分标准及档次<textarea className={input} rows={3} value={rule.applicableTo} onChange={e => update(i, { applicableTo: e.target.value })} /></label>
          <div className="flex flex-wrap items-center gap-3">
            {rule.resultType === "score" && <label className="text-xs">舍入方式 <select className="rounded border p-1" value={rule.rounding} onChange={e => update(i, { rounding: e.target.value })}><option value="HALF_UP">四舍五入</option><option value="HALF_EVEN">五成双</option><option value="DOWN">向下截断</option></select></label>}
            <label className="text-xs"><input type="checkbox" checked={rule.evidenceRequired} onChange={e => update(i, { evidenceRequired: e.target.checked })} /> 评分依据必填</label>
            <button type="button" className="text-xs text-rose-700" onClick={() => onChange({ ...value, criteria: value.criteria.filter((_, j) => i !== j) })}>移除此评分项</button>
          </div>
        </div>
      ))}
      {value.criteria.length > 0 && <label className="block text-xs">同分处理规则<textarea className={input} rows={2} value={value.tieRule} onChange={e => onChange({ ...value, tieRule: e.target.value })} /></label>}
      <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={add} disabled={value.criteria.length >= 100}>新增评分项</button>
    </fieldset>
  );
}
