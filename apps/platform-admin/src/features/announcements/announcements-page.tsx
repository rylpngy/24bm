import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Megaphone, Plus, Undo2, Users } from 'lucide-react';
import {
  usePlatformAnnouncementList,
  usePlatformAnnouncementPublish,
  usePlatformAnnouncementWithdraw,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  FilterTabs,
  MetricCard,
  MetricGrid,
  Pagination,
  Panel,
  PrimaryActionButton,
  RichTextEditor,
  RichTextView,
  SearchInput,
  StatusPill,
  richTextToPlain,
} from '@24bid/ui';

const AUDIENCE_LABELS: Record<string, string> = { all: '全部', buyer: '采购方', supplier: '供应商' };

// 平台公告:发布/撤回面向全部/采购方/供应商的通知。
export function AnnouncementsPage({ canManage = false }: { canManage?: boolean }) {
  const queryClient = useQueryClient();
  const list = usePlatformAnnouncementList();
  const publish = usePlatformAnnouncementPublish();
  const withdraw = usePlatformAnnouncementWithdraw();
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;

  const items = list.data?.data ?? [];
  const activeCount = items.filter((a) => a.status === 'active').length;
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return items.filter((a) => {
      if (statusFilter === 'active' && a.status !== 'active') return false;
      if (statusFilter === 'withdrawn' && a.status === 'active') return false;
      if (kw && ![a.title, richTextToPlain(a.content ?? '')].filter(Boolean).join(' ').toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [items, statusFilter, keyword]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
      <MetricGrid>
        <MetricCard icon={Megaphone} label="公告总数" value={String(items.length)} hint="含已撤回" tone="blue" />
        <MetricCard icon={CheckCircle2} label="生效中" value={String(activeCount)} hint="租户与供应商可见" tone="emerald" />
        <MetricCard icon={Undo2} label="已撤回" value={String(items.length - activeCount)} hint="不再展示" tone="slate" />
        <MetricCard icon={Users} label="全员公告" value={String(items.filter((a) => a.audience === 'all').length)} hint="受众为全部" tone="violet" />
      </MetricGrid>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs
          items={[
            { id: 'all', label: '全部', count: items.length },
            { id: 'active', label: '已发布', count: activeCount },
            { id: 'withdrawn', label: '已撤回', count: items.length - activeCount },
          ]}
          value={statusFilter}
          onChange={(id) => { setStatusFilter(id); setPage(1); }}
        />
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按标题 / 正文搜索"
          onSearch={(k) => { setKeyword(k); setPage(1); }}
        />
        {canManage && <button type="button" onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800">
          <Plus size={14} /> {showForm ? '收起' : '发布公告'}
        </button>}
      </div>
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}

      {canManage && showForm && (
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
            <RichTextEditor value={content} onChange={setContent} placeholder="公告正文:支持小标题、加粗、列表、引用等富文本排版。" minHeight={140} />
          </div>
          <PrimaryActionButton onClick={submit} busy={publish.isPending} pendingLabel="发布中" disabled={!title || !richTextToPlain(content)}>
            发布公告
          </PrimaryActionButton>
        </div>
      )}

      {(publish.isError || withdraw.isError) && <FeedbackNotice tone="error" message="操作失败，请核对权限及公告状态后重试。" />}
      {list.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载公告…" />
      ) : list.isError ? <FeedbackNotice tone="error" message="公告加载失败或权限已变更，请重试。" /> : filtered.length === 0 ? (
        <FeedbackNotice tone="info" message={keyword || statusFilter !== 'all' ? '没有符合条件的公告。' : '暂无公告。点击发布公告创建。'} />
      ) : (
        <>
        <div className="space-y-3">
          {pageItems.map((a) => {
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
                <RichTextView html={a.content ?? ''} className="mt-2 text-xs leading-5" />
                {canManage && active && a.id && (
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
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
