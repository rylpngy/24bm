import { useEffect, useState, type ReactNode } from 'react';
import { BriefcaseBusiness, KeyRound, UserRound, X } from 'lucide-react';
import {
  type BuyerRoleResponse,
  type BuyerUserResponse,
  type DepartmentResponse,
  useBuyerUserCreate,
  useBuyerUserUpdate,
} from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

interface MemberDraft {
  name: string;
  employeeNo: string;
  jobTitle: string;
  mobile: string;
  email: string;
  departmentId: string;
  roleIds: string[];
  initialPassword: string;
}

export interface BuyerMemberEditorDialogProps {
  open: boolean;
  member?: BuyerUserResponse | null;
  defaultDepartmentId?: string;
  departments: DepartmentResponse[];
  roles: BuyerRoleResponse[];
  requireEmployeeNo?: boolean;
  onClose: () => void;
  onSaved: (member: BuyerUserResponse | undefined, mode: 'create' | 'update') => void;
}

function errorMessage(error: unknown, fallback: string) {
  const response = error as { response?: { data?: { message?: unknown; error?: { message?: unknown } } }; message?: unknown };
  const message = response.response?.data?.message ?? response.response?.data?.error?.message ?? response.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

function createDraft(
  member: BuyerUserResponse | null | undefined,
  defaultDepartmentId: string | undefined,
  roles: BuyerRoleResponse[],
): MemberDraft {
  const assignedRoles = (member as BuyerUserResponse & { roleIds?: string[] } | null | undefined)?.roleIds;
  return {
    name: member?.name ?? '',
    employeeNo: member?.employeeNo ?? '',
    jobTitle: member?.jobTitle ?? '',
    mobile: member?.mobile ?? '',
    email: member?.email ?? '',
    departmentId: member?.departmentId ?? defaultDepartmentId ?? '',
    roleIds: (assignedRoles?.length
      ? assignedRoles
      : [member?.roleId ?? roles[0]?.id ?? '']).filter(Boolean) as string[],
    initialPassword: '',
  };
}

/** 采购方成员新建/维护弹窗，供组织架构与团队管理共用。 */
export function BuyerMemberEditorDialog(props: BuyerMemberEditorDialogProps) {
  const { can } = useBuyerPermissions();
  if (!can('buyer:role:manage')) return null;
  return <MemberEditor {...props} />;
}

function MemberEditor({
  open,
  member,
  defaultDepartmentId,
  departments,
  roles,
  requireEmployeeNo = false,
  onClose,
  onSaved,
}: BuyerMemberEditorDialogProps) {
  const create = useBuyerUserCreate();
  const update = useBuyerUserUpdate();
  const [draft, setDraft] = useState<MemberDraft>(() => createDraft(member, defaultDepartmentId, roles));
  const [localError, setLocalError] = useState<string | null>(null);
  const isEdit = Boolean(member?.id);
  const rolesKey = roles.map((role) => role.id).join('|');

  useEffect(() => {
    if (open) {
      setDraft(createDraft(member, defaultDepartmentId, roles));
      setLocalError(null);
    }
    // 角色数据异步就绪后，需要重新补齐新成员的默认角色。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member?.id, defaultDepartmentId, rolesKey]);

  if (!open) return null;

  const busy = create.isPending || update.isPending;
  const inputClass =
    'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400';
  const set = (patch: Partial<MemberDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const validate = () => {
    if (!draft.name.trim()) return '请填写成员姓名。';
    if (requireEmployeeNo && !draft.employeeNo.trim()) return '请填写成员工号。';
    if (!draft.departmentId) return '请选择所属部门。';
    if (draft.roleIds.length === 0) return '请至少选择一个角色。';
    if (!isEdit && draft.initialPassword.trim().length < 6) return '初始密码至少 6 位。';
    return null;
  };

  const submit = () => {
    const invalid = validate();
    if (invalid) {
      setLocalError(invalid);
      return;
    }
    setLocalError(null);
    const profile = {
      name: draft.name.trim(),
      employeeNo: draft.employeeNo.trim() || undefined,
      jobTitle: draft.jobTitle.trim() || undefined,
      mobile: draft.mobile.trim() || undefined,
      email: draft.email.trim() || undefined,
      departmentId: draft.departmentId,
      roleId: draft.roleIds[0],
      roleIds: draft.roleIds,
    };
    const finish = (saved: BuyerUserResponse | undefined, mode: 'create' | 'update') => {
      if (!saved?.id) {
        setLocalError('成员已保存，但返回结果缺少成员编号。');
        return;
      }
      onSaved(saved, mode);
    };
    if (isEdit && member?.id) {
      update.mutate(
        { userId: member.id, data: profile },
        {
          onSuccess: (response) => void finish(response.data, 'update'),
          onError: (error) => setLocalError(errorMessage(error, '成员资料保存失败，请稍后重试。')),
        },
      );
      return;
    }
    create.mutate(
      { data: { ...profile, initialPassword: draft.initialPassword, status: 'active' } },
      {
        onSuccess: (response) => void finish(response.data, 'create'),
        onError: (error) => setLocalError(errorMessage(error, '新增成员失败，请检查资料或企业成员配额。')),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" onClick={busy ? undefined : onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? '编辑成员' : '新增成员'}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              {isEdit ? <BriefcaseBusiness size={19} /> : <UserRound size={19} />}
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-slate-950">{isEdit ? '编辑成员资料' : '新增团队成员'}</h2>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {isEdit ? '可维护成员资料、所属部门和多个业务角色。' : '账号创建后默认为启用状态，可授予一个或多个业务角色。'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="关闭"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[calc(92dvh-145px)] overflow-y-auto px-6 py-5">
          {localError && <div className="mb-4"><FeedbackNotice tone="error" message={localError} /></div>}
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <Field label="成员姓名" required>
              <input className={inputClass} value={draft.name} placeholder="请输入姓名" onChange={(event) => set({ name: event.target.value })} />
            </Field>
            <Field label="工号" required={requireEmployeeNo}>
              <input className={inputClass} value={draft.employeeNo} placeholder="如 EMP-001" onChange={(event) => set({ employeeNo: event.target.value })} />
            </Field>
            <Field label="职位">
              <input className={inputClass} value={draft.jobTitle} placeholder="如 采购专员" onChange={(event) => set({ jobTitle: event.target.value })} />
            </Field>
            <Field label="所属部门" required>
              <select className={inputClass} value={draft.departmentId} onChange={(event) => set({ departmentId: event.target.value })}>
                <option value="">请选择部门</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="业务角色" required>
                <div className="grid max-h-52 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2">
                  {roles.map((role) => {
                    const roleId = role.id ?? '';
                    const checked = draft.roleIds.includes(roleId);
                    return (
                      <label key={roleId} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 hover:border-blue-200">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => set({ roleIds: checked
                            ? draft.roleIds.filter((value) => value !== roleId)
                            : [...draft.roleIds, roleId] })}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                        />
                        <span className="truncate">{role.name || roleId}</span>
                      </label>
                    );
                  })}
                </div>
              </Field>
            </div>
            <Field label="手机号码">
              <input className={inputClass} value={draft.mobile} placeholder="请输入手机号码" onChange={(event) => set({ mobile: event.target.value })} />
            </Field>
            <Field label="邮箱">
              <input className={inputClass} type="email" value={draft.email} placeholder="请输入邮箱" onChange={(event) => set({ email: event.target.value })} />
            </Field>
            {!isEdit && (
              <Field label="初始密码" required>
                <div className="relative">
                  <KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className={`${inputClass} pl-9`}
                    type="password"
                    value={draft.initialPassword}
                    placeholder="至少 6 位"
                    onChange={(event) => set({ initialPassword: event.target.value })}
                  />
                </div>
              </Field>
            )}
          </div>
        </div>

        <footer className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:bg-slate-300"
          >
            {busy ? '保存中…' : isEdit ? '保存修改' : '创建成员'}
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
