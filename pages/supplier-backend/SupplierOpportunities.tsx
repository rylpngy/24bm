
import React from 'react';
import { Search, Filter, Gavel, Clock, CheckCircle2, XCircle, FileText, ArrowRight } from 'lucide-react';

const SupplierOpportunities: React.FC = () => {
  const opportunities = [
    { id: 'RFQ-20231105-01', title: '集团2024年度核心机房服务器集群扩容', type: '公开招标', buyer: '智采云科技集团', deadline: '2023-11-20', status: 'bidding' },
    { id: 'RFQ-20231104-03', title: 'Q4季度办公用品集中采购询价', type: '询价', buyer: '智采云 - 行政部', deadline: '2023-11-10', status: 'open' },
    { id: 'RFQ-20231028-09', title: '生产基地自动化流水线改造', type: '邀请招标', buyer: '智采云 - 生产部', deadline: '2023-10-30', status: 'closed' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Gavel className="text-orange-600" size={24} />
            商机与投标
          </h1>
          <p className="text-sm text-slate-500 mt-1">查看公开招标项目及受邀询价单</p>
        </div>
        <div className="flex gap-3">
           <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
              历史报价
           </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex gap-4">
               <button className="text-sm font-bold text-orange-600 border-b-2 border-orange-600 pb-1">进行中</button>
               <button className="text-sm font-bold text-slate-500 hover:text-slate-800 pb-1">已截止</button>
               <button className="text-sm font-bold text-slate-500 hover:text-slate-800 pb-1">已中标</button>
            </div>
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
               <input type="text" placeholder="搜索项目名称..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none w-64" />
            </div>
         </div>
         
         <div className="divide-y divide-slate-100">
            {opportunities.map((opp, i) => (
               <div key={i} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer">
                  <div className="flex items-start gap-4">
                     <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        opp.type === '公开招标' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                     }`}>
                        <FileText size={24} />
                     </div>
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                           <span className="text-xs font-bold px-2 py-0.5 rounded border border-slate-200 text-slate-500">{opp.type}</span>
                           {opp.status === 'bidding' && <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">投标中</span>}
                           {opp.status === 'open' && <span className="text-xs font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700">报价中</span>}
                           {opp.status === 'closed' && <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">已截止</span>}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-orange-600 transition-colors">{opp.title}</h3>
                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-4">
                           <span className="flex items-center gap-1"><Gavel size={14} /> 采购方: {opp.buyer}</span>
                           <span className="flex items-center gap-1"><Clock size={14} /> 截止: {opp.deadline}</span>
                        </p>
                     </div>
                  </div>
                  <button className="px-6 py-2.5 bg-white border-2 border-orange-100 text-orange-600 rounded-xl font-bold hover:bg-orange-600 hover:text-white transition-all shadow-sm">
                     {opp.status === 'closed' ? '查看结果' : '立即参与'}
                  </button>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default SupplierOpportunities;
