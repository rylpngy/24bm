import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Shield } from 'lucide-react';
import {
  assignSupplierTeamRoles, createSupplierTeamRole, listSupplierTeamRoles, supplierTeamRolesKey,
  updateSupplierTeamRole, type SupplierTeamRole, type SupplierTeamRoles as RolesData,
} from '@24bid/api-client';
import { FeedbackNotice, Panel, PrimaryActionButton } from '@24bid/ui';

const buttonClass = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50';
const LEGACY_SALES_ROLE = 'role-supplier-sales';
interface Props {
  canManage: boolean;
  currentUserId?: string;
  member?: { id?: string; name?: string };
  onBack: () => void;
  onSaved: (message: string) => void;
}
export function SupplierTeamRoles(props: Props) {
  return props.canManage ? <RoleWorkspace {...props} /> : null;
}

function RoleWorkspace({ member, currentUserId, onBack, onSaved }: Props) {
  const query = useQuery({ queryKey: supplierTeamRolesKey, queryFn: ({ signal }) => listSupplierTeamRoles(signal) });
  const [editing, setEditing] = useState<SupplierTeamRole | 'new' | null>(null);
  const [message, setMessage] = useState('');
  const self = !!member && (!currentUserId || !member.id || member.id === currentUserId);
  return <Panel title={member ? `角色授权 · ${member.name ?? ''}` : '角色管理'} icon={Shield} subtitle="">
    {self ? <><button type="button" className={buttonClass} onClick={onBack}><ArrowLeft size={16} />返回成员列表</button><p role="alert" className="mt-4 text-sm">不能修改当前登录账号的角色</p></> : query.isPending ? <FeedbackNotice tone="info" message="正在加载角色…" /> : query.isError || !query.data?.data ? <>
      <FeedbackNotice tone="error" message="角色加载失败，请重试。" /><button type="button" className={buttonClass} onClick={() => void query.refetch()}>重试</button><button type="button" className={buttonClass} onClick={onBack}>返回成员列表</button>
    </> : member || editing ? <RoleEditor key={member?.id ?? (editing === 'new' ? 'new' : editing?.id)}
      data={query.data.data} member={member} role={editing === 'new' ? undefined : editing ?? undefined}
      onBack={member ? onBack : () => setEditing(null)}
      onSaved={text => { if (member) onSaved(text); else { setEditing(null); setMessage(text); } }} /> : <>
      <div className="mb-4 flex flex-wrap justify-between gap-2"><button type="button" className={buttonClass} onClick={onBack}><ArrowLeft size={16} />返回成员列表</button><button type="button" className={buttonClass} onClick={() => { setMessage(''); setEditing('new'); }}><Plus size={16} />新增角色</button></div>
      {message && <FeedbackNotice tone="success" message={message} />}
      <ul className="divide-y divide-slate-200">{query.data.data.roles.map(role => <li key={role.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0 flex-1"><p className="break-all text-sm font-bold">{role.name}</p><p className="mt-1 text-xs text-slate-500">{role.system ? '系统角色' : '自定义角色'} · {role.permissions.length} 项权限</p></div>
        {!role.system && <button type="button" aria-label={`编辑${role.name}`} className={buttonClass} onClick={() => { setMessage(''); setEditing(role); }}><Pencil size={15} />编辑</button>}
      </li>)}</ul>
    </>}
  </Panel>;
}

function RoleEditor({ data, member, role, onBack, onSaved }: {
  data: RolesData; member?: Props['member']; role?: SupplierTeamRole; onBack: () => void; onSaved: (text: string) => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState(role?.name ?? '');
  const [selected, setSelected] = useState<string[]>(member
    ? data.assignments.find(a => a.userId === member.id)?.roleIds ?? [] : role?.permissions ?? []);
  const [hadLegacySalesRole] = useState(() => !!member && selected.includes(LEGACY_SALES_ROLE));
  const lock = useRef(false);
  const choices = member ? data.roles.filter(r => r.id !== LEGACY_SALES_ROLE).map(r => ({ code: r.id, label: r.name })) : data.permissions.filter(p =>
    !p.code.includes('*') && !/^supplier:(user|team|team-roles):/.test(p.code));
  const allowed = new Set(choices.map(p => p.code));
  const unknown = selected.some(code => !allowed.has(code));
  const mutation = useMutation({ mutationFn: async () => {
    if (member?.id) return assignSupplierTeamRoles(member.id, selected);
    if (role?.system) throw new Error('系统角色不可修改');
    const draft = { name: name.trim(), permissions: selected };
    return role ? updateSupplierTeamRole(role.id, draft) : createSupplierTeamRole(draft);
  }, onSuccess: async () => {
    await client.invalidateQueries({ queryKey: supplierTeamRolesKey });
    await client.invalidateQueries({ predicate: q => typeof q.queryKey[0] === 'string' && q.queryKey[0].includes('/supplier/users') });
    onSaved(member ? '权限已更新；本地登录成员需重新登录。' : '角色已保存；受影响的本地登录成员需重新登录。');
  }, onSettled: () => { lock.current = false; } });
  const failure = mutation.error as { response?: { data?: { message?: string } }; message?: string } | null;
  const save = () => {
    if (lock.current || mutation.isPending || unknown || !selected.length || (!member && !name.trim())) return;
    lock.current = true; mutation.mutate();
  };
  return <form onSubmit={event => { event.preventDefault(); save(); }} className="max-w-3xl space-y-4">
    <fieldset disabled={mutation.isPending} className="min-w-0 space-y-4">
      {!member && <label className="block text-sm font-bold">角色名称<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} className="mt-2 h-10 w-full min-w-0 rounded-md border border-slate-200 px-3 font-normal" /></label>}
      <fieldset className="min-w-0"><legend className="mb-3 text-sm font-bold">{member ? '已分配角色' : '业务权限'}</legend>
        <div className="grid gap-3 sm:grid-cols-2">{choices.map(choice => <label key={choice.code} className="flex min-w-0 items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={selected.includes(choice.code)} onChange={event => setSelected(previous => event.target.checked ? [...previous, choice.code] : previous.filter(code => code !== choice.code))} />
          <span className="break-all">{choice.label}</span>
        </label>)}</div>
        {hadLegacySalesRole && <div className="mt-4 space-y-2 border-t border-amber-200 pt-3">
          <label className="flex min-w-0 items-start gap-2 text-sm text-amber-900">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={selected.includes(LEGACY_SALES_ROLE)}
              disabled={!selected.includes(LEGACY_SALES_ROLE)} onChange={event => {
                if (!event.target.checked) setSelected(previous => previous.filter(code => code !== LEGACY_SALES_ROLE));
              }} />
            <span className="break-all">历史角色：{LEGACY_SALES_ROLE}（取消后由所选角色替换）</span>
          </label>
          <p className="text-sm text-amber-800">历史角色不可重新授予。请明确取消历史授权并选择替代角色后保存；保存前原有授权不变。</p>
        </div>}
      </fieldset>
      <p className="text-sm text-amber-800">{member ? '保存将替换该成员的全部角色授权；本地登录成员需重新登录。' : '修改角色后，受影响的本地登录成员需重新登录。'}</p>
      {unknown && <p role="alert" className="text-sm text-red-600">{selected.some(code => !allowed.has(code) && !(hadLegacySalesRole && code === LEGACY_SALES_ROLE))
        ? '存在未识别的授权项，请返回并刷新后重试，当前授权未被修改。'
        : '请明确取消历史角色授权并选择替代角色后保存。'}</p>}
    </fieldset>
    {failure && <div role="alert"><FeedbackNotice tone="error" message={failure.response?.data?.message ?? failure.message ?? '保存失败，请重试。'} /></div>}
    <div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={mutation.isPending} className={buttonClass} onClick={onBack}>取消</button>
      <PrimaryActionButton type="submit" onClick={save} disabled={mutation.isPending || unknown || !selected.length || (!member && !name.trim())} busy={mutation.isPending} pendingLabel="保存中" flushTop>{member ? '保存授权' : '保存角色'}</PrimaryActionButton></div>
  </form>;
}
