
import React from 'react';
import { FileText, Signature, CheckCircle, Clock, Shield, Search, Filter, Download } from 'lucide-react';

const ContractManagement: React.FC = () => {
  const contracts = [
    { id: 'CON-001', name: '2023年度原料框架协议', supplier: '上海宏达工业', amount: '按实结算', status: '已签署', signDate: '2023-01-15' },
    { id: 'CON-002', name: '办公设备维保合同', supplier: '北京神州科技', amount: '¥ 12,000', status: '签署中', signDate: '进行中' },
    { id: 'CON-003', name: '物流运输服务合同', supplier: '顺丰速运', amount: '¥ 250,000', status: '已签署', signDate: '2023-05-20' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900">合同履约管理</h1>
          <p className="text-sm text-slate-500 mt-1">支持全流程电子签章、合同合规性审查及履约监控。</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-md">
          <Signature size={18} />
          起草电子合同
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><FileText size={24} /></div>
          <div><p className="text-sm text-slate-500">累计签署</p><p className="text-xl font-bold">156 份</p></div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-orange-50 text-orange-600 rounded-xl"><Clock size={24} /></div>
          <div><p className="text-sm text-slate-500">待我签署</p><p className="text-xl font-bold">4 份</p></div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-green-50 text-green-600 rounded-xl"><Shield size={24} /></div>
          <div><p className="text-sm text-slate-500">合规扫描正常</p><p className="text-xl font-bold">100%</p></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 flex gap-4 border-b border-slate-50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="搜索合同编号、名称、签署方..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600">
            <Filter size={18} />
            筛选
          </button>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100 text-left">
            <tr>
              <th className="px-6 py-4 font-bold text-slate-500 uppercase w-16 text-center">序号</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">合同名称</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">签约供应商</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">合同金额</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">状态</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">签署时间</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contracts.map((c, idx) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-center font-bold text-slate-400">{idx + 1}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900">{c.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono uppercase">{c.id}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">{c.supplier}</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-900">{c.amount}</td>
                <td className="px-6 py-4">
                  <span className={`flex items-center gap-1 text-xs font-bold ${c.status === '已签署' ? 'text-green-600' : 'text-blue-600'}`}>
                    {c.status === '已签署' ? <CheckCircle size={14} /> : <Clock size={14} />}
                    {c.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{c.signDate}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-3">
                    <button className="text-blue-600 hover:text-blue-800 font-bold text-sm">查看</button>
                    <button className="text-slate-400 hover:text-slate-600"><Download size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContractManagement;
