
import React from 'react';
import { 
  TrendingUp, ShoppingBag, CreditCard, ArrowUpRight, 
  Package, Clock, CheckCircle2, AlertCircle, FileText, Gavel
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

interface SupplierDashboardProps {
  onNavigate: (tab: string) => void;
}

const salesData = [
  { name: '5月', sales: 42000 },
  { name: '6月', sales: 55000 },
  { name: '7月', sales: 38000 },
  { name: '8月', sales: 62000 },
  { name: '9月', sales: 58000 },
  { name: '10月', sales: 75000 },
];

const todoItems = [
  { id: 1, title: '智采云集团 - 年度办公用品询价', type: '报价', deadline: '2小时后截止', priority: 'high', link: 'supplier/quotes' },
  { id: 2, title: 'PO-20231102-005 订单待发货', type: '发货', deadline: '今日需发出', priority: 'high', link: 'supplier/delivery' },
  { id: 3, title: '2024年度供应商资质复核', type: '认证', deadline: '剩余 3 天', priority: 'medium', link: 'supplier/qualification' },
  { id: 4, title: '10月份对账单待确认', type: '财务', deadline: '本周内', priority: 'low', link: 'supplier/settlement' },
];

const StatCard = ({ title, value, trend, icon: Icon, color, onClick }: any) => (
  <div 
    onClick={onClick}
    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 group-hover:scale-110 transition-transform`}>
        <Icon className={color.replace('bg-', 'text-')} size={24} />
      </div>
      <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-green-50 text-green-600 rounded-full">
        <ArrowUpRight size={12} />
        {trend}%
      </div>
    </div>
    <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</h3>
    <p className="text-2xl font-black text-slate-900">{value}</p>
  </div>
);

const SupplierDashboard: React.FC<SupplierDashboardProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. Welcome Banner */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-[2rem] p-10 text-white relative overflow-hidden shadow-2xl flex items-center justify-between">
         <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
               <span className="px-2 py-1 bg-white/20 border border-white/30 rounded text-[10px] font-bold uppercase tracking-wider">
                  Vendor Portal
               </span>
            </div>
            <h1 className="text-3xl font-black mb-2">欢迎回来，慧销云商家</h1>
            <p className="text-orange-100 text-sm max-w-lg">
               您有 4 个重要商机待处理，本月销售额较上月增长 29.3%。
            </p>
         </div>
         <div className="hidden md:flex gap-4 relative z-10">
            <button 
                onClick={() => onNavigate('supplier/bids')}
                className="px-6 py-3 bg-white text-orange-600 rounded-xl font-bold text-sm shadow-lg hover:bg-orange-50 transition-all flex items-center gap-2"
            >
               <Gavel size={18} /> 参与竞标
            </button>
            <button 
                onClick={() => onNavigate('supplier/delivery')}
                className="px-6 py-3 bg-orange-800 text-white rounded-xl font-bold text-sm hover:bg-orange-900 transition-all flex items-center gap-2"
            >
               <Package size={18} /> 订单发货
            </button>
         </div>
         {/* Decor */}
         <div className="absolute -right-10 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      {/* 2. Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
            title="本月销售额" value="¥ 75,000" trend={12.5} icon={CreditCard} color="bg-orange-500" 
            onClick={() => onNavigate('supplier/settlement')}
        />
        <StatCard 
            title="待处理订单" value="12" trend={5.2} icon={ShoppingBag} color="bg-blue-500" 
            onClick={() => onNavigate('supplier/orders')}
        />
        <StatCard 
            title="近期中标率" value="34%" trend={2.4} icon={TrendingUp} color="bg-green-500" 
            onClick={() => onNavigate('supplier/bids')}
        />
        <StatCard 
            title="平均发货时长" value="18h" trend={-8.1} icon={Clock} color="bg-purple-500" 
            onClick={() => onNavigate('supplier/delivery')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3. Sales Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                 <TrendingUp className="text-orange-600" size={20} /> 销售趋势分析
              </h3>
              <select className="bg-slate-50 border border-slate-200 rounded-lg text-xs px-2 py-1 font-bold text-slate-600 outline-none">
                 <option>近半年</option>
                 <option>本年度</option>
              </select>
           </div>
           <div className="h-[300px] w-full cursor-pointer" onClick={() => onNavigate('supplier/settlement')}>
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={salesData}>
                    <defs>
                       <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip 
                       contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area 
                       type="monotone" 
                       dataKey="sales" 
                       stroke="#f97316" 
                       strokeWidth={3} 
                       fillOpacity={1} 
                       fill="url(#colorSales)"
                    />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* 4. Todo List */}
        <div className="lg:col-span-1 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                 <AlertCircle className="text-orange-600" size={20} /> 待办事项
              </h3>
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">4</span>
           </div>
           <div className="space-y-4 flex-1">
              {todoItems.map((item) => (
                 <div 
                    key={item.id} 
                    onClick={() => onNavigate(item.link)}
                    className="p-4 border border-slate-100 rounded-2xl hover:border-orange-200 hover:bg-orange-50/30 transition-all cursor-pointer group"
                 >
                    <div className="flex justify-between items-start mb-2">
                       <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          item.type === '报价' ? 'bg-blue-100 text-blue-700' :
                          item.type === '发货' ? 'bg-green-100 text-green-700' :
                          item.type === '认证' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                       }`}>
                          {item.type}
                       </span>
                       <span className="text-[10px] font-bold text-slate-400">{item.deadline}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-orange-600 transition-colors mb-1">{item.title}</h4>
                 </div>
              ))}
           </div>
           <button 
                onClick={() => onNavigate('supplier/orders')}
                className="w-full mt-4 py-3 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors"
           >
              进入任务中心
           </button>
        </div>
      </div>
    </div>
  );
};

export default SupplierDashboard;
