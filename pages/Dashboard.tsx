
import React, { useState } from 'react';
import { 
  TrendingUp, Users, ShoppingBag, CreditCard, ArrowRight, ShieldCheck, 
  ChevronLeft, Calendar, FileText, ExternalLink, Sparkles, Plus, 
  Search, Bell, Clock, AlertTriangle, FileCheck, Truck, PieChart, 
  Briefcase, Zap, Activity, MoreHorizontal, MousePointerClick
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell 
} from 'recharts';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

const spendTrendData = [
  { name: 'Jan', spend: 4000, budget: 4500 },
  { name: 'Feb', spend: 3000, budget: 3200 },
  { name: 'Mar', spend: 5000, budget: 4800 },
  { name: 'Apr', spend: 4500, budget: 5000 },
  { name: 'May', spend: 6000, budget: 5500 },
  { name: 'Jun', spend: 5500, budget: 5800 },
];

const categoryData = [
  { name: 'IT设备', value: 35, color: '#3b82f6' },
  { name: '原材料', value: 45, color: '#10b981' },
  { name: 'MRO', value: 10, color: '#f59e0b' },
  { name: '服务', value: 10, color: '#8b5cf6' },
];

const mockMonthlyDetails: Record<string, any[]> = {
  'Jan': [
    { id: 'PO-230101', title: '生产设备润滑油采购', supplier: '壳牌中国', amount: 85000, status: '已完成' },
    { id: 'PO-230105', title: '行政楼绿植租赁服务', supplier: '绿意生活', amount: 12000, status: '已完成' },
    { id: 'PO-230112', title: 'IT部MacBook Pro更新', supplier: '苹果授权店', amount: 245000, status: '已完成' },
  ],
  'Feb': [
    { id: 'PO-230202', title: '仓库货架扩建工程', supplier: '恒力货架', amount: 120000, status: '已完成' },
    { id: 'PO-230214', title: '员工年度体检项目', supplier: '美年大健康', amount: 88000, status: '已完成' },
  ],
  'Mar': [
    { id: 'PO-230310', title: '春季市场推广物资', supplier: '博采众长传媒', amount: 350000, status: '已完成' },
    { id: 'PO-230325', title: '物流外包服务协议', supplier: '顺丰速运', amount: 150000, status: '已完成' },
  ],
  'Apr': [
    { id: 'PO-230405', title: '食堂原材料年度招标', supplier: '中粮集团', amount: 450000, status: '已完成' },
  ],
  'May': [
    { id: 'PO-230501', title: '研发中心试验耗材', supplier: '赛默飞世尔', amount: 600000, status: '已完成' },
  ],
  'Jun': [
    { id: 'PO-230612', title: '半年度办公用品补库', supplier: '晨光科力普', amount: 45000, status: '已完成' },
    { id: 'PO-230628', title: '数据中心服务器托管', supplier: '阿里云', amount: 505000, status: '已完成' },
  ],
};

