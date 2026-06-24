import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { buyerNavigation } from '@24bid/shared';
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

// S0-3 骨架：用复刻组件库搭出真实布局壳与列表页模式，验证「换用料不换观感」。
// 业务数据接通在后续切片（orval hooks）落地。
const sampleRows = [
  { id: 'PD-2026-0007', title: '生产线备件采购', dept: '生产部', budget: '¥128,000', status: '审批中' },
  { id: 'PD-2026-0006', title: '办公 IT 设备扩容', dept: '信息部', budget: '¥86,500', status: '已通过' },
  { id: 'PD-2026-0005', title: '年度劳保用品', dept: '行政部', budget: '¥42,300', status: '草稿' },
];

export function App() {
  const [activeModuleId, setActiveModuleId] = useState('demands');
  const activeModule = buyerNavigation.modules.find((m) => m.id === activeModuleId);

  return (
    <AppShell
      brandSubtitle={buyerNavigation.label}
      mainlineHint="需求申请 - 询价比价 - 订单履约 - 发票付款"
      modules={buyerNavigation.modules}
      activeModuleId={activeModuleId}
      onSelectModule={setActiveModuleId}
      title={activeModule?.label ?? '企业工作台'}
      accountLabel="采购方主账户"
    >
      <FeedbackNotice message="S0-3 组件库已贯通：布局壳 + 列表页模式逐像素复刻自旧实现。" />

      <Panel title={activeModule?.label ?? '采购需求'} icon={ClipboardList}>
        <ListToolbar
          title={activeModule?.label ?? '采购需求'}
          recordCount={sampleRows.length}
          filterLabel="全部状态"
          actionLabel="新建需求"
        />
        <ResponsiveTableFrame
          mobileCards={sampleRows.map((row) => (
            <div
              key={row.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">{row.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{row.id}</p>
                </div>
                <StatusPill label={row.status} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniFact label="申请部门" value={row.dept} />
                <MiniFact label="预算金额" value={row.budget} />
              </div>
              <PrimaryActionButton onClick={() => undefined} fullWidth>
                查看详情
              </PrimaryActionButton>
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
              {sampleRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-4 font-mono font-black text-slate-700">{row.id}</td>
                  <td className="px-4 py-4 font-bold text-slate-900">{row.title}</td>
                  <td className="px-4 py-4 text-slate-600">{row.dept}</td>
                  <td className="px-4 py-4">
                    <StatusPill label={row.status} />
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-black text-slate-900">
                    {row.budget}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTableFrame>
      </Panel>
    </AppShell>
  );
}
