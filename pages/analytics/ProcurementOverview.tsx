
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  DollarSign, ShoppingCart, Users, Sparkles, TrendingUp, ArrowDownRight, Building2, Activity 
} from 'lucide-react';

const deptSpendData = [
  { name: '生产部', value: 850, budget: 900 },
  { name: '技术部', value: 420, budget: 400 },
  { name: '行政部', value: 150, budget: 180 },
  { name: 'IT部', value: 280, budget: 300 },
  { name: '营销部', value: 120, budget: 150 },
];

const supplierRankData = [
  { name: '中国石化', value: 450, category: '原材料' },
  { name: '浪潮信息', value: 280, category: 'IT设备' },
  { name: '宝钢股份', value: 210, category: '原材料' },
  { name: '顺丰速运', value: 150, category: '物流服务' },
  { name: '京东企业购', value: 95, category: '综合物资' },
];

const ProcurementOverview: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><DollarSign size={24} /></div>
            <div className="flex items-center gap-1 text-sm text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">
              <TrendingUp size={14} /> +12.5%
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">年度采购总额</p>
          <p className="text-2xl font-black text-slate-900 mt-1">¥ 12,840,000</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><ShoppingCart size={24} /></div>
            <div className="flex items-center gap-1 text-sm text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">
              <TrendingUp size={14} /> +5.2%
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">采购订单数</p>
          <p className="text-2xl font-black text-slate-900 mt-1">1,245 <span className="text-xs text-slate-400 font-normal">单</span></p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Users size={24} /></div>
            <div className="flex items-center gap-1 text-sm text-slate-500 font-bold bg-slate-50 px-2 py-0.5 rounded">
              <span>持平</span>
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">活跃供应商</p>
          <p className="text-2xl font-black text-slate-900 mt-1">482 <span className="text-xs text-slate-400 font-normal">家</span></p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Sparkles size={24} /></div>
            <div className="flex items-center gap-1 text-sm text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
              <ArrowDownRight size={14} /> -8.4%
            </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">综合成本节约</p>
          <p className="text-2xl font-black text-slate-900 mt-1">¥ 1,254,000</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Breakdown */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="text-blue-600" size={20} /> 部门采购预算执行 (万元)
            </h3>
            <button className="text-xs text-blue-600 font-bold bg-blue-50 px-3 py-1.5 rounded-lg">查看详情</button>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptSpendData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar name="实际支出" dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar name="年度预算" dataKey="budget" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Suppliers Ranking */}
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Activity className="text-blue-600" size={20} /> 核心供应商排名
          </h3>
          <div className="space-y-6">
            {supplierRankData.map((s, i) => (
              <div key={i} className="relative">
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' : 
                      i === 1 ? 'bg-slate-100 text-slate-600' : 
                      i === 2 ? 'bg-orange-50 text-orange-700' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {i + 1}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 block">{s.name}</span>
                      <span className="text-[10px] text-slate-400">{s.category}</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-900">¥{s.value}w</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000" 
                    style={{ width: `${(s.value / 450) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors">
            查看完整供应商报告
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProcurementOverview;
