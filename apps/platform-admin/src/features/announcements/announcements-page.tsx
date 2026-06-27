import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus } from 'lucide-react';
import {
  usePlatformAnnouncementList,
  usePlatformAnnouncementPublish,
  usePlatformAnnouncementWithdraw,
} from '@24bid/api-client';
import { CountTag, FeedbackNotice, Panel, PrimaryActionButton, StatusPill } from '@24bid/ui';

const AUDIENCE_LABELS: Record<string, string> = { all: '全部', buyer: '采购方', supplier: '供应商' };

// 平台公告:发布/撤回面向全部/采购方/供应商的通知。
export function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const list = usePlatformAnnouncementList();
  const publish = usePlatformAnnouncementPublish();
  const withdraw = usePlatformAnnouncementWithdraw();
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('all');

  const items = list.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/platform/announcements'),
    });

  const submit = () =>
    publish.mutate(
      { data: { title, content, audience } },
      {
        onSuccess: () => {
          setShowForm(false);
          setTitle('');
          setContent('');
          setAudience('all');
          setFeedback('公告已发布');
          refresh();
        },
      },
    );

  const onWithdraw = (id: string) =>
    withdraw.mutate({ announcementId: id }, { onSuccess: () => { setFeedback('公告已撤回'); refresh(); } });

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

  return (
    <Panel title="平台公告" icon={Megaphone} subtitle="发布 · 撤回 · 受众">
      <div className="mb-4 flex items-center justify-between gap-2">
        <CountTag>共 {items.length} 条</CountTag>
        <button type="button" onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700">
          <Plus size={14} /> {showForm ? '收起' : '发布公告'}
        </button>
      </div>
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}

      {showForm && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-800">发布平台公告</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-black text-slate-500">标题</label>
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：平台维护通知" />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">受众</label>
              <select className={inputCls} value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="all">全部</option>
                <option value="buyer">采购方</option>
                <option value="supplier">供应商</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs font-black text-slate-500">正文</label>
            <textarea className={`${inputCls} min-h-[80px] resize-y`} value={content}
              onChange={(e) => setContent(e.target.value)} placeholder="公告正文…" />
          </div>
          <PrimaryActionButton onClick={submit} busy={publish.isPending} pendingLabel="发布中" disabled={!title || !content}>
            发布公告
          </PrimaryActionButton>
        </div>
      )}

      {list.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载公告…" />
      ) : items.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无公告。点击发布公告创建。" />
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const active = a.status === 'active';
            const busy = withdraw.isPending && withdraw.variables?.announcementId === a.id;
            return (
              <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">{a.title}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      受众 {AUDIENCE_LABELS[a.audience ?? ''] ?? a.audience} · {a.createdAt?.slice(0, 10)}
                    </p>
                  </div>
                  <StatusPill label={active ? '已发布' : '已撤回'} />
                </div>
                <p className="mt-2 break-words text-xs font-bold leading-5 text-slate-700">{a.content}</p>
                {active && a.id && (
                  <div className="mt-3">
                    <button type="button" onClick={() => onWithdraw(a.id!)} disabled={busy}
                      className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                      {busy ? '撤回中' : '撤回公告'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
