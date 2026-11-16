import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type AgencyDetail, type EvaluationWorkspace, type AssessmentOverview, evaluationRequest as api } from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';
import { reviewedEvaluationLabels, type ReviewedEvaluationFile } from "./reviewed-evaluation-files";
import { workbenchHref } from "../workbench/workbench-model";
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

type Summary = {
  revisionId: string;
  fileHash: string;
  tieRule: string;
  submitted: number;
  expected: number;
  blockers: string[];
  fingerprint?: string;
  review?: { reviewedBy: string; reviewedAt: string; note: string; fileVersionId?: string; evaluationFileHash?: string; files?: ReviewedEvaluationFile[] };
  scores: {
    supplierName: string;
    average: number;
    experts: {
      userId: string;
      sheetHash: string;
      total: number;
      marks: { criterionKey: string; score: number; weightedScore: number; evidence: string; opinion: string }[];
    }[];
  }[];
};

export function PaperScoreReviewWorkspace({ detail, workspace, loading, error }: {
  detail: AgencyDetail;
  workspace?: EvaluationWorkspace;
  loading: boolean;
  error: boolean;
}) {
  const { can } = useBuyerPermissions();
  if (!can('buyer:agency:evaluation:total:read') || !can('buyer:agency:evaluation:organize'))
    return <FeedbackNotice tone="info" message="当前账号没有评标汇总核对权限。" />;
  if (loading) return <p role="status">正在读取评标任务…</p>;
  if (error) return <FeedbackNotice tone="error" message="评标任务读取失败。" />;
  const rounds = workspace?.rounds.filter(round => round.round.status === 'frozen' &&
    workspace.sources.some(source => source.revisionId === round.config.documentRevisionId && source.scoringCriteria?.length)) ?? [];
  if (!rounds.length) return <p className="text-sm text-slate-600">暂无引用结构化评分办法的冻结轮次。</p>;
  const files = detail.files.flatMap(file => file.versions.filter(version => version.status === 'sealed')
    .map(version => ({ id: version.id, name: `${file.file.name} · 第 ${version.ordinal} 版` })));
  return <section className="space-y-4" aria-label="评分汇总与核对">{rounds.map(round => (
    <ReviewRound key={round.round.id} pkg={detail.record.id} round={round} files={files} />
  ))}
    <a className="text-sm font-semibold text-blue-700" href={workbenchHref('project-archive', detail.record.id)}>打开项目归档 →</a>
  </section>;
}

type ReviewedFile = { id: string; name: string };

function ReviewRound({ pkg, round, files }: { pkg: string; round: EvaluationWorkspace['rounds'][number]; files: ReviewedFile[] }) {
  const query = useQuery({
    queryKey: ['paper-score-assessment', pkg, round.round.id],
    queryFn: () => api<AssessmentOverview>(`/packages/${pkg}/rounds/${round.round.id}/assessment`),
    refetchInterval: 5000,
  });
  return (
    <section className="space-y-3 rounded border p-4">
      <h4 className="font-semibold">{round.config.title}</h4>
      {query.isError ? <FeedbackNotice tone="error" message="无法读取此评标任务，请检查轮次授权。" />
        : query.isPending ? <p role="status">正在读取本轮任务…</p>
        : !query.data.sessions.length ? <p className="text-sm text-slate-600">本轮尚未启动评标任务。</p>
        : query.data.sessions.map(session => (
          <ReviewSession key={session.id} path={`/packages/${pkg}/sessions/${session.id}/paper-score-review`}
            files={files} names={Object.fromEntries(round.roster.map(member => [member.userId, member.name]))} />
        ))}
    </section>
  );
}

