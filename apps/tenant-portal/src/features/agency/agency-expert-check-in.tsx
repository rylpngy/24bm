import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { evaluationRequest, type AgencyDetail, type EvaluationWorkspace } from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';
import { useAuthStore } from '../../lib/auth-store';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

type ExpertState = {
  version: number;
  drawNote?: string;
  proofVersionId?: string;
  proofHash?: string;
  started: boolean;
  experts: { userId: string; name: string; status: string; recordedAt?: string }[];
};
const statuses = { pending: '待签到', present: '已到场', absent: '缺席', recused: '回避' };
const input = 'w-full rounded border border-slate-200 bg-white p-2 text-sm';
const button = 'rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40';
type Mode = 'expert-draw' | 'expert-attendance';

export function AgencyExpertCheckIn({ detail, mode }: { detail: AgencyDetail; mode: Mode }) {
  const actor = useAuthStore(store => store.session?.userId);
  const { can } = useBuyerPermissions();
  const [selected, setSelected] = useState('');
  const authorized = can('buyer:agency:evaluation:organize') && can('buyer:agency:evaluation:read')
    && can('buyer:agency:evaluation:confidential') && can('buyer:agency:document:read')
    && can('buyer:agency:file:read');
  const base = `/packages/${detail.record.id}/rounds`;
  const query = useQuery({
    queryKey: ['agency-evaluation', detail.record.id],
    queryFn: () => evaluationRequest<EvaluationWorkspace>(base),
    enabled: authorized,
  });
  if (!authorized) return <FeedbackNotice tone="info" message="轮次抽取和签到由有权的组织人员办理。" />;
  if (query.isPending) return <p role="status">正在加载评标轮次…</p>;
  if (query.isError) return <FeedbackNotice tone="error" message="评标轮次读取失败，请重试。" />;
  const rounds = query.data.rounds.filter(round => round.round.status === 'frozen' &&
    round.config.members.some(member => member.userId === actor && member.roles.some(role => role === 'organizer' || role === 'leader')));
  const current = rounds.find(round => round.round.id === selected) ?? rounds[0];
  if (!current) return <FeedbackNotice tone="info" message="请先在「专家线上评分」中配置并冻结评标轮次和专家名单。" />;
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-4" aria-label={mode === 'expert-draw' ? '轮次专家抽取' : '轮次专家签到'}>
      <label className="block text-sm font-semibold">评标轮次
        <select className={input} value={current.round.id} onChange={event => setSelected(event.target.value)}>
          {rounds.map(round => <option value={round.round.id} key={round.round.id}>{round.config.title}</option>)}
        </select>
      </label>
      <RoundRecord key={current.round.id} path={base + '/' + current.round.id} detail={detail} mode={mode}
        editable={detail.canEdit && can('buyer:agency:preparation:manage') && !current.frozenBasisStale}/>
    </section>
  );
}

function RoundRecord({ detail, path, mode, editable }: { detail: AgencyDetail; path: string; mode: Mode; editable: boolean }) {
  const [proof, setProof] = useState('');
  const [note, setNote] = useState('');
  const [user, setUser] = useState('');
  const [status, setStatus] = useState<keyof typeof statuses>('present');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; message: string }>();
  const state = useQuery({
    queryKey: ['agency-expert-check-in', path], queryFn: () => evaluationRequest<ExpertState>(path + '/expert-check-in'),
    refetchInterval: 5000,
  });
  if (state.isPending) return <p role="status">正在读取专家记录…</p>;
  if (state.isError) return <FeedbackNotice tone="error" message="专家记录读取失败，请刷新。" />;
  const data = state.data;
  const enabled = editable && !busy && !data.started;
  const files = detail.files.filter(file => !['response_material', 'final_quote_material'].includes(file.file.category))
    .flatMap(file => file.versions.filter(version => version.status === 'sealed')
      .map(version => ({ id: version.id, name: `${file.file.name} · V${version.ordinal}` })));
  const save = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await evaluationRequest(path + '/' + mode, 'PUT', { ...body, expectedVersion: data.version });
      await state.refetch();
      setNote('');
      setMessage({ tone: 'success', message: '记录已保存。' });
    } catch {
      await state.refetch();
      setMessage({ tone: 'error', message: '保存失败，请核对轮次状态、权限及所选凭证后重试。' });
    } finally {
      setBusy(false);
    }
  };

  return <div className="space-y-3 text-sm">
    <p>{data.started ? '评分任务已启动，专家抽取和签到记录已锁定。' : '名单来自已冻结轮次。缺席或回避时，请按程序更换专家并冻结新轮次。'}</p>
    {data.proofVersionId && <div className="rounded bg-slate-50 p-3">
      <p className="font-semibold">已确认外部抽取结果</p>
      <p className="mt-1 whitespace-pre-wrap">{data.drawNote}</p>
      <p className="mt-1 break-all text-xs text-slate-600">凭证：{files.find(file => file.id === data.proofVersionId)?.name ?? data.proofVersionId} · {data.proofHash}</p>
    </div>}
    <ul className="divide-y rounded border">
      {data.experts.map(expert => <li key={expert.userId} className="flex flex-wrap justify-between gap-2 p-2">
        <span>{expert.name}</span><span>{statuses[expert.status as keyof typeof statuses] ?? expert.status}
          {expert.recordedAt && ' · ' + new Date(expert.recordedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</span>
      </li>)}
    </ul>
    {message && <FeedbackNotice {...message}/>}
    {mode === 'expert-draw' ? <form className="space-y-2" onSubmit={event => {
      event.preventDefault();
      void save({ proofVersionId: proof, note });
    }}>
      <p className="text-xs text-slate-600">登记外部抽取结果并核对名单。重新登记抽取结果会重置本轮签到。</p>
      <fieldset disabled={!enabled} className="space-y-2">
        <label className="block">抽取凭证<select className={input} value={proof} onChange={event => setProof(event.target.value)}>
          <option value="">选择已封存凭证</option>{files.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}
        </select></label>
        <label className="block">外部抽取结果及名单核对说明<textarea className={input} maxLength={2000} value={note} onChange={event => setNote(event.target.value)}/></label>
        <button className={button} disabled={!proof || !note.trim() || !data.experts.length}>确认抽取结果</button>
      </fieldset>
    </form> : <form className="space-y-2" onSubmit={event => {
      event.preventDefault();
      void save({ userId: user, status, note });
    }}>
      {!data.proofVersionId && <p className="text-xs text-slate-600">请先在「专家抽取」中确认本轮抽取结果。</p>}
      <fieldset disabled={!enabled || !data.proofVersionId} className="grid gap-2 sm:grid-cols-2">
        <label>评分专家<select className={input} value={user} onChange={event => setUser(event.target.value)}>
          <option value="">请选择专家</option>{data.experts.map(expert => <option key={expert.userId} value={expert.userId}>{expert.name}</option>)}
        </select></label>
        <label>到场状态<select className={input} value={status} onChange={event => setStatus(event.target.value as keyof typeof statuses)}>
          <option value="present">已到场</option><option value="absent">缺席</option><option value="recused">回避</option>
        </select></label>
        <label className="sm:col-span-2">签到说明（缺席、回避必填）<textarea className={input} maxLength={1000} value={note} onChange={event => setNote(event.target.value)}/></label>
        <div><button className={button} disabled={!user || (status !== 'present' && !note.trim())}>保存签到</button></div>
      </fieldset>
    </form>}
  </div>;
}
