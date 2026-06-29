import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Mail,
  Network,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import {
  type DepartmentResponse,
  useBuyerUserList,
  useDepartmentCreate,
  useDepartmentDisable,
  useDepartmentList,
  useDepartmentUpdate,
} from '@24bid/api-client';
import { FeedbackNotice, SearchInput, StatusPill, cn } from '@24bid/ui';

interface TreeNode {
  dept: DepartmentResponse;
  children: TreeNode[];
  rollup: number;
}

function buildTree(list: DepartmentResponse[]): TreeNode[] {
  const byParent = new Map<string, DepartmentResponse[]>();
  for (const d of list) {
    const key = d.parentId ?? '__root__';
    byParent.set(key, [...(byParent.get(key) ?? []), d]);
  }
  const make = (d: DepartmentResponse): TreeNode => {
    const children = (byParent.get(d.id ?? '') ?? []).map(make);
    const rollup = (d.memberCount ?? 0) + children.reduce((s, c) => s + c.rollup, 0);
    return { dept: d, children, rollup };
  };
  return (byParent.get('__root__') ?? []).map(make);
}

// 组织架构:左侧部门树 + 右侧部门详情卡 + 成员表。
export function OrgStructurePage() {
  const queryClient = useQueryClient();
  const departments = useDepartmentList();
  const create = useDepartmentCreate();
  const update = useDepartmentUpdate();
  const disable = useDepartmentDisable();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [treeSearch, setTreeSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit' | 'add-child' | 'add-root'>('view');
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const list = departments.data?.data ?? [];
  const tree = useMemo(() => buildTree(list), [list]);

  // 首次加载后默认展开所有上级部门(整棵树可见)。
  const parentIds = useMemo(
    () => [...new Set(list.map((d) => d.parentId).filter(Boolean))] as string[],
    [list],
  );
  const [expandedInit, setExpandedInit] = useState(false);
  useEffect(() => {
    if (!expandedInit && parentIds.length > 0) {
      setExpanded(new Set(parentIds));
      setExpandedInit(true);
    }
  }, [parentIds, expandedInit]);
  const selected = list.find((d) => d.id === selectedId) ?? list.find((d) => !d.parentId) ?? list[0];

  const members = useBuyerUserList(
    { departmentId: selected?.id, keyword: memberSearch || undefined },
    { query: { enabled: !!selected?.id } },
  );
  const memberList = members.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/buyer\/(departments|users)/.test(q.queryKey[0] as string),
    });

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const startEdit = () => {
    if (!selected) return;
    setDraftName(selected.name ?? '');
    setDraftDesc(selected.description ?? '');
    setMode('edit');
  };
  const startAddChild = () => {
    setDraftName('');
    setDraftDesc('');
    setMode('add-child');
  };

  const submitEdit = () => {
    if (!selected?.id || !draftName.trim()) return;
    update.mutate(
      { departmentId: selected.id, data: { name: draftName.trim(), description: draftDesc, managerId: selected.managerId ?? undefined } },
      { onSuccess: () => { setFeedback(`部门「${draftName}」已更新`); setMode('view'); refresh(); } },
    );
  };
  const submitAddChild = () => {
    if (!draftName.trim()) return;
    create.mutate(
      { data: { name: draftName.trim(), parentId: mode === 'add-root' ? undefined : selected?.id } },
      {
        onSuccess: (res) => {
          setFeedback(`部门「${draftName}」已创建`);
          setMode('view');
          if (selected?.id) setExpanded((s) => new Set(s).add(selected.id!));
          if (res.data?.id) setSelectedId(res.data.id);
          refresh();
        },
      },
    );
  };
  const onDelete = () => {
    if (!selected?.id) return;
    disable.mutate(
      { departmentId: selected.id },
      {
        onSuccess: () => { setFeedback(`部门「${selected.name}」已删除`); setSelectedId(null); refresh(); },
        onError: () => setFeedback('删除失败:该部门仍被需求引用或存在下级。'),
      },
    );
  };

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const { dept, children, rollup } = node;
    const on = dept.id === (selected?.id ?? '');
    const isOpen = expanded.has(dept.id ?? '');
    const matches = !treeSearch || (dept.name ?? '').toLowerCase().includes(treeSearch.toLowerCase());
    const childNodes = children.map((c) => renderNode(c, depth + 1)).filter(Boolean);
    if (!matches && childNodes.length === 0) return null;
    return (
      <div key={dept.id}>
        <div
          className={cn(
            'flex items-center gap-1 rounded-lg pr-2 transition',
            on ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100',
          )}
          style={{ paddingLeft: `${depth * 14 + 4}px` }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => dept.id && toggleExpand(dept.id)}
              className={cn('p-1', on ? 'text-blue-100' : 'text-slate-400')}
            >
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-6" />
          )}
          <button
            type="button"
            onClick={() => { setSelectedId(dept.id ?? null); setMode('view'); }}
            className="flex flex-1 items-center justify-between gap-2 py-2 text-left"
          >
            <span className="truncate text-sm font-black">{dept.name}</span>
            <span
              className={cn(
                'shrink-0 rounded px-1.5 text-[11px] font-black',
                on ? 'bg-blue-500 text-blue-50' : 'bg-slate-100 text-slate-400',
              )}
            >
              {rollup}
            </span>
          </button>
        </div>
        {isOpen && childNodes.length > 0 && <div>{childNodes}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {feedback && <FeedbackNotice tone="success" message={feedback} />}
      <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
        {/* 左:部门树 */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="flex items-center gap-1.5 text-sm font-black text-slate-700">
              <Network size={15} className="text-blue-600" /> 组织架构
            </p>
            <button
              type="button"
              onClick={() => { setDraftName(''); setMode('add-root'); }}
              title="新增一级部门"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-blue-600"
            >
              <Plus size={16} />
            </button>
          </div>
          <SearchInput className="mb-2" placeholder="搜索部门…" onSearch={setTreeSearch} />
          {mode === 'add-root' && (
            <InlineDeptForm
              title="新增一级部门"
              name={draftName}
              onName={setDraftName}
              busy={create.isPending}
              onCancel={() => setMode('view')}
              onSubmit={submitAddChild}
            />
          )}
          {departments.isLoading ? (
            <p className="px-1 py-3 text-xs font-bold text-slate-400">加载部门…</p>
          ) : tree.length === 0 ? (
            <p className="px-1 py-3 text-xs font-bold text-slate-400">暂无部门。</p>
          ) : (
            <div className="space-y-0.5">{tree.map((n) => renderNode(n, 0))}</div>
          )}
        </div>

        {/* 右:详情 + 成员 */}
        <div className="space-y-3">
          {!selected ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8">
              <FeedbackNotice tone="info" message="请选择左侧部门查看详情与成员。" />
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                {mode === 'edit' || mode === 'add-child' ? (
                  <InlineDeptForm
                    title={mode === 'edit' ? `编辑「${selected.name}」` : `在「${selected.name}」下新增子部门`}
                    name={draftName}
                    onName={setDraftName}
                    desc={mode === 'edit' ? draftDesc : undefined}
                    onDesc={mode === 'edit' ? setDraftDesc : undefined}
                    busy={update.isPending || create.isPending}
                    onCancel={() => setMode('view')}
                    onSubmit={mode === 'edit' ? submitEdit : submitAddChild}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-xl font-black text-slate-950">
                          {selected.name}
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-black text-slate-400">
                            ID: {selected.id?.replace('dept-', '')}
                          </span>
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {selected.description || '暂无部门描述'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={startAddChild}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                        >
                          <Plus size={14} /> 添加子部门
                        </button>
                        <button
                          type="button"
                          onClick={startEdit}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                        >
                          <Pencil size={14} /> 编辑
                        </button>
                        <button
                          type="button"
                          onClick={onDelete}
                          disabled={disable.isPending}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 size={14} /> 删除
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-slate-100 pt-4">
                      <Fact icon={UserRound} label="负责人" value={selected.managerName ?? '未指定'} />
                      <Fact icon={Users} label="成员数" value={`${selected.memberCount ?? 0} 人`} />
                      <Fact icon={CalendarDays} label="成立时间" value={selected.establishedOn ?? '—'} />
                    </div>
                  </>
                )}
              </div>

              {/* 成员表 */}
              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
                  <SearchInput className="mb-0" placeholder="搜索成员姓名 / 工号…" onSearch={setMemberSearch} />
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFeedback('成员导入将在后续切片接入。')}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                    >
                      <Upload size={14} /> 导入
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedback('成员新增将在后续切片接入(可在「团队与权限」分配角色)。')}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800"
                    >
                      <UserPlus size={14} /> 添加成员
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-black text-slate-400">
                        <th className="px-4 py-3">姓名 / 工号</th>
                        <th className="px-4 py-3">职位</th>
                        <th className="px-4 py-3">联系方式</th>
                        <th className="px-4 py-3">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.isLoading ? (
                        <tr><td colSpan={4} className="px-4 py-6 text-xs font-bold text-slate-400">加载成员…</td></tr>
                      ) : memberList.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-6 text-xs font-bold text-slate-400">该部门暂无成员。</td></tr>
                      ) : (
                        memberList.map((m) => (
                          <tr key={m.id} className="border-b border-slate-50 last:border-0">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                                  {(m.name ?? '?').slice(0, 1)}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-black text-slate-800">{m.name}</p>
                                  <p className="truncate font-mono text-[11px] font-bold text-slate-400">
                                    {m.employeeNo ?? '—'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-700">{m.jobTitle || '—'}</td>
                            <td className="px-4 py-3">
                              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                <Phone size={12} className="text-slate-400" /> {m.mobile || '—'}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                <Mail size={12} className="text-slate-400" /> {m.email || '—'}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <StatusPill label={m.status === 'active' ? '在职' : '离职'} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-100 px-4 py-3 text-xs font-bold text-slate-400">
                  共 {memberList.length} 条记录
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon size={16} />
      </span>
      <div>
        <p className="text-[11px] font-black text-slate-400">{label}</p>
        <p className="text-sm font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function InlineDeptForm({
  title,
  name,
  onName,
  desc,
  onDesc,
  busy,
  onCancel,
  onSubmit,
}: {
  title: string;
  name: string;
  onName: (v: string) => void;
  desc?: string;
  onDesc?: (v: string) => void;
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
      <p className="mb-2 text-xs font-black text-slate-600">{title}</p>
      <div className="space-y-2">
        <input className={inputCls} placeholder="部门名称" value={name} onChange={(e) => onName(e.target.value)} />
        {onDesc && (
          <input className={inputCls} placeholder="部门描述(选填)" value={desc ?? ''} onChange={(e) => onDesc(e.target.value)} />
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !name.trim()}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700 disabled:bg-slate-300"
        >
          <Building2 size={13} /> {busy ? '保存中' : '保存'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-500 hover:bg-slate-50"
        >
          取消
        </button>
      </div>
    </div>
  );
}
