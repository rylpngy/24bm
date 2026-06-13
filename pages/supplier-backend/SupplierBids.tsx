
import React, { useState } from 'react';
import { 
  Search, Gavel, Clock, FileText, CheckCircle2, XCircle, ArrowLeft, 
  Building2, User, MapPin, Download, Send, Printer, FileCheck, HelpCircle 
} from 'lucide-react';

const SupplierBids: React.FC = () => {
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null);

  const bids = [
    { 
      id: 'BID-20231105-01', 
      title: '集团2024年度核心机房服务器集群扩容项目', 
      buyer: '智采云科技集团', 
      deadline: '2023-11-20', 
      status: '投标中', 
      myPrice: 2850000,
      publishDate: '2023-11-01',
      location: '上海市浦东新区张江高科',
      contact: '张工 (021-88889999)',
      items: [
        { name: '高性能计算节点服务器', spec: '2*Xeon Gold 6248, 512G RAM', qty: 10, unit: '台', price: 180000 },
        { name: '分布式存储节点', spec: '200TB RAW Capacity', qty: 5, unit: '台', price: 150000 },
        { name: '数据中心交换机', spec: '48*10G + 6*100G', qty: 2, unit: '台', price: 80000 },
        { name: '安装调试与迁移服务', spec: '原厂工程师上门', qty: 1, unit: '项', price: 140000 }
      ],
      timeline: [
        { status: 'completed', label: '收到邀请', time: '2023-11-01 09:00' },
        { status: 'completed', label: '确认参与', time: '2023-11-02 14:30' },
        { status: 'current', label: '提交投标文件', time: '2023-11-05 10:15' },
        { status: 'pending', label: '开标评标', time: '预计 2023-11-21' },
        { status: 'pending', label: '结果公示', time: '待定' }
      ]
    },
    { 
      id: 'BID-20231028-09', 
      title: '生产基地自动化流水线改造工程', 
      buyer: '智采云 - 生产部', 
      deadline: '2023-10-30', 
      status: '已截标', 
      myPrice: 1200000,
      publishDate: '2023-10-15',
      location: '江苏省苏州市工业园区',
      contact: '李经理 (13900001111)',
      items: [
        { name: '自动化传送带系统', spec: '定制 L=500m', qty: 1, unit: '套', price: 800000 },
        { name: '工业机械臂', spec: '六轴 负载10kg', qty: 4, unit: '台', price: 100000 }
      ],
      timeline: [
        { status: 'completed', label: '报名', time: '2023-10-15' },
        { status: 'completed', label: '投标', time: '2023-10-28' },
        { status: 'current', label: '评标中', time: '进行中' }
      ]
    },
    { 
      id: 'BID-20230915-02', 
      title: '全国物流运输干线承运招标', 
      buyer: '智采云 - 物流部', 
      deadline: '2023-09-20', 
      status: '未中标', 
      myPrice: 580000,
      publishDate: '2023-09-01',
      location: '全国',
      contact: '王总监',
      items: [
        { name: '华东-华南干线运输', spec: '17.5米高栏', qty: 100, unit: '车次', price: 5800 }
      ],
      timeline: [
        { status: 'completed', label: '投标', time: '2023-09-15' },
        { status: 'completed', label: '开标', time: '2023-09-21' },
        { status: 'completed', label: '未中标', time: '2023-09-25' }
      ]
    },
  ];

  const renderBidDetail = () => {
    const bid = bids.find(b => b.id === selectedBidId);
    if (!bid) return null;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <button onClick={() => setSelectedBidId(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                 <ArrowLeft size={24} />
              </button>
              <div>
                 <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-slate-900">{bid.title}</h2>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                        bid.status === '投标中' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                        bid.status === '已截标' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                       {bid.status}
                    </span>
                 </div>
                 <p className="text-sm text-slate-500 mt-1">项目编号: {bid.id} · 截止时间: {bid.deadline}</p>
              </div>
           </div>
           <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                 <Download size={18} /> 下载招标文件
              </button>
              {bid.status === '投标中' && (
                <button className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-800 shadow-lg transition-all">
                   <Send size={18} /> 修改报价
                </button>
              )}
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Left Column: Quote Details */}
           <div className="lg:col-span-2 space-y-6">
              {/* My Quote Card */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Gavel size={20} className="text-orange-600" /> 我的报价单
                 </h3>
                 
                 <div className="flex items-end justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100 mb-6">
                    <div>
                       <p className="text-xs font-bold text-orange-400 uppercase mb-1">投标总价 (含税)</p>
                       <p className="text-3xl font-black text-orange-600">¥{bid.myPrice.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-bold text-orange-400 uppercase mb-1">报价时间</p>
                       <p className="font-bold text-orange-800">2023-11-05 10:15:23</p>
                    </div>
                 </div>

                 <div className="overflow-hidden border border-slate-100 rounded-xl">
                    <table className="w-full text-sm">
                       <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                          <tr>
                             <th className="px-4 py-3 text-left">物资名称</th>
                             <th className="px-4 py-3 text-left">规格型号</th>
                             <th className="px-4 py-3 text-center">数量</th>
                             <th className="px-4 py-3 text-center">单位</th>
                             <th className="px-4 py-3 text-right">单价</th>
                             <th className="px-4 py-3 text-right">小计</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {bid.items.map((item, i) => (
                             <tr key={i} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-bold text-slate-900">{item.name}</td>
                                <td className="px-4 py-3 text-slate-600 text-xs">{item.spec}</td>
                                <td className="px-4 py-3 text-center">{item.qty}</td>
                                <td className="px-4 py-3 text-center text-slate-500">{item.unit}</td>
                                <td className="px-4 py-3 text-right font-mono">¥{item.price.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">¥{(item.price * item.qty).toLocaleString()}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
                 
                 <div className="mt-6 space-y-3">
                    <h4 className="text-sm font-bold text-slate-900">商务条款响应</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                       <div className="p-3 border border-slate-100 rounded-xl flex justify-between">
                          <span className="text-slate-500">付款方式</span>
                          <span className="font-bold text-slate-900">接受 (月结60天)</span>
                       </div>
                       <div className="p-3 border border-slate-100 rounded-xl flex justify-between">
                          <span className="text-slate-500">交货周期</span>
                          <span className="font-bold text-slate-900">承诺 15 天内</span>
                       </div>
                       <div className="p-3 border border-slate-100 rounded-xl flex justify-between">
                          <span className="text-slate-500">质保期</span>
                          <span className="font-bold text-slate-900">3 年原厂质保</span>
                       </div>
                       <div className="p-3 border border-slate-100 rounded-xl flex justify-between">
                          <span className="text-slate-500">发票类型</span>
                          <span className="font-bold text-slate-900">增值税专用发票 (13%)</span>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Attachments */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <FileCheck size={20} className="text-blue-600" /> 投标文件附件
                 </h3>
                 <div className="space-y-3">
                    {['技术标书_v1.0.pdf', '商务标书_盖章版.pdf', '资质证明文件包.zip'].map((file, i) => (
                       <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-blue-50 transition-colors group cursor-pointer border border-transparent hover:border-blue-100">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 shadow-sm group-hover:text-blue-600">
                                <FileText size={16} />
                             </div>
                             <span className="text-sm font-bold text-slate-700">{file}</span>
                          </div>
                          <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded hidden group-hover:inline-block">已上传</span>
                       </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* Right Column: Info & Process */}
           <div className="lg:col-span-1 space-y-6">
              {/* Buyer Info */}
              <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
                 <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Building2 size={20} className="text-blue-400" /> 招标方信息
                 </h3>
                 <div className="space-y-4 text-sm">
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">采购单位</p>
                       <p className="font-bold">{bid.buyer}</p>
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">项目联系人</p>
                       <div className="flex items-center gap-2">
                          <User size={14} className="text-slate-400" />
                          <span>{bid.contact}</span>
                       </div>
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">交货/服务地点</p>
                       <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-slate-400" />
                          <span>{bid.location}</span>
                       </div>
                    </div>
                 </div>
                 <div className="mt-6 pt-4 border-t border-white/10">
                    <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2">
                       <HelpCircle size={14} /> 在线咨询提问
                    </button>
                 </div>
              </div>

              {/* Timeline */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Clock size={20} className="text-blue-600" /> 项目进度
                 </h3>
                 <div className="relative pl-4 border-l-2 border-slate-100 space-y-6">
                    {bid.timeline.map((step, i) => (
                       <div key={i} className="relative">
                          <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                             step.status === 'completed' ? 'bg-green-500' : 
                             step.status === 'current' ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'
                          }`}></div>
                          <p className={`text-sm font-bold ${step.status === 'pending' ? 'text-slate-400' : 'text-slate-900'}`}>{step.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{step.time}</p>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  if (selectedBidId) return renderBidDetail();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Gavel className="text-orange-600" size={24} />
            我的投标
          </h1>
          <p className="text-sm text-slate-500 mt-1">管理参与的公开招标与邀请招标项目</p>
        </div>
        <div className="flex gap-3">
           <button className="px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 shadow-lg shadow-orange-200">
              前往大厅找商机
           </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex gap-2">
               {['全部', '投标中', '待开标', '已中标', '未中标'].map(tab => (
                   <button key={tab} className="px-4 py-1.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-white hover:shadow-sm transition-all">{tab}</button>
               ))}
            </div>
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
               <input type="text" placeholder="搜索项目名称..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none w-64" />
            </div>
         </div>
         
         <div className="divide-y divide-slate-100">
            {bids.map((bid, i) => (
               <div key={i} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer" onClick={() => setSelectedBidId(bid.id)}>
                  <div className="flex items-start gap-4">
                     <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
                        <Gavel size={24} />
                     </div>
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                           <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                               bid.status === '投标中' ? 'bg-green-100 text-green-700' : 
                               bid.status === '已截标' ? 'bg-slate-100 text-slate-500' : 'bg-red-50 text-red-600'
                           }`}>
                               {bid.status}
                           </span>
                           <span className="text-xs text-slate-400 font-mono">{bid.id}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-orange-600 transition-colors">{bid.title}</h3>
                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-4">
                           <span className="flex items-center gap-1"><Clock size={14} /> 截止: {bid.deadline}</span>
                           <span className="flex items-center gap-1 font-medium">我的报价: ¥{bid.myPrice.toLocaleString()}</span>
                        </p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4">
                      {bid.status === '未中标' ? (
                          <div className="text-right">
                              <p className="text-xs font-bold text-slate-400">中标单位</p>
                              <p className="text-sm font-bold text-slate-700">xx科技有限公司</p>
                          </div>
                      ) : (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedBidId(bid.id); }}
                            className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 text-xs"
                        >
                            查看详情
                        </button>
                      )}
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default SupplierBids;
