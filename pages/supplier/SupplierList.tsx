
import React, { useState } from 'react';
import { 
  Plus, Search, Filter, Download, UserCheck, X, Mail, Link, QrCode, Copy, Send, 
  ChevronLeft, AlertTriangle, TrendingUp, Star, PieChart, Landmark, CheckCircle2,
  FileBadge, Gavel, ShieldCheck, Building2, Coins, Clock, MapPin, User, Phone,
  Info, History, Award, FileText, ChevronRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { suppliersData } from '../../data/suppliers';

const SupplierList: React.FC = () => {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState('采购订单');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteTab, setInviteTab] = useState<'email' | 'link'>('email');
  const [inviteForm, setInviteForm] = useState({
    companyName: '',
    contactName: '',
    email: '',
    category: '通用',
    message: '诚挚邀请贵司加入我们的供应商体系，共创合作共赢。点击下方链接完成注册。'
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const suppliers = suppliersData;
  const totalPages = Math.ceil(suppliers.length / itemsPerPage);
  const currentSuppliers = suppliers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSendInvite = () => {
    if (!inviteForm.email) {
        alert("请输入有效的邮箱地址");
        return;
    }
    alert(`邀请函已成功发送至 ${inviteForm.email}`);
    setIsInviteModalOpen(false);
    setInviteForm({ ...inviteForm, email: '', companyName: '', contactName: '' });
  };

  const handleCopyLink = () => {
    alert("邀请链接已复制到剪贴板");
  };

  const renderInviteModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <UserCheck size={24} className="text-blue-600"/> 邀请新供应商
                </h3>
                <button onClick={() => setIsInviteModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                    <X size={24} />
                </button>
            </div>
            
            <div className="p-6">
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-6">
                    <button 
                        onClick={() => setInviteTab('email')}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${inviteTab === 'email' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Mail size={16} /> 邮件邀请
                    </button>
                    <button 
                        onClick={() => setInviteTab('link')}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${inviteTab === 'link' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Link size={16} /> 生成链接
                    </button>
                </div>

                {inviteTab === 'email' ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">企业名称 (可选)</label>
                                <input 
                                    type="text" 
                                    value={inviteForm.companyName}
                                    onChange={(e) => setInviteForm({...inviteForm, companyName: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                                    placeholder="输入供应商公司全称"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">主营品类</label>
                                <select 
                                    value={inviteForm.category}
                                    onChange={(e) => setInviteForm({...inviteForm, category: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option>通用</option>
                                    <option>原材料</option>
                                    <option>电子元器件</option>
                                    <option>MRO工业品</option>
                                    <option>IT设备</option>
                                    <option>物流服务</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">联系人姓名</label>
                                <input 
                                    type="text" 
                                    value={inviteForm.contactName}
                                    onChange={(e) => setInviteForm({...inviteForm, contactName: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                                    placeholder="联系人"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">电子邮箱 <span className="text-red-500">*</span></label>
                                <input 
                                    type="email" 
                                    value={inviteForm.email}
                                    onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                                    placeholder="supplier@example.com"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">邀请留言</label>
                            <textarea 
                                value={inviteForm.message}
                                onChange={(e) => setInviteForm({...inviteForm, message: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                            ></textarea>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 space-y-6">
                        <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100">
                            <QrCode size={160} className="text-slate-900" />
                        </div>
                        <div className="w-full">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 text-center">专属注册邀请链接</label>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600 truncate font-mono">
                                    https://portal.zhicaiyun.com/register?inviteCode=ZC-2023-INV-8829
                                </div>
                                <button onClick={handleCopyLink} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors flex items-center gap-2">
                                    <Copy size={16} /> 复制
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 mt-2 text-center">链接有效期 7 天，请尽快发送给供应商</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                <button 
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
                >
                    取消
                </button>
                {inviteTab === 'email' && (
                    <button 
                        onClick={handleSendInvite}
                        className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 shadow-lg flex items-center gap-2"
                    >
                        <Send size={16} /> 发送邀请
                    </button>
                )}
            </div>
        </div>
    </div>
  );

  const renderSupplier360 = () => {
    const supplier = suppliers.find(s => s.id === selectedSupplierId) || suppliers[0];
    
    // Mock Data for charts
    const procurementHistory = [
      { month: '5月', amount: 45000 },
      { month: '6月', amount: 52000 },
      { month: '7月', amount: 38000 },
      { month: '8月', amount: 65000 },
      { month: '9月', amount: 48000 },
      { month: '10月', amount: 58000 },
    ];

    const performanceRadarData = [
      { subject: '质量稳定性', A: 95, fullMark: 100 },
      { subject: '交付及时率', A: 98, fullMark: 100 },
      { subject: '成本竞争力', A: 85, fullMark: 100 },
      { subject: '服务响应', A: 90, fullMark: 100 },
      { subject: '技术创新', A: 80, fullMark: 100 },
    ];

    const evaluationHistory = [
      { period: '2023 Q3', score: 95, grade: 'A', evaluator: '系统自动', date: '2023-10-01' },
      { period: '2023 Q2', score: 92, grade: 'A', evaluator: '张经理', date: '2023-07-05' },
      { period: '2023 Q1', score: 89, grade: 'B+', evaluator: '李工', date: '2023-04-02' },
    ];

    // Mock Finance Data
    const supplierFinance = [
        { id: 'PAY-2023001', supplier: supplier.name, type: '平台入驻年费', amount: 5800, status: '已缴纳', date: '2023-10-15' },
        { id: 'PAY-2023005', supplier: supplier.name, type: '项目投标保证金', amount: 20000, status: '待缴纳', date: '2023-10-20' },
    ];

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
         {/* Header with Back button */}
         <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
               <button onClick={() => setSelectedSupplierId(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                  <ChevronLeft size={24} />
               </button>
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-200">
                     {supplier.name.charAt(0)}
                  </div>
                  <div>
                     <h1 className="text-xl font-black text-slate-900 flex items-center gap-3">
                        {supplier.name}
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] border font-bold ${supplier.status === '合格' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                           {supplier.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] border font-bold bg-blue-50 text-blue-700 border-blue-200`}>
                           {supplier.level} 级供应商
                        </span>
                     </h1>
                     <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                        <span className="font-mono bg-slate-100 px-1.5 rounded text-xs">{supplier.id}</span>
                        <span>·</span>
                        <span>主营：{supplier.category}</span>
                     </p>
                  </div>
               </div>
            </div>
            <div className="flex gap-3">
               <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-50 flex items-center gap-2 transition-all">
                  <AlertTriangle size={16} /> 风险扫描
               </button>
               <button className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-sm hover:bg-slate-800 shadow-lg shadow-slate-900/10 flex items-center gap-2 transition-all">
                  <TrendingUp size={16} /> 绩效考核
               </button>
            </div>
         </div>
  
         {/* Content Grid */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Key Metrics & Info */}
            <div className="space-y-6">
               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                     <Star size={120} />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><PieChart size={18} className="text-blue-600"/> 核心绩效仪表盘</h3>
                  <div className="text-center py-6 relative z-10">
                     <div className="text-6xl font-black text-slate-900 mb-2 tracking-tighter">{supplier.score}</div>
                     <div className="flex justify-center gap-1 mb-2">
                        {[1,2,3,4,5].map(star => (
                           <Star key={star} size={18} className={`${star <= 4 ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />
                        ))}
                     </div>
                     <p className="text-xs font-bold text-green-600 bg-green-50 inline-block px-3 py-1 rounded-full">
                        高于行业平均水平 15%
                     </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                     <div className="p-3 bg-slate-50 rounded-2xl text-center border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 mb-1">准时交付率</p>
                        <p className="font-black text-slate-900 text-lg">98.5%</p>
                     </div>
                     <div className="p-3 bg-slate-50 rounded-2xl text-center border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 mb-1">质检合格率</p>
                        <p className="font-black text-slate-900 text-lg">99.2%</p>
                     </div>
                  </div>
               </div>

               {/* New Credit & Compliance Card */}
               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                     <Landmark size={18} className="text-blue-600"/> 工商与信用风控
                  </h3>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-xl">
                        <div className="flex items-center gap-2">
                           <CheckCircle2 size={16} className="text-green-600" />
                           <span className="text-sm font-bold text-green-700">经营状态正常</span>
                        </div>
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-green-200 text-green-600 font-bold">在营 (开业)</span>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                           <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">纳税信用等级</p>
                           <div className="flex items-center gap-1">
                              <FileBadge size={14} className="text-blue-600" />
                              <span className="font-black text-slate-900">A 级</span>
                           </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                           <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">行政处罚</p>
                           <div className="flex items-center gap-1">
                              <Gavel size={14} className="text-slate-400" />
                              <span className="font-black text-slate-900">0 条</span>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                           <span className="text-slate-500">统一社会信用代码</span>
                           <span className="font-mono font-medium text-slate-700">{supplier.creditCode}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                           <span className="text-slate-500">司法诉讼记录</span>
                           <span className="font-bold text-green-600">无风险</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                           <span className="text-slate-500">信用中国/黑名单</span>
                           <span className="font-bold text-green-600">未列入</span>
                        </div>
                     </div>
                     
                     <div className="pt-2">
                        <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                           <ShieldCheck size={10} /> 数据源：天眼查 / 企查查 / 信用中国
                        </p>
                     </div>
                  </div>
               </div>
  
               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Info size={18} className="text-blue-600"/> 基础档案</h3>
                  <div className="space-y-4 text-sm">
                     <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                        <Building2 size={16} className="text-slate-400 mt-0.5 shrink-0" />
                        <div>
                           <p className="text-xs text-slate-400 font-bold mb-0.5">企业全称</p>
                           <p className="font-bold text-slate-900">{supplier.name}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                        <UserCheck size={16} className="text-slate-400 mt-0.5 shrink-0" />
                        <div>
                           <p className="text-xs text-slate-400 font-bold mb-0.5">法定代表人</p>
                           <p className="font-bold text-slate-900">{supplier.legalPerson}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                        <Coins size={16} className="text-slate-400 mt-0.5 shrink-0" />
                        <div>
                           <p className="text-xs text-slate-400 font-bold mb-0.5">注册资本</p>
                           <p className="font-bold text-slate-900">{supplier.reg}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                        <Clock size={16} className="text-slate-400 mt-0.5 shrink-0" />
                        <div>
                           <p className="text-xs text-slate-400 font-bold mb-0.5">成立日期</p>
                           <p className="font-bold text-slate-900">{supplier.estDate}</p>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><MapPin size={18} className="text-blue-600"/> 联系方式</h3>
                  <div className="space-y-4 text-sm">
                     <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                        <span className="text-slate-500 flex items-center gap-2"><UserCheck size={14}/> 销售代表</span>
                        <span className="font-bold text-slate-900">{supplier.contact}</span>
                     </div>
                     <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                        <span className="text-slate-500 flex items-center gap-2"><Phone size={14}/> 移动电话</span>
                        <span className="font-bold text-slate-900">{supplier.phone}</span>
                     </div>
                     <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                        <span className="text-slate-500 flex items-center gap-2"><Mail size={14}/> 电子邮箱</span>
                        <span className="font-bold text-slate-900">{supplier.email}</span>
                     </div>
                     <div className="pt-1">
                        <span className="text-slate-500 flex items-center gap-2 mb-1"><MapPin size={14}/> 注册地址</span>
                        <span className="font-bold text-slate-900 block leading-relaxed">{supplier.address}</span>
                     </div>
                  </div>
               </div>
            </div>
  
            {/* Right Column: Transactions & History */}
            <div className="lg:col-span-2 space-y-6">
               {/* Historical Analysis Section */}
               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <History className="text-blue-600" size={18} /> 采购历史概览
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-4 col-span-1">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">累计交易总额</p>
                            <p className="text-2xl font-black text-slate-900">¥ 2,450,000</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">签订合同</p>
                                <p className="text-xl font-black text-slate-900">12 <span className="text-xs font-normal text-slate-500">份</span></p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">合作时长</p>
                                <p className="text-xl font-black text-slate-900">3.5 <span className="text-xs font-normal text-slate-500">年</span></p>
                            </div>
                        </div>
                      </div>
                      <div className="col-span-2 h-[180px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={procurementHistory}>
                              <defs>
                                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <RechartsTooltip 
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                  labelStyle={{ color: '#64748b', fontSize: '12px' }}
                              />
                              <Area type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} />
                            </AreaChart>
                        </ResponsiveContainer>
                      </div>
                  </div>
               </div>

               <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-2xl w-fit">
                  {['采购订单', '财务记录', '绩效考核', '供应产品', '资质证书'].map((tab) => (
                     <button 
                        key={tab} 
                        onClick={() => setActiveDetailTab(tab)}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                           activeDetailTab === tab 
                           ? 'bg-slate-900 text-white shadow-md' 
                           : 'text-slate-500 hover:bg-slate-50'
                        }`}
                     >
                        {tab}
                     </button>
                  ))}
               </div>
  
               {activeDetailTab === '采购订单' && (
               <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex justify-between items-center mb-6">
                     <h4 className="font-black text-lg text-slate-900">历史采购交易记录</h4>
                     <button className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">查看全部</button>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                           <tr>
                              <th className="px-4 py-4 rounded-tl-xl">订单号</th>
                              <th className="px-4 py-4">项目名称</th>
                              <th className="px-4 py-4 text-right">金额</th>
                              <th className="px-4 py-4 text-center">状态</th>
                              <th className="px-4 py-4 rounded-tr-xl text-right">日期</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {[1,2,3,4,5].map(i => (
                              <tr key={i} className="hover:bg-slate-50 transition-colors">
                                 <td className="px-4 py-4 font-mono text-slate-500 font-bold">PO-2023102{i}</td>
                                 <td className="px-4 py-4 font-bold text-slate-900">Q4季度{supplier.category}常规补库批次{i}</td>
                                 <td className="px-4 py-4 font-mono text-right font-bold text-slate-700">¥ {(i * 45000 + 12000).toLocaleString()}</td>
                                 <td className="px-4 py-4 text-center">
                                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-100">已完成</span>
                                 </td>
                                 <td className="px-4 py-4 text-slate-400 text-right font-medium">2023-10-2{i}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
               )}

               {activeDetailTab === '财务记录' && (
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                     <div className="flex justify-between items-center mb-6">
                        <h4 className="font-black text-lg text-slate-900">资金往来记录</h4>
                     </div>
                     {supplierFinance.length > 0 ? (
                        <div className="space-y-4">
                           {supplierFinance.map((record, idx) => (
                              <div key={idx} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:border-blue-200 transition-colors">
                                 <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${record.status === '已缴纳' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                       <Coins size={20} />
                                    </div>
                                    <div>
                                       <p className="font-bold text-slate-900">{record.type}</p>
                                       <p className="text-xs text-slate-400 font-mono mt-0.5">{record.id} · {record.date}</p>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <p className="font-black text-slate-900">¥{record.amount.toLocaleString()}</p>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${record.status === '已缴纳' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                       {record.status}
                                    </span>
                                 </div>
                              </div>
                           ))}
                        </div>
                     ) : (
                        <div className="py-12 text-center text-slate-400">
                           <FileText size={48} className="mx-auto mb-4 opacity-20" />
                           <p>暂无相关财务记录</p>
                        </div>
                     )}
                  </div>
               )}

               {activeDetailTab === '绩效考核' && (
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                     <div className="flex justify-between items-center mb-8">
                        <div>
                           <h4 className="font-black text-lg text-slate-900 flex items-center gap-2">
                              <Award size={20} className="text-blue-600" /> 全方位绩效评估
                           </h4>
                           <p className="text-sm text-slate-500 mt-1">基于过去12个月的交付数据与用户评价</p>
                        </div>
                        <button className="text-xs font-bold bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-all">发起新考核</button>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="h-[300px] w-full flex flex-col items-center">
                           <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={performanceRadarData}>
                                 <PolarGrid stroke="#e2e8f0" />
                                 <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
                                 <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                 <Radar
                                    name="供应商得分"
                                    dataKey="A"
                                    stroke="#2563eb"
                                    strokeWidth={3}
                                    fill="#3b82f6"
                                    fillOpacity={0.2}
                                 />
                                 <RechartsTooltip />
                              </RadarChart>
                           </ResponsiveContainer>
                           <p className="text-xs font-bold text-slate-400 mt-2">五维能力雷达图</p>
                        </div>

                        <div className="space-y-4">
                           <h5 className="font-bold text-slate-900 text-sm mb-2">历史考核记录</h5>
                           <div className="space-y-3">
                              {evaluationHistory.map((evalItem, i) => (
                                 <div key={i} className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between hover:border-blue-200 transition-colors">
                                    <div className="flex items-center gap-4">
                                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                                          evalItem.grade.startsWith('A') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                       }`}>
                                          {evalItem.grade}
                                       </div>
                                       <div>
                                          <p className="font-bold text-slate-900">{evalItem.period} 绩效考核</p>
                                          <p className="text-xs text-slate-400 mt-0.5">评估人：{evalItem.evaluator} · {evalItem.date}</p>
                                       </div>
                                    </div>
                                    <div className="text-right">
                                       <span className="text-xl font-black text-slate-900">{evalItem.score}</span>
                                       <span className="text-xs text-slate-400 font-medium ml-1">分</span>
                                    </div>
                                 </div>
                              ))}
                           </div>
                           <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-4">
                              <p className="text-xs font-bold text-slate-500 uppercase mb-2">综合评价建议</p>
                              <p className="text-sm text-slate-700 leading-relaxed">
                                 该供应商在<span className="font-bold text-blue-600">交付及时率</span>方面表现优异，但在<span className="font-bold text-amber-600">技术创新</span>方面略显保守。建议在下一年度合作中增加联合研发项目，以提升其技术配合度。整体风险可控，建议续签。
                              </p>
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               {(activeDetailTab === '供应产品' || activeDetailTab === '资质证书') && (
                  <div className="bg-white p-20 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 animate-in fade-in duration-300">
                     <FileText size={48} className="mx-auto mb-4 opacity-20" />
                     <p>暂无{activeDetailTab}数据</p>
                     <button className="mt-6 px-6 py-2 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors">
                        上传数据
                     </button>
                  </div>
               )}
            </div>
         </div>
      </div>
    );
  };

  if (selectedSupplierId) {
    return renderSupplier360();
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative">
      {/* Invite Modal */}
      {isInviteModalOpen && renderInviteModal()}

      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900">供应商库</h1>
          <p className="text-sm text-slate-500 mt-1">企业合格供应商名录及绩效管理</p>
        </div>
        <button 
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-all font-bold"
        >
          <Plus size={18} />
          邀请供应商
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="搜索供应商名称..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none w-64" />
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
              <Filter size={16} /> 筛选
            </button>
            <button className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
              <Download size={16} /> 导出
            </button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100 text-left">
            <tr>
              <th className="px-6 py-4 font-bold text-slate-500 uppercase w-20 text-center whitespace-nowrap">序号</th>
              <th className="px-6 py-4 font-bold text-slate-500 uppercase">供应商名称</th>
              <th className="px-6 py-4 font-bold text-slate-500 uppercase">主营品类</th>
              <th className="px-6 py-4 font-bold text-slate-500 uppercase">等级</th>
              <th className="px-6 py-4 font-bold text-slate-500 uppercase">状态</th>
              <th className="px-6 py-4 font-bold text-slate-500 uppercase">绩效得分</th>
              <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentSuppliers.map((s, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => setSelectedSupplierId(s.id)}>
                <td className="px-6 py-4 text-center font-bold text-slate-400 whitespace-nowrap">{(currentPage - 1) * itemsPerPage + i + 1}</td>
                <td className="px-6 py-4">
                   <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{s.name}</div>
                   <div className="text-xs text-slate-400 font-mono">{s.id}</div>
                </td>
                <td className="px-6 py-4 font-medium text-slate-600">{s.category}</td>
                <td className="px-6 py-4">
                   <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${s.level === 'A' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>{s.level}</span>
                </td>
                <td className="px-6 py-4">
                   <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${s.status === '合格' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{s.status}</span>
                </td>
                <td className="px-6 py-4">
                   <div className="flex items-center gap-1 font-bold text-slate-900">
                      <Star size={14} className="text-yellow-400 fill-yellow-400" />
                      {s.score}
                   </div>
                </td>
                <td className="px-6 py-4 text-center">
                   <button className="text-blue-600 hover:text-blue-800 text-xs font-bold px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                      详情
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="text-sm text-slate-500 font-medium">
            显示 {(currentPage - 1) * itemsPerPage + 1} 到 {Math.min(currentPage * itemsPerPage, suppliers.length)} 条，共 {suppliers.length} 条
          </div>
          <div className="flex gap-1">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx + 1)}
                className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                  currentPage === idx + 1 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {idx + 1}
              </button>
            ))}
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierList;
