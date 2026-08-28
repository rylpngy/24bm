import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Network,
  Pencil,
  Plus,
  Search,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import {
  type BuyerRoleResponse,
  type BuyerUserResponse,
  type DepartmentResponse,
  useBuyerRoleList,
  useBuyerUserList,
  useDepartmentCreate,
  useDepartmentDisable,
  useDepartmentList,
  useDepartmentUpdate,
} from '@24bid/api-client';
import { ConfirmDialog, FeedbackNotice, Pagination, StatusPill, cn } from '@24bid/ui';
import { BuyerMemberEditorDialog } from '../shared/buyer-member-editor-dialog';
import { ExcelImportControl } from '../shared/excel-import-control';

interface TreeNode {
  department: DepartmentResponse;
  children: TreeNode[];
  rollup: number;
}

interface Feedback {
  tone: 'success' | 'error' | 'info';
  message: string;
}

type DepartmentDialogState =
  | { kind: 'root' }
  | { kind: 'child'; parent: DepartmentResponse }
  | { kind: 'edit'; department: DepartmentResponse }
  | null;

const PAGE_SIZE = 8;

function errorMessage(error: unknown, fallback: string) {
  const response = error as {
    response?: { data?: { message?: unknown; error?: { message?: unknown } } };
    message?: unknown;
  };
  const message = response.response?.data?.message ?? response.response?.data?.error?.message ?? response.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

function buildTree(departments: DepartmentResponse[]) {
  const byParent = new Map<string, DepartmentResponse[]>();
  departments.forEach((department) => {
    const key = department.parentId || '__root__';
    byParent.set(key, [...(byParent.get(key) || []), department]);
  });

  const makeNode = (department: DepartmentResponse): TreeNode => {
    const children = (byParent.get(department.id || '') || []).map(makeNode);
    return {
      department,
      children,
      rollup: (department.memberCount || 0) + children.reduce((total, child) => total + child.rollup, 0),
    };
  };

  return (byParent.get('__root__') || []).map(makeNode);
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

export function OrgStructurePage() {
  const queryClient = useQueryClient();
  const departmentsQuery = useDepartmentList();
  const rolesQuery = useBuyerRoleList();
  const activeUsersQuery = useBuyerUserList({ status: 'active' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [treeKeyword, setTreeKeyword] = useState('');
  const [memberKeyword, setMemberKeyword] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DepartmentDialogState>(null);
  const [memberEditor, setMemberEditor] = useState<BuyerUserResponse | null | 'new'>(null);
  const [disableTarget, setDisableTarget] = useState<DepartmentResponse | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const updateDepartment = useDepartmentUpdate();
  const disableDepartment = useDepartmentDisable();

  const departments = departmentsQuery.data?.data || [];
  const roles = rolesQuery.data?.data || [];
  const activeUsers = activeUsersQuery.data?.data || [];
  const tree = useMemo(() => buildTree(departments), [departments]);
  const selected = departments.find((department) => department.id === selectedId) || departments[0];
  const membersQuery = useBuyerUserList(
    {
      departmentId: selected?.id,
      keyword: memberKeyword || undefined,
    },
    { query: { enabled: Boolean(selected?.id) } },
  );
  const departmentMembers = membersQuery.data?.data || [];

  const roleNameById = useMemo(() => {
    const names = new Map<string, string>();
    roles.forEach((role) => {
      if (role.id) names.set(role.id, role.name || role.id);
    });
    return names;
  }, [roles]);

  const departmentNameById = useMemo(() => {
    const names = new Map<string, string>();
    departments.forEach((department) => {
      if (department.id) names.set(department.id, department.name || department.id);
    });
    return names;
  }, [departments]);

  const activeChildCount = useMemo(
    () => departments.filter((department) => department.parentId === selected?.id).length,
    [departments, selected?.id],
  );

  useEffect(() => {
    if (departments.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !departments.some((department) => department.id === selectedId)) {
      setSelectedId(departments[0].id || null);
    }
  }, [departments, selectedId]);

  useEffect(() => {
    const parents = departments.map((department) => department.parentId).filter(Boolean) as string[];
    if (parents.length > 0) {
      setExpanded((current) => {
        const next = new Set(current);
        parents.forEach((parentId) => next.add(parentId));
        return sameIds([...current], [...next]) ? current : next;
      });
    }
  }, [departments]);

  useEffect(() => {
    setMemberPage(1);
  }, [selected?.id, memberKeyword]);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (query) => /^\/api\/v1\/buyer\/(departments|users|roles)/.test(String(query.queryKey[0] || '')),
    });

  const pageCount = Math.max(1, Math.ceil(departmentMembers.length / PAGE_SIZE));
  const safeMemberPage = Math.min(memberPage, pageCount);
  const pagedMembers = departmentMembers.slice((safeMemberPage - 1) * PAGE_SIZE, safeMemberPage * PAGE_SIZE);

  const appointManager = (member: BuyerUserResponse) => {
    if (!selected?.id || !member.id) return;
    updateDepartment.mutate(
      {
        departmentId: selected.id,
        data: {
          name: selected.name || '',
          description: selected.description || '',
          managerId: member.id,
          transferManagerToDepartment: false,
        },
      },
      {
        onSuccess: () => {
          setFeedback({ tone: 'success', message: '已将 ' + (member.name || '该成员') + ' 任命为部门主管。' });
          void refresh();
        },
        onError: (error) => setFeedback({ tone: 'error', message: errorMessage(error, '任命主管失败，请刷新后重试。') }),
      },
    );
  };

  const confirmDisable = () => {
    if (!disableTarget?.id) return;
    disableDepartment.mutate(
      { departmentId: disableTarget.id },
      {
        onSuccess: () => {
          setFeedback({ tone: 'success', message: '部门已停用。' });
          setDisableTarget(null);
          void refresh();
        },
        onError: (error) => {
          setDisableTarget(null);
          setFeedback({
            tone: 'error',
            message: errorMessage(error, '该部门存在在职成员、子部门或业务引用，暂不能停用。'),
          });
        },
      },
    );
  };

  const toggleExpand = (departmentId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(departmentId)) next.delete(departmentId);
      else next.add(departmentId);
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const { department, children, rollup } = node;
    const hasMatch = !treeKeyword.trim() || (department.name || '').toLowerCase().includes(treeKeyword.trim().toLowerCase());
    const childNodes = children.map((child) => renderNode(child, depth + 1)).filter(Boolean);
    if (!hasMatch && childNodes.length === 0) return null;
    const isSelected = department.id === selected?.id;
    const isOpen = expanded.has(department.id || '') || Boolean(treeKeyword.trim());

    return (
      <div key={department.id}>
        <div
          className={cn(
            'group flex min-h-9 items-center gap-1 rounded-lg pr-2 transition',
            isSelected ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'text-slate-700 hover:bg-slate-100',
          )}
          style={{ paddingLeft: depth * 16 + 4 }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              className={cn(
                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition',
                isSelected ? 'text-blue-100 hover:bg-blue-500' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600',
              )}
              onClick={() => department.id && toggleExpand(department.id)}
              aria-label={isOpen ? '收起子部门' : '展开子部门'}
            >
              {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          ) : (
            <span className="w-7 shrink-0" />
          )}
          <button
            type="button"
            onClick={() => department.id && setSelectedId(department.id)}
            className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1.5 text-left"
          >
            <span className="truncate text-sm font-bold">{department.name || '未命名部门'}</span>
            <span
              className={cn(
                'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-black',
                isSelected ? 'bg-blue-500 text-blue-50' : 'bg-slate-100 text-slate-400',
              )}
            >
              {rollup}
            </span>
          </button>
        </div>
        {isOpen && childNodes.length > 0 && <div className="space-y-0.5">{childNodes}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {feedback && <FeedbackNotice tone={feedback.tone} message={feedback.message} />}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Network size={19} />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-black text-slate-950">组织架构</h1>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">部门层级、负责人和成员归属统一维护</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-black text-slate-600">
              {departments.length} 个部门
            </span>
            <span className="rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-black text-blue-700">
              {activeUsers.length} 名在职成员
            </span>
            <ExcelImportControl
              endpoint="/api/v1/buyer/departments/import"
              templateName="部门导入模板"
              invalidatePrefix="/api/v1/buyer/departments"
              label="批量导入"
            />
            <button
              type="button"
              onClick={() => setDialog({ kind: 'root' })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-black text-white transition hover:bg-slate-800"
            >
              <Plus size={15} /> 新建一级部门
            </button>
          </div>
        </header>

        <div className="grid min-h-[640px] lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-b border-slate-100 bg-slate-50/60 p-4 lg:border-b-0 lg:border-r">
            <label className="relative block">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={treeKeyword}
                onChange={(event) => setTreeKeyword(event.target.value)}
                placeholder="搜索部门"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
              {treeKeyword && (
                <button
                  type="button"
                  onClick={() => setTreeKeyword('')}
                  aria-label="清除搜索"
                  className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="mt-4">
              <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-wide text-slate-400">部门结构</p>
              {departmentsQuery.isLoading ? (
                <p className="px-1 py-5 text-xs font-bold text-slate-400">正在加载部门…</p>
              ) : tree.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
                  <Building2 size={20} className="mx-auto text-slate-300" />
                  <p className="mt-2 text-xs font-bold text-slate-400">尚未建立部门</p>
                </div>
              ) : (
                <div className="space-y-0.5">{tree.map((node) => renderNode(node, 0))}</div>
              )}
            </div>
          </aside>

          <main className="min-w-0 p-4 sm:p-5">
            {!selected ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center">
                <Building2 size={28} className="text-slate-300" />
                <p className="mt-3 text-sm font-black text-slate-600">请选择一个部门开始维护</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">可新建一级部门，或通过 Excel 批量导入。</p>
              </div>
            ) : (
              <div className="space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white">
                  <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-black text-slate-950">{selected.name || '未命名部门'}</h2>
                        <StatusPill label="启用" />
                      </div>
                      <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                        {selected.description || '尚未填写部门说明。可在编辑部门中补充职责范围和说明。'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDialog({ kind: 'child', parent: selected })}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        <Plus size={14} /> 新建子部门
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog({ kind: 'edit', department: selected })}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        <Pencil size={14} /> 编辑部门
                      </button>
                      <button
                        type="button"
                        onClick={() => setDisableTarget(selected)}
                        className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-700 transition hover:bg-red-50"
                      >
                        停用
                      </button>
                    </div>
                  </header>
                  <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    <DepartmentFact icon={<UserRound size={16} />} label="部门主管" value={selected.managerName || '暂未设置'} />
                    <DepartmentFact icon={<Users size={16} />} label="在职成员" value={String(selected.memberCount || 0) + ' 人'} />
                    <DepartmentFact icon={<CalendarDays size={16} />} label="成立时间" value={selected.establishedOn || '未登记'} />
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div>
                      <h2 className="text-sm font-black text-slate-900">部门成员</h2>
                      <p className="mt-0.5 text-xs font-semibold text-slate-400">维护成员资料、岗位、主角色和部门主管。</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="relative">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={memberKeyword}
                          onChange={(event) => setMemberKeyword(event.target.value)}
                          placeholder="搜索姓名、工号"
                          className="h-9 w-44 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setMemberEditor('new')}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-black text-white transition hover:bg-blue-700"
                      >
                        <UserPlus size={14} /> 新增成员
                      </button>
                    </div>
                  </header>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] table-fixed text-left">
                      <thead className="bg-slate-50/80">
                        <tr className="text-xs font-black text-slate-500">
                          <th className="w-[27%] px-5 py-3">成员</th>
                          <th className="w-[20%] px-4 py-3">岗位 / 角色</th>
                          <th className="w-[25%] px-4 py-3">联系方式</th>
                          <th className="w-[108px] px-4 py-3">状态</th>
                          <th className="sticky right-0 z-10 w-[224px] border-l border-slate-100 bg-slate-50/95 px-4 py-3 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {membersQuery.isLoading ? (
                          <tr><td colSpan={5} className="px-5 py-12 text-center text-sm font-semibold text-slate-400">正在加载成员…</td></tr>
                        ) : pagedMembers.length === 0 ? (
                          <tr><td colSpan={5} className="px-5 py-12 text-center text-sm font-semibold text-slate-400">暂无符合条件的成员。</td></tr>
                        ) : (
                          pagedMembers.map((member) => {
                            const isManager = member.id === selected.managerId;
                            const isActive = member.status === 'active';
                            const appointing = updateDepartment.isPending && updateDepartment.variables?.data.managerId === member.id;
                            return (
                              <tr key={member.id} className="group border-t border-slate-100 align-middle transition hover:bg-slate-50/70">
                                <td className="px-5 py-3.5">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700">
                                      {(member.name || '?').slice(0, 1)}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="flex min-w-0 items-center gap-1.5">
                                        <p className="truncate text-sm font-black text-slate-800">{member.name || '未命名成员'}</p>
                                        {isManager && <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-black text-amber-700">主管</span>}
                                      </div>
                                      <p className="mt-0.5 truncate font-mono text-[11px] font-bold text-slate-400">{member.employeeNo || '未设置工号'}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <p className="truncate text-sm font-bold text-slate-700">{member.jobTitle || '未设置岗位'}</p>
                                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{roleNameById.get(member.roleId || '') || '未设置角色'}</p>
                                </td>
                                <td className="px-4 py-3.5">
                                  <p className="truncate text-xs font-semibold text-slate-700">{member.mobile || '未登记手机号'}</p>
                                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{member.email || '未登记邮箱'}</p>
                                </td>
                                <td className="px-4 py-3.5">
                                  <StatusPill label={isActive ? '在职' : '已停用'} />
                                </td>
                                <td className="sticky right-0 z-[5] w-[224px] border-l border-slate-100 bg-white px-4 py-3.5 transition group-hover:bg-slate-50">
                                  <div className="flex min-w-[180px] items-center justify-end gap-2 whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => setMemberEditor(member)}
                                      className="inline-flex h-8 w-[68px] shrink-0 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-black leading-none text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                                    >
                                      <Pencil size={13} /> 编辑
                                    </button>
                                    {!isManager && isActive && (
                                      <button
                                        type="button"
                                        onClick={() => appointManager(member)}
                                        disabled={appointing}
                                        className="inline-flex h-8 min-w-[100px] shrink-0 items-center justify-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-black leading-none text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        <UserCheck size={13} /> {appointing ? '处理中' : '设为主管'}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <footer className="border-t border-slate-100 px-5 py-3">
                    <Pagination page={safeMemberPage} pageSize={PAGE_SIZE} total={departmentMembers.length} onPageChange={setMemberPage} />
                  </footer>
                </section>

                {activeChildCount > 0 && (
                  <p className="px-1 text-xs font-semibold text-slate-400">
                    当前部门下有 {activeChildCount} 个启用子部门。停用前请先处理子部门和在职成员。
                  </p>
                )}
              </div>
            )}
          </main>
        </div>
      </section>

      <DepartmentEditorDialog
        state={dialog}
        activeUsers={activeUsers}
        departmentNameById={departmentNameById}
        onClose={() => setDialog(null)}
        onSaved={(message, departmentId) => {
          setDialog(null);
          if (departmentId) setSelectedId(departmentId);
          setFeedback({ tone: 'success', message });
          void refresh();
        }}
      />

      <BuyerMemberEditorDialog
        open={memberEditor !== null}
        member={memberEditor === 'new' ? null : memberEditor}
        defaultDepartmentId={selected?.id}
        departments={departments}
        roles={roles as BuyerRoleResponse[]}
        onClose={() => setMemberEditor(null)}
        onSaved={(member, mode) => {
          setMemberEditor(null);
          setFeedback({
            tone: 'success',
            message: mode === 'create' ? '成员已创建并加入当前部门。' : '成员资料已更新。',
          });
          if (member?.departmentId) setSelectedId(member.departmentId);
          void refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(disableTarget)}
        title="确认停用部门"
        message={
          '停用“' +
          (disableTarget?.name || '') +
          '”后不可继续分配成员或使用该部门。存在在职成员、子部门或采购业务引用时，系统会阻止停用。'
        }
        tone="danger"
        confirmLabel="确认停用"
        busy={disableDepartment.isPending}
        onCancel={() => setDisableTarget(null)}
        onConfirm={confirmDisable}
      />
    </div>
  );
}

function DepartmentFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-5 py-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-black text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function DepartmentEditorDialog({
  state,
  activeUsers,
  departmentNameById,
  onClose,
  onSaved,
}: {
  state: DepartmentDialogState;
  activeUsers: BuyerUserResponse[];
  departmentNameById: Map<string, string>;
  onClose: () => void;
  onSaved: (message: string, departmentId?: string) => void;
}) {
  const createDepartment = useDepartmentCreate();
  const updateDepartment = useDepartmentUpdate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isEdit = state?.kind === 'edit';
  const department = state?.kind === 'edit' ? state.department : undefined;
  const busy = createDepartment.isPending || updateDepartment.isPending;

  useEffect(() => {
    if (!state) return;
    setName(department?.name || '');
    setDescription(department?.description || '');
    setManagerId(department?.managerId || '');
    setError(null);
  }, [state, department?.id]);

  if (!state) return null;

  const selectedManager = activeUsers.find((user) => user.id === managerId);
  const transferRequired = Boolean(
    isEdit &&
      selectedManager?.departmentId &&
      selectedManager.departmentId !== department?.id,
  );
  const currentDepartmentUsers = activeUsers.filter((user) => user.departmentId === department?.id);
  const otherDepartmentUsers = activeUsers.filter((user) => user.departmentId !== department?.id);
  const title =
    state.kind === 'root'
      ? '新建一级部门'
      : state.kind === 'child'
        ? '新建子部门'
        : '编辑部门';
  const titleDetail =
    state.kind === 'root'
      ? '创建一个新的一级组织单元。'
      : state.kind === 'child'
        ? '将在“' + (state.parent.name || '') + '”下创建子部门。'
        : '可维护部门职责，并从全企业在职成员中指定部门主管。';

  const submit = () => {
    if (!name.trim()) {
      setError('请填写部门名称。');
      return;
    }
    setError(null);
    if (state.kind === 'edit' && department?.id) {
      updateDepartment.mutate(
        {
          departmentId: department.id,
          data: {
            name: name.trim(),
            description: description.trim(),
            managerId: managerId || undefined,
            transferManagerToDepartment: transferRequired,
          },
        },
        {
          onSuccess: () => onSaved('部门资料已保存。', department.id),
          onError: (mutationError) => setError(errorMessage(mutationError, '部门资料保存失败，请稍后重试。')),
        },
      );
      return;
    }
    createDepartment.mutate(
      {
        data: {
          name: name.trim(),
          parentId: state.kind === 'child' ? state.parent.id : undefined,
        },
      },
      {
        onSuccess: (response) => onSaved('部门已创建。', response.data?.id),
        onError: (mutationError) => setError(errorMessage(mutationError, '创建部门失败，请检查名称后重试。')),
      },
    );
  };

  const inputClass =
    'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" onClick={busy ? undefined : onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-black text-slate-950">{title}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">{titleDetail}</p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="关闭"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>
        <div className="space-y-4 px-6 py-5">
          {error && <FeedbackNotice tone="error" message={error} />}
          <Field label="部门名称" required>
            <input
              autoFocus
              className={inputClass}
              value={name}
              placeholder="请输入部门名称"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          {isEdit && (
            <>
              <Field label="部门说明">
                <textarea
                  className="min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  value={description}
                  placeholder="填写部门职责、适用范围等说明"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
              <Field label="部门主管">
                <select className={inputClass} value={managerId} onChange={(event) => setManagerId(event.target.value)}>
                  <option value="">暂不设置主管</option>
                  <optgroup label="当前部门成员">
                    {currentDepartmentUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {(user.name || '未命名成员') + ' · ' + (user.jobTitle || '成员')}
                      </option>
                    ))}
                  </optgroup>
                  {otherDepartmentUsers.length > 0 && (
                    <optgroup label="其他部门成员（任命后调入当前部门）">
                      {otherDepartmentUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {(user.name || '未命名成员') + ' · ' + (departmentNameById.get(user.departmentId || '') || '未分配部门')}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </Field>
              {transferRequired && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold leading-5 text-amber-800">
                  该成员目前属于“{departmentNameById.get(selectedManager?.departmentId || '') || '其他部门'}”。保存后会先将其调入当前部门，再任命为主管；原部门主管身份会自动解除。
                </div>
              )}
            </>
          )}
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={submit}
            className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:bg-slate-300"
          >
            {busy ? '保存中…' : '保存'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-black text-slate-600">
        {label}{required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