const StatCard = ({ title, value, trend, icon: Icon, color, subValue, onClick }: any) => (
  <div 
    onClick={onClick}
    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 group-hover:scale-110 transition-transform`}>
        <Icon className={color.replace('bg-', 'text-')} size={24} />
      </div>
      <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
        <TrendingUp size={12} className={trend < 0 ? 'rotate-180' : ''} />
        {Math.abs(trend)}%
      </div>
    </div>
    <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</h3>
    <p className="text-2xl font-black text-slate-900">{value}</p>
    {subValue && <p className="text-xs text-slate-400 mt-2 font-medium">{subValue}</p>}
  </div>
);

const QuickAction = ({ icon: Icon, label, color, desc, onClick }: any) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center justify-center p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all group text-center h-full w-full"
  >
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${color} bg-opacity-10 group-hover:bg-opacity-20 transition-colors`}>
      <Icon className={color.replace('bg-', 'text-')} size={24} />
    </div>
    <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">{label}</span>
    <span className="text-[10px] text-slate-400 mt-1">{desc}</span>
  </button>
);

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const handleChartClick = (state: any) => {
    if (state && state.activeLabel) {
      setSelectedMonth(state.activeLabel);
    }
  };

  if (selectedMonth) {
    const details = mockMonthlyDetails[selectedMonth] || [];
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedMonth(null)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Calendar className="text-blue-600" size={24} />
                {selectedMonth} 采购详细清单
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                该月份共有 {details.length} 笔大额采购记录，总支出 ¥{spendTrendData.find(d => d.name === selectedMonth)?.spend}k
              </p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
            <ExternalLink size={16} /> 导出报表
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100 text-left">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase w-16 text-center">序号</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">订单编号</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">项目名称</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">合作供应商</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">金额 (元)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {details.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-center font-bold text-slate-400">
                    {idx + 1}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono text-slate-400 font-medium">{item.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-slate-400" />
                      <span className="font-semibold text-slate-900">{item.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{item.supplier}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-900">¥{item.amount.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold">
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-blue-600 hover:text-blue-800 font-bold text-sm flex items-center gap-1 transition-colors">
                      查看凭证 <ExternalLink size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 1. Top Section: Welcome & Quick Actions */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Welcome Banner */}
        <div className="lg:w-2/3 bg-gradient-to-r from-slate-900 to-slate-800 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl flex flex-col justify-between min-h-[220px]">
           <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Activity size={180} />
           </div>
           <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                 <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-[10px] font-bold uppercase tracking-wider text-blue-300">
                    Admin Dashboard
                 </span>
              </div>
              <h1 className="text-3xl font-black mb-2">下午好，张经理</h1>
              <p className="text-slate-400 text-sm max-w-md">
                 系统今日运行正常。您有 5 项待办审批和 2 个新的询价项目需要关注。AI 助手已为您生成本周采购建议。
              </p>
           </div>
           <div className="relative z-10 flex gap-4 mt-6">
              <button 
                onClick={() => onNavigate('suppliers/approval')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/50"
              >
                 <FileCheck size={18} /> 处理待办 (5)
              </button>
              <button 
                onClick={() => onNavigate('analytics/overview')}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all backdrop-blur-sm"
              >
                 <Sparkles size={18} /> 查看 AI 报告
              </button>
           </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="lg:w-1/3 grid grid-cols-2 gap-4">
           <QuickAction 
                icon={Plus} label="发起立项" desc="创建新采购需求" color="bg-blue-600" 
                onClick={() => onNavigate('projects/needs')}
           />
           <QuickAction 
                icon={Search} label="供应商寻源" desc="全网智能匹配" color="bg-purple-600" 
                onClick={() => onNavigate('suppliers/sourcing')}
           />
           <QuickAction 
                icon={Truck} label="订单跟踪" desc="查看物流状态" color="bg-orange-600" 
                onClick={() => onNavigate('collaboration/orders')}
           />
           <QuickAction 
                icon={PieChart} label="数据分析" desc="查看支出报表" color="bg-emerald-600" 
                onClick={() => onNavigate('analytics/spend')}
           />
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            title="本年度累计支出" value="¥ 12.8M" trend={12.5} icon={CreditCard} color="bg-blue-600" subValue="预算执行率 85%" 
            onClick={() => onNavigate('analytics/spend')}
        />
        <StatCard 
            title="活跃供应商" value="482" trend={3.2} icon={Users} color="bg-indigo-600" subValue="本月新增 12 家" 
            onClick={() => onNavigate('suppliers/list')}
        />
        <StatCard 
            title="进行中项目" value="24" trend={-2.4} icon={ShoppingBag} color="bg-purple-600" subValue="3 个即将截标" 
            onClick={() => onNavigate('procurement/bidding')}
        />
        <StatCard 
            title="累计节约成本" value="¥ 1.25M" trend={8.1} icon={ShieldCheck} color="bg-emerald-600" subValue="平均节资率 9.8%" 
            onClick={() => onNavigate('analytics/price')}
        />
      </div>

      {/* 3. Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Charts & Trends (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
           {/* Spend Trend Chart */}
           <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                       <TrendingUp className="text-blue-600" size={20} /> 采购支出趋势
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">近6个月实际支出 vs 预算</p>
                 </div>
                 <div className="flex gap-2">
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-600">
                       <div className="w-2 h-2 rounded-full bg-blue-600"></div> 实际
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-400">
                       <div className="w-2 h-2 rounded-full bg-blue-100"></div> 预算
                    </div>
                 </div>
              </div>
              <div className="h-[320px] w-full cursor-pointer" onClick={() => onNavigate('analytics/spend')}>
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spendTrendData} onClick={handleChartClick}>
                       <defs>
                          <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                             <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                       <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                       <Tooltip 
                          cursor={{ stroke: '#2563eb', strokeWidth: 2, strokeDasharray: '4 4' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                       />
                       <Area 
                          type="monotone" 
                          dataKey="spend" 
                          stroke="#2563eb" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorSpend)"
                          activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                       />
                       <Area 
                          type="monotone" 
                          dataKey="budget" 
                          stroke="#e2e8f0" 
                          strokeWidth={2} 
                          strokeDasharray="5 5"
                          fillOpacity={0} 
                          fill="transparent"
                       />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* Active Projects List */}
           <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Briefcase className="text-blue-600" size={20} /> 进行中的项目
                 </h3>
                 <button 
                    onClick={() => onNavigate('procurement/inquiry')}
                    className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                 >
                    查看全部
                 </button>
              </div>
              <div className="space-y-4">
                 {[
                    { title: '2024年度行政车辆维保服务询价', type: '询价', status: '报价中', date: '2023-11-15 截止', progress: 65, link: 'procurement/inquiry' },
                    { title: '三号生产线自动化设备竞价采购', type: '竞价', status: '竞价中', date: '2023-11-20 截止', progress: 40, link: 'procurement/bidding' },
                    { title: '核心机房服务器集群扩容', type: '招标', status: '评标中', date: '2023-11-10 截止', progress: 90, link: 'procurement/bidding' },
                 ].map((p, i) => (
                    <div 
                        key={i} 
                        onClick={() => onNavigate(p.link)}
                        className="flex items-center gap-4 p-4 border border-slate-100 rounded-2xl hover:border-blue-200 hover:shadow-sm transition-all group cursor-pointer"
                    >
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          p.type === '询价' ? 'bg-blue-50 text-blue-600' : 
                          p.type === '竞价' ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'
                       }`}>
                          {p.type}
                       </div>
                       <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{p.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-[10px] text-slate-400 flex items-center gap-1"><Clock size={10}/> {p.date}</span>
                             <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-bold">{p.status}</span>
                          </div>
                       </div>
                       <div className="w-24">
                          <div className="text-[10px] text-slate-400 text-right mb-1">{p.progress}%</div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                             <div className="bg-blue-600 h-1.5 rounded-full" style={{width: `${p.progress}%`}}></div>
                          </div>
                       </div>
                       <ChevronLeft className="rotate-180 text-slate-300 group-hover:text-blue-600 transition-colors" size={18} />
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Right Column: Tasks & Alerts (1/3 width) */}
        <div className="lg:col-span-1 space-y-6">
           
           {/* Pending Tasks */}
           <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Bell className="text-blue-600" size={20} /> 待办事项
                 </h3>
                 <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">5</span>
              </div>
              <div className="space-y-4">
                 {[
                    { title: '供应商入驻审批', desc: '浙江明辉机电提交了入驻申请', time: '2h', priority: 'high', link: 'suppliers/approval' },
                    { title: '合同待签署', desc: '华为云服务年度协议', time: '1d', priority: 'medium', link: 'collaboration/contracts' },
                    { title: '询价方案待审批', desc: '办公用品集中采购方案', time: '4h', priority: 'low', link: 'projects/plan' },
                 ].map((task, i) => (
                    <div 
                        key={i} 
                        onClick={() => onNavigate(task.link)}
                        className="flex gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                       <div className={`w-1 h-full rounded-full shrink-0 ${
                          task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                       }`}></div>
                       <div>
                          <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{task.title}</h4>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.desc}</p>
                          <p className="text-[10px] text-slate-400 mt-1 font-bold">{task.time} ago</p>
                       </div>
                    </div>
                 ))}
              </div>
              <button 
                onClick={() => onNavigate('suppliers/approval')}
                className="w-full mt-4 py-3 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors"
              >
                 进入审批中心
              </button>
           </div>

           {/* Risk Alerts */}
           <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                 <AlertTriangle className="text-amber-500" size={20} /> 风险预警
              </h3>
              <div className="space-y-3">
                 <div className="p-3 bg-red-50 border border-red-100 rounded-xl cursor-pointer" onClick={() => onNavigate('suppliers/list')}>
                    <div className="flex gap-2">
                       <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                       <div>
                          <p className="text-xs font-bold text-red-800">供应商资质过期</p>
                          <p className="text-[10px] text-red-600 mt-0.5">上海宏达工业 营业执照已过期 3 天</p>
                       </div>
                    </div>
                 </div>
                 <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl cursor-pointer" onClick={() => onNavigate('collaboration/contracts')}>
                    <div className="flex gap-2">
                       <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                       <div>
                          <p className="text-xs font-bold text-amber-800">合同即将到期</p>
                          <p className="text-[10px] text-amber-700 mt-0.5">顺丰速运物流服务协议 (剩 15 天)</p>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Category Distribution (Mini) */}
           <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                 <PieChart className="text-blue-600" size={18} /> 支出分布 (本月)
              </h3>
              <div className="h-40 cursor-pointer" onClick={() => onNavigate('analytics/spend')}>
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} layout="vertical" barSize={10}>
                       <XAxis type="number" hide />
                       <YAxis dataKey="name" type="category" width={50} tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                       <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none', fontSize: '12px'}} />
                       <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {categoryData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                       </Bar>
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
