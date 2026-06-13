
import React, { useState } from 'react';
import { 
  FileText, Search, Filter, Download, ArrowLeft, Printer, 
  Building2, Calendar, CheckCircle, Clock, ShieldCheck
} from 'lucide-react';

interface Contract {
  id: string;
  title: string;
  customer: string;
  amount: number;
  status: '待签署' | '生效中' | '已到期';
  startDate: string;
  endDate: string;
  type: string;
  content?: string;
}

const SupplierContracts: React.FC = () => {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const contracts: Contract[] = [
    { 
        id: 'CON-2023-001', 
        title: '2023年度原料供应框架协议', 
        customer: '智采云科技集团', 
        amount: 2450000, 
        status: '生效中', 
        startDate: '2023-01-01', 
        endDate: '2023-12-31',
        type: '框架协议' 
    },
    { 
        id: 'CON-2023-088', 
        title: '精密轴承采购专项合同', 
        customer: '上海宏博贸易', 
        amount: 85000, 
        status: '待签署', 
        startDate: '2023-11-01', 
        endDate: '2024-05-01',
        type: '单次采购' 
    }
  ];

  const handleViewDetail = (contract: Contract) => {
    setSelectedContract(contract);
    setView('detail');
  };

  const renderDetail = () => {
    if (!selectedContract) return null;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                 <ArrowLeft size={24} />
              </button>
              <div>
                 <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-slate-900">{selectedContract.title}</h2>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${
                        selectedContract.status === '生效中' ? 'bg-green-50 text-green-700 border-green-100' : 
                        selectedContract.status === '待签署' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                       {selectedContract.status}
                    </span>
                 </div>
                 <p className="text-sm text-slate-500 mt-1">合同编号: {selectedContract.id} · 类型: {selectedContract.type}</p>
              </div>
           </div>
           <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                 <Printer size={18} /> 打印
              </button>
              <button className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg">
                 <Download size={18} /> 下载 PDF
              </button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                 <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <FileText size={20} className="text-blue-600"/> 合同正文
                 </h3>
                 <div className="text-xs text-slate-500">共 12 页</div>
              </div>
              <div className="flex-1 bg-slate-50 rounded-xl p-8 border border-slate-100 text-slate-600 text-sm leading-8 font-serif">
                 <p className="font-bold text-center text-lg text-slate-900 mb-8">{selectedContract.title}</p>
                 <p className="mb-4"><span className="font-bold">甲方：</span>{selectedContract.customer}</p>
                 <p className="mb-4"><span className="font-bold">乙方：</span>苏州精控机械有限公司</p>
                 <p className="mb-4">双方本着互惠互利、共同发展的原则，经友好协商，达成如下协议：</p>
                 <p className="mb-4 font-bold">第一条 合作内容</p>
                 <p className="mb-4">乙方负责向甲方提供{selectedContract.type === '框架协议' ? '原材料年度供应' : '精密轴承'}，具体规格、数量及价格详见附件。</p>
                 <p className="mb-4 font-bold">第二条 结算方式</p>
                 <p className="mb-4">甲方应于验收合格后 30 日内支付货款。总金额为人民币 {selectedContract.amount.toLocaleString()} 元。</p>
                 <p className="text-center text-slate-400 mt-12 italic">- 预览模式，仅展示部分内容 -</p>
              </div>
           </div>

           <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Building2 className="text-blue-600" size={20} /> 客户信息
                 </h3>
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">签约方</p>
                    <p className="font-bold text-slate-900">{selectedContract.customer}</p>
                 </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Clock className="text-blue-600" size={20} /> 关键条款
                 </h3>
                 <div className="space-y-4 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-50">
                       <span className="text-slate-500">合同金额</span>
                       <span className="font-black text-slate-900">¥{selectedContract.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                       <span className="text-slate-500">生效日期</span>
                       <span className="font-medium text-slate-900">{selectedContract.startDate}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                       <span className="text-slate-500">到期日期</span>
                       <span className="font-medium text-slate-900">{selectedContract.endDate}</span>
                    </div>
                 </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <ShieldCheck className="text-blue-600" size={20} /> 签署状态
                 </h3>
                 <div className="space-y-3">
                    <div className="flex items-center gap-3">
                       <CheckCircle size={16} className="text-green-500" />
                       <span className="text-sm font-bold text-slate-700">甲方 ({selectedContract.customer}) 已签署</span>
                    </div>
                    <div className="flex items-center gap-3">
                       {selectedContract.status === '待签署' ? (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-300"></div>
                       ) : (
                          <CheckCircle size={16} className="text-green-500" />
                       )}
                       <span className={`text-sm font-bold ${selectedContract.status === '待签署' ? 'text-slate-400' : 'text-slate-700'}`}>
                          乙方 (我方) {selectedContract.status === '待签署' ? '待签署' : '已签署'}
                       </span>
                    </div>
                 </div>
                 {selectedContract.status === '待签署' && (
                    <button className="w-full mt-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">
                       立即签署
                    </button>
                 )}
              </div>
           </div>
        </div>
      </div>
    );
  };

  const renderList = () => {
    const filtered = contracts.filter(c => c.title.includes(searchTerm) || c.customer.includes(searchTerm));

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <FileText className="text-orange-600" size={24} />
              销售合同
            </h1>
            <p className="text-sm text-slate-500 mt-1">管理与客户签署的销售协议与框架合同</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
           <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                   type="text" 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   placeholder="搜索合同名称或客户..." 
                   className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none w-64 focus:ring-2 focus:ring-orange-500 transition-all" 
                 />
              </div>
              <button className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                 <Filter size={16} /> 筛选
              </button>
           </div>
           <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-left">
                 <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">合同编号</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">合同名称</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">客户</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-right">金额</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">状态</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">有效期</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {filtered.map((c, i) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => handleViewDetail(c)}>
                       <td className="px-6 py-4 font-mono text-slate-500">{c.id}</td>
                       <td className="px-6 py-4 font-bold text-slate-900 group-hover:text-orange-600 transition-colors">{c.title}</td>
                       <td className="px-6 py-4 text-slate-700">{c.customer}</td>
                       <td className="px-6 py-4 text-right font-black text-slate-900">¥{c.amount.toLocaleString()}</td>
                       <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                             c.status === '生效中' ? 'bg-green-50 text-green-700' : 
                             c.status === '待签署' ? 'bg-blue-50 text-blue-700' :
                             'bg-slate-100 text-slate-500'
                          }`}>
                             {c.status}
                          </span>
                       </td>
                       <td className="px-6 py-4 text-slate-500 font-medium">{c.startDate} 至 {c.endDate}</td>
                       <td className="px-6 py-4 text-center">
                          <button className="text-blue-600 font-bold hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors text-xs">
                             查看
                          </button>
                       </td>
                    </tr>
                 ))}
                 {filtered.length === 0 && (
                    <tr>
                       <td colSpan={7} className="py-12 text-center text-slate-400">
                          <FileText size={32} className="mx-auto mb-2 opacity-20" />
                          <p>暂无相关合同</p>
                       </td>
                    </tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>
    );
  };

  return view === 'detail' ? renderDetail() : renderList();
};

export default SupplierContracts;