function ReviewSession({ path, names, files }: { path: string; names: Record<string, string>; files: ReviewedFile[] }) {
  const { can } = useBuyerPermissions();
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState('');
  const [fileVersionId, setFileVersionId] = useState('');
  const [signedVersionIds, setSignedVersionIds] = useState<string[]>([]);
  const [revising, setRevising] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const summary = useQuery({
    queryKey: ['paper-score-review', path], queryFn: () => api<Summary>(path), refetchInterval: 5000,
  });
  if (summary.isPending) return <p role="status">正在汇集专家提交进度…</p>;
  if (summary.isError) return <FeedbackNotice tone="error" message="未能读取评分汇总，请确认为本轮授权组织人员。" />;
  const data = summary.data;
  return (
    <div className="space-y-3 text-sm">
      <p>已提交专家：{data.submitted} / {data.expected}</p>
      <p className="break-all text-xs text-slate-600">定稿指纹：{data.fileHash}</p>
      {data.blockers.map(reason => <FeedbackNotice key={reason} tone="info" message={reason} />)}
      {data.scores.map(supplier => (
        <details className="rounded border p-3" key={supplier.supplierName}>
          <summary className="cursor-pointer font-semibold">{supplier.supplierName} · 专家平均分 {Number(supplier.average).toFixed(2)}</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr><th>专家</th><th>评分项</th><th>原始分</th><th>折算分</th><th>评分依据与意见</th></tr></thead>
              <tbody>{supplier.experts.flatMap(expert => expert.marks.map(mark => (
                <tr key={`${expert.userId}:${mark.criterionKey}`} className="border-t">
                  <td className="py-2 pr-2">{names[expert.userId] ?? expert.userId}</td><td>{mark.criterionKey}</td>
                  <td>{mark.score}</td><td>{mark.weightedScore}</td><td>{[mark.evidence, mark.opinion].filter(Boolean).join(' · ')}</td>
                </tr>
              )))}</tbody>
            </table>
          </div>
        </details>
      ))}
      {data.scores.length > 0 && <p>同分处理：{data.tieRule}</p>}
      {data.review && <FeedbackNotice tone="success" message={`已核对 · ${names[data.review.reviewedBy] ?? data.review.reviewedBy} · ${data.review.note}`} />}
      {data.review?.files && <ul aria-label="已核对的评标文件版本" className="divide-y rounded border">
        {data.review.files.map(file => <li key={file.versionId} className="space-y-1 p-2">
          <p className="font-semibold">{reviewedEvaluationLabels[file.kind]} · V{file.ordinal}</p>
          <p className="break-all text-xs text-slate-600">{files.find(item => item.id === file.versionId)?.name ?? file.versionId} · SHA-256 {file.sha256}</p>
        </li>)}
      </ul>}
      {data.review?.files && !revising && can('buyer:agency:evaluation:total:manage') &&
        <button type="button" className="rounded border px-3 py-2" onClick={() => setRevising(true)}>重新核对材料版本</button>}
      {(!data.review?.files || revising) && data.fingerprint && can('buyer:agency:evaluation:total:manage') && (
          <form className="space-y-2" onSubmit={async event => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              await api(path, 'POST', { fingerprint: data.fingerprint, filesChecked: checked, note, fileVersionId, signedVersionIds });
              await summary.refetch();
              setRevising(false);
            } catch {
              setError('未能确认核对，请刷新汇总后重试。');
            } finally {
              setBusy(false);
            }
          }}>
            <label className="block"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} /> 已核对专家评分、汇总、评标报告及签署材料</label>
            <label className="block">评标报告封存版本
              <select className="mt-1 block w-full rounded border p-2" value={fileVersionId} onChange={event => {
                const id = event.target.value;
                setFileVersionId(id);
                setSignedVersionIds(current => current.filter(version => version !== id));
              }}>
                <option value="">选择已封存版本</option>
                {files.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}
              </select>
            </label>
            <fieldset className="max-h-48 space-y-1 overflow-y-auto rounded border p-2">
              <legend className="px-1">签署材料封存版本</legend>
              {files.filter(file => file.id !== fileVersionId).map(file => <label key={file.id} className="block">
                <input type="checkbox" checked={signedVersionIds.includes(file.id)} onChange={event => {
                  const checked = event.target.checked;
                  setSignedVersionIds(current => checked ? [...current, file.id] : current.filter(id => id !== file.id));
                }}/> {file.name}
              </label>)}
            </fieldset>
            <label className="block">评标文件核对说明<textarea className="mt-1 block w-full rounded border p-2" value={note} maxLength={2000} onChange={event => setNote(event.target.value)} /></label>
            <button className="rounded border bg-white px-3 py-2 disabled:opacity-40" disabled={busy || !checked || !note.trim() || !fileVersionId || !signedVersionIds.length}>确认核对并生成归档材料</button>
            {error && <FeedbackNotice tone="error" message={error} />}
          </form>
        )}
    </div>
  );
}
