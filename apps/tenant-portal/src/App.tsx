import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { buyerNavigation } from '@24bid/shared';
import {
  LoginRequestScope,
  setAuthToken,
  useAuthLogin,
  useBuyerWorkspaceLoad,
} from '@24bid/api-client';
import {
  AppShell,
  FeedbackNotice,
  ListToolbar,
  MiniFact,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
  StatusPill,
} from '@24bid/ui';

const currency = (value?: number) =>
  value == null ? '—' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// S0-6：三端壳接通真实后端。演示采购方登录(现有 JWT) → 拉 workspace → 渲染真实需求。
// 全程经正向契约派生的 orval hooks，无手写 fetch。
export function App() {
  const [activeModuleId, setActiveModuleId] = useState('demands');
  const [authed, setAuthed] = useState(false);
  const activeModule = buyerNavigation.modules.find((m) => m.id === activeModuleId);

  const login = useAuthLogin();
  const workspace = useBuyerWorkspaceLoad({ query: { enabled: authed } });

  const handleLogin = () => {
    login.mutate(
      {
        data: {
          account: 'buyer.owner@example.com',
          password: 'demo123456',
          scope: LoginRequestScope.BUYER,
          tenantId: 'tenant-acme',
        },
      },
      {
        onSuccess: (res) => {
          setAuthToken(res.data?.accessToken ?? null);
          setAuthed(true);
        },
      },
    );
  };

  const demands = workspace.data?.data?.demands ?? [];

  return (
    <AppShell
      brandSubtitle={buyerNavigation.label}
      mainlineHint="需求申请 - 询价比价 - 订单履约 - 发票付款"
      modules={buyerNavigation.modules}
      activeModuleId={activeModuleId}
      onSelectModule={setActiveModuleId}
      title={activeModule?.label ?? '企业工作台'}
      accountLabel={authed ? '采购负责人 · tenant-acme' : '未登录'}
    >
      {!authed ? (
        <Panel title="连接后端" icon={ClipboardList} subtitle="正向契约 · orval hooks · 现有 JWT">
          <FeedbackNotice
            tone="info"
            message="S0-6：点击登录，经 @24bid/api-client 生成的 hooks 调用真实后端，拉取采购方 workspace。"
          />
          <PrimaryActionButton
            onClick={handleLogin}
            busy={login.isPending}
            pendingLabel="登录中"
            icon={ClipboardList}
          >
            以采购负责人登录并加载真实数据
          </PrimaryActionButton>
          {login.isError && (
            <div className="mt-3">
              <FeedbackNotice tone="error" message="登录失败：请确认后端已在 8080 运行。" />
            </div>
          )}
        </Panel>
      ) : (
        <Panel title={activeModule?.label ?? '采购需求'} icon={ClipboardList}>
          {workspace.isLoading ? (
            <FeedbackNotice tone="info" message="正在加载 workspace…" />
          ) : (
            <>
              <ListToolbar
                title="采购需求"
                recordCount={demands.length}
                filterLabel="全部状态（真实数据）"
                actionLabel="新建需求"
              />
              <ResponsiveTableFrame
                mobileCards={demands.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-black text-slate-950">{d.title}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{d.id}</p>
                      </div>
                      {d.status && <StatusPill label={d.status} />}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <MiniFact label="申请部门" value={d.departmentId ?? '—'} />
                      <MiniFact label="预算金额" value={currency(d.budget)} />
                    </div>
                  </div>
                ))}
              >
                <table className="min-w-[720px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">需求编号</th>
                      <th className="px-4 py-3">标题</th>
                      <th className="px-4 py-3">申请部门</th>
                      <th className="px-4 py-3">状态</th>
                      <th className="px-4 py-3 text-right">预算金额</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {demands.map((d) => (
                      <tr key={d.id}>
                        <td className="px-4 py-4 font-mono font-black text-slate-700">{d.id}</td>
                        <td className="px-4 py-4 font-bold text-slate-900">{d.title}</td>
                        <td className="px-4 py-4 text-slate-600">{d.departmentId}</td>
                        <td className="px-4 py-4">{d.status && <StatusPill label={d.status} />}</td>
                        <td className="px-4 py-4 text-right font-mono font-black text-slate-900">
                          {currency(d.budget)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveTableFrame>
            </>
          )}
        </Panel>
      )}
    </AppShell>
  );
}
