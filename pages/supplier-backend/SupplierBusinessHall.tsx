
import React, { useState } from 'react';
import { 
  Search, Gavel, Clock, MapPin, Building2, Megaphone, ArrowRight, 
  Wallet, Filter, ChevronDown, LayoutGrid, List, ChevronLeft,
  FileText, Calendar, ShieldCheck, Download, AlertCircle, CheckCircle2
} from 'lucide-react';

interface OpportunityItem {
  name: string;
  spec: string;
  qty: number;
  unit: string;
}

interface Opportunity {
  id: string;
  title: string;
  type: 'inquiry' | 'bidding';
  buyer: string;
  budget: string;
  deadline: string;
  location: string;
  category: string;
  status: 'open' | 'bidding' | 'closed';
  publishDate: string;
  description: string;
  items: OpportunityItem[];
  timeline: { label: string; date: string; status: 'completed' | 'current' | 'future' }[];
  requirements: string[];
}

const SupplierBusinessHall: React.FC = () => {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'inquiry' | 'bidding'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const opportunities: Opportunity[] = [
    { 
      id: 'OPP-001', 
      title: '2024年度集团总部服务器及网络设备采购项目', 
      type: 'bidding', 
      buyer: '智采云科技集团', 
      budget: '500万', 
      deadline: '2023-12-15', 
      location: '上海',
      category: 'IT设备',
      status: 'bidding', 
      publishDate: '2023-11-20',
      description: '为满足集团业务扩张需求，现对2024年度总部机房核心服务器集群及配套网络设备进行公开招标采购。本项目要求供应商具备原厂授权资质，并能提供5年上门质保服务。',
      items: [
        { name: '高性能计算服务器', spec: '4*Xeon Platinum, 1TB RAM', qty: 20, unit: '台' },
        { name: '分布式存储节点', spec: '500TB RAW', qty: 5, unit: '台' },
        { name: '核心交换机', spec: '32*100G QSFP28', qty: 2, unit: '台' }
      ],
      timeline: [
        { label: '发布公告', date: '2023-11-20', status: 'completed' },
        { label: '报名截止', date: '2023-11-30', status: 'current' },
        { label: '投标截止', date: '2023-12-15', status: 'future' },
        { label: '开标日期', date: '2023-12-20', status: 'future' }
      ],
      requirements: [
        '供应商需具备 ISO9001 质量管理体系认证',
        '近三年内具有类似项目业绩不少于 3 个，且单项合同金额不低于 200 万',
        '不接受联合体投标'
      ]
    },
    { 
      id: 'OPP-002', 
      title: 'Q4季度行政办公耗材集中采购询价', 
      type: 'inquiry', 
      buyer: '杭州大和电子 - 行政部', 
      budget: '20万', 
      deadline: '2023-11-25', 
      location: '杭州',
      category: '办公用品',
      status: 'open', 
      publishDate: '2023-11-18',
      description: '杭州分公司第四季度日常办公消耗品采购，包含打印纸、墨盒、文具等。要求报价包含增值税及运费，送货上门。',
      items: [
        { name: 'A4复印纸', spec: '80g 500张/包', qty: 500, unit: '箱' },
        { name: '惠普硒鼓', spec: 'Q2612A', qty: 50, unit: '个' },
        { name: '中性笔', spec: '黑色 0.5mm', qty: 200, unit: '盒' }
      ],
      timeline: [
        { label: '发布询价', date: '2023-11-18', status: 'completed' },
        { label: '报价截止', date: '2023-11-25', status: 'current' },
        { label: '结果公示', date: '2023-11-28', status: 'future' }
      ],
      requirements: [
        '需提供正规增值税专用发票',
        '承诺接单后 3 个工作日内送达'
      ]
    },
    { 
      id: 'OPP-003', 
      title: '生产线自动化机械臂维保服务', 
      type: 'inquiry', 
      buyer: '无锡恒润科技', 
      budget: '公开', 
      deadline: '2023-11-30', 
      location: '无锡',
      category: '服务',
      status: 'open',
      publishDate: '2023-11-19',
      description: '针对二号车间 10 台 ABB 工业机器人的年度维保服务，包含定期巡检、润滑保养及易损件更换。',
      items: [
        { name: '机械臂年度维保', spec: 'ABB IRB-6700', qty: 10, unit: '台' },
        { name: '控制柜除尘保养', spec: '-', qty: 10, unit: '次' }
      ],
      timeline: [
        { label: '发布需求', date: '2023-11-19', status: 'completed' },
        { label: '报价截止', date: '2023-11-30', status: 'current' },
        { label: '服务开始', date: '2024-01-01', status: 'future' }
      ],
      requirements: [
        '维保人员需持有相关品牌认证工程师证书',
        '提供 7*24 小时应急响应服务'
      ]
    },
    { 
      id: 'OPP-004', 
      title: '新建厂房低压配电柜采购项目', 
      type: 'bidding', 
      buyer: '上海宏博贸易', 
      budget: '120万', 
      deadline: '2023-12-10', 
      location: '上海',
      category: '工程设备',
      status: 'bidding',
      publishDate: '2023-11-15',
      description: '新建物流仓储中心低压配电系统采购，包括GGD型交流低压配电柜及相关元器件。',
      items: [
        { name: '低压进线柜', spec: 'GGD', qty: 2, unit: '台' },
        { name: '电容补偿柜', spec: 'GGD', qty: 2, unit: '台' },
        { name: '出线柜', spec: 'GGD', qty: 8, unit: '台' }
      ],
      timeline: [
        { label: '发布公告', date: '2023-11-15', status: 'completed' },
        { label: '踏勘现场', date: '2023-11-25', status: 'future' },
        { label: '截标开标', date: '2023-12-10', status: 'future' }
      ],
      requirements: [
        '产品需通过 3C 认证',
        '注册资本金 1000 万以上'
      ]
    },
    {
      id: 'OPP-005',
      title: '年度员工福利礼品（端午/中秋）集采',
      type: 'inquiry',
      buyer: '智采云科技集团',
      budget: '80万',
      deadline: '2023-12-01',
      location: '全国',
      category: '福利礼品',
      status: 'open',
      publishDate: '2023-11-21',
      description: '2024年度端午节及中秋节员工福利礼品套餐，需支持全国 20 个城市分公司配送。',
      items: [
        { name: '端午礼盒', spec: '定制款 A/B', qty: 2000, unit: '份' },
        { name: '中秋礼盒', spec: '定制款 A/B', qty: 2000, unit: '份' }
      ],
      timeline: [
        { label: '发布询价', date: '2023-11-21', status: 'completed' },
        { label: '寄样截止', date: '2023-11-28', status: 'future' },
        { label: '选品定标', date: '2023-12-05', status: 'future' }
      ],
      requirements: [
        '食品类供应商需具备食品经营许可证',
        '具备全国物流配送能力'
      ]
    }
  ];

  const filteredList = opportunities.filter(item => {
    const typeMatch = filterType === 'all' || item.type === filterType;
    const searchMatch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || item.buyer.toLowerCase().includes(searchTerm.toLowerCase());
    return typeMatch && searchMatch;
  });

  const handleViewDetail = (opp: Opportunity) => {
    setSelectedOpp(opp);
    setView('detail');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedOpp(null);
  };

  const renderDetail = () => {
    if (!selectedOpp) return null;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <button onClick={handleBackToList} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                 <ChevronLeft size={24} />
              </button>
              <div>
                 <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                        selectedOpp.type === 'bidding' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                       {selectedOpp.type === 'bidding' ? '公开招标' : '询价采购'}
                    </span>
                    <h2 className="text-xl font-black text-slate-900">{selectedOpp.title}</h2>
                 </div>
                 <p className="text-sm text-slate-500 mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Building2 size={14} /> {selectedOpp.buyer}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span className="flex items-center gap-1"><MapPin size={14} /> {selectedOpp.location}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span>发布于 {selectedOpp.publishDate}</span>
                 </p>
              </div>
           </div>
           <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                 <Download size={18} /> 下载文件
              </button>
              <button 
                onClick={() => alert(selectedOpp.type === 'bidding' ? '已跳转至投标页面' : '已跳转至报价页面')}
                className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg transition-all"
              >
                 {selectedOpp.type === 'bidding' ? '立即报名' : '立即报价'} <ArrowRight size={18} />
              </button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Left Content */}
           <div className="lg:col-span-2 space-y-6">
              {/* Project Description */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <FileText className="text-blue-600" size={20} /> 项目概况
                 </h3>
                 <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {selectedOpp.description}
                 </p>
                 
                 <h4 className="font-bold text-slate-900 mt-8 mb-4 text-sm">采购清单</h4>
                 <div className="overflow-hidden border border-slate-100 rounded-xl">
                    <table className="w-full text-sm">
                       <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                          <tr>
                             <th className="px-4 py-3 text-left">名称</th>
                             <th className="px-4 py-3 text-left">规格型号</th>
                             <th className="px-4 py-3 text-center">数量</th>
                             <th className="px-4 py-3 text-center">单位</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {selectedOpp.items.map((item, i) => (
                             <tr key={i} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-bold text-slate-900">{item.name}</td>
                                <td className="px-4 py-3 text-slate-500">{item.spec}</td>
                                <td className="px-4 py-3 text-center">{item.qty}</td>
                                <td className="px-4 py-3 text-center">{item.unit}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>

              {/* Requirements */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <ShieldCheck className="text-blue-600" size={20} /> 资质要求
                 </h3>
                 <div className="space-y-2">
                    {selectedOpp.requirements.map((req, i) => (
                       <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                          <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" />
                          <span className="text-sm text-slate-700">{req}</span>
                       </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* Right Sidebar */}
           <div className="lg:col-span-1 space-y-6">
              {/* Key Info */}
              <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl">
                 <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Wallet size={20} className="text-orange-400" /> 关键信息
                 </h3>
                 <div className="space-y-4">
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">采购预算</p>
                       <p className="text-2xl font-black">{selectedOpp.budget}</p>
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">物资分类</p>
                       <p className="font-bold">{selectedOpp.category}</p>
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">截止时间</p>
                       <div className="flex items-center gap-2">
                          <Clock size={16} className="text-orange-400" />
                          <span className="font-bold text-orange-100">{selectedOpp.deadline}</span>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Timeline */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Calendar size={20} className="text-blue-600" /> 项目进度
                 </h3>
                 <div className="relative pl-4 border-l-2 border-slate-100 space-y-6">
                    {selectedOpp.timeline.map((step, i) => (
                       <div key={i} className="relative">
                          <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                             step.status === 'completed' ? 'bg-green-500' :
                             step.status === 'current' ? 'bg-blue-600 scale-125' :
                             'bg-slate-300'
                          }`}></div>
                          <p className={`text-sm font-bold ${step.status === 'future' ? 'text-slate-400' : 'text-slate-900'}`}>{step.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{step.date}</p>
                       </div>
                    ))}
                 </div>
              </div>

              {/* Tips */}
              <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                 <h4 className="font-bold text-blue-800 text-sm mb-2 flex items-center gap-2">
                    <AlertCircle size={16} /> 投标小贴士
                 </h4>
                 <p className="text-xs text-blue-700 leading-relaxed">
                    请仔细阅读招标文件中的技术规格书，确保所投产品完全符合参数要求。如有疑问，请在答疑截止日前在线提交。
                 </p>
              </div>
           </div>
        </div>
      </div>
    );
  };

  const renderList = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <LayoutGrid className="text-orange-600" size={24} />
            商机大厅
          </h1>
          <p className="text-sm text-slate-500 mt-1">汇聚全网优质采购需求，精准匹配商机</p>
        </div>
        <div className="flex gap-2">
           <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                全部
              </button>
              <button 
                onClick={() => setFilterType('inquiry')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${filterType === 'inquiry' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Megaphone size={16} /> 询价
              </button>
              <button 
                onClick={() => setFilterType('bidding')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${filterType === 'bidding' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Gavel size={16} /> 招标
              </button>
           </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
         <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="搜索项目关键词、采购商名称..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 transition-all"
            />
         </div>
         <div className="flex gap-3 w-full md:w-auto">
            <select className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none hover:border-orange-300 cursor-pointer">
               <option>所有地区</option>
               <option>上海</option>
               <option>江苏</option>
               <option>浙江</option>
            </select>
            <select className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none hover:border-orange-300 cursor-pointer">
               <option>所有品类</option>
               <option>IT设备</option>
               <option>办公用品</option>
               <option>工程服务</option>
            </select>
         </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-4">
         {filteredList.map((item) => (
            <div 
              key={item.id} 
              onClick={() => handleViewDetail(item)}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-200 transition-all group cursor-pointer"
            >
               <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="flex items-start gap-4">
                     <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                        item.type === 'bidding' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                     }`}>
                        {item.type === 'bidding' ? <Gavel size={28} /> : <Megaphone size={28} />}
                     </div>
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                           <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                              item.type === 'bidding' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                           }`}>
                              {item.type === 'bidding' ? '公开招标' : '询价采购'}
                           </span>
                           <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{item.category}</span>
                           <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={10} /> {item.publishDate} 发布</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-orange-600 transition-colors">{item.title}</h3>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-sm text-slate-500">
                           <span className="flex items-center gap-1.5"><Building2 size={16} className="text-slate-400"/> {item.buyer}</span>
                           <span className="flex items-center gap-1.5"><MapPin size={16} className="text-slate-400"/> {item.location}</span>
                        </div>
                     </div>
                  </div>
                  
                  <div className="flex flex-row md:flex-col items-center md:items-end gap-2 md:gap-1 pl-18 md:pl-0 border-t md:border-t-0 border-slate-50 pt-4 md:pt-0">
                     <div className="flex-1 md:flex-none">
                        <p className="text-xs font-bold text-slate-400 uppercase text-right">预算金额</p>
                        <p className="text-xl font-black text-slate-900 text-right">{item.budget}</p>
                     </div>
                     <div className="hidden md:block h-px w-24 bg-slate-100 my-1"></div>
                     <div className="flex-1 md:flex-none flex justify-end">
                        <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded flex items-center gap-1">
                           <Clock size={12} /> 截止: {item.deadline}
                        </span>
                     </div>
                  </div>
               </div>
               
               <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
                  <button className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                     查看详情
                  </button>
                  <button className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg flex items-center gap-2 transition-all">
                     立即参与 <ArrowRight size={16} />
                  </button>
               </div>
            </div>
         ))}
         {filteredList.length === 0 && (
            <div className="py-20 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
               <Search size={48} className="mx-auto mb-4 opacity-20" />
               <p>未找到符合条件的商机</p>
            </div>
         )}
      </div>
    </div>
  );

  return view === 'detail' ? renderDetail() : renderList();
};

export default SupplierBusinessHall;
