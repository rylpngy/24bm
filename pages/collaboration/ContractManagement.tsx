
import React, { useState } from 'react';
import { 
  FileText, Signature, CheckCircle, Clock, Shield, Search, Filter, Download, 
  ArrowLeft, Printer, Building2, User, Receipt, Link as LinkIcon, MessageSquareQuote, Gavel, ShoppingBag, ArrowRight, History
} from 'lucide-react';

const ContractManagement: React.FC = () => {
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  const contracts = [
    { id: 'CON-001', name: '2023年度原料框架协议', supplier: '上海宏达工业', amount: '按实结算', status: '已签署', signDate: '2023-01-15' },
    { id: 'CON-002', name: '办公设备维保合同', supplier: '北京神州科技', amount: '¥ 12,000', status: '签署中', signDate: '进行中' },
    { id: 'CON-003', name: '物流运输服务合同', supplier: '顺丰速运', amount: '¥ 250,000', status: '已签署', signDate: '2023-05-20' },
    { id: 'CON-004', name: '核心机房服务器采购合同', supplier: '浪潮信息', amount: '¥ 1,250,000', status: '待审核', signDate: '-' },
  ];

  const renderContractDetail = () => {
    // Mock Data representing a contract derived from an Inquiry
    const contract = {
      id: 'CON-001',
      name: '2023年度原料框架协议',
      status: '已签署',
      amount: '¥ 2,450,000',
      signDate: '2023-01-15',
      validity: '2023-01-15 至 2024-01-14',
      type: '框架协议',
      parties: {
        buyer: '智采云科技集团',
        supplier: '上海宏达工业有限公司',
        supplierContact: '张经理 (13800138000)'
      },
      // Traceability Data: The link to the previous sourcing activity
      source: {
        type: 'inquiry', // inquiry, bidding, mall
        projectId: 'RFQ-20221220-05',
        projectTitle: '2023年度Q1季度核心原料集中采购询价',
        awardDate: '2023-01-10',
        awardReason: '综合评分最高 (92分)，价格处于中位但交付承诺最优',
        quoteAmount: '¥ 2,450,000',
        savings: '12%'
      },
      timeline: [
        { date: '2023-01-10 14:00', event: '寻源定标', desc: '询价项目 RFQ-20221220-05 完成定标' },
        { date: '2023-01-11 09:30', event: '合同起草', desc: '采购部生成合同草稿' },
        { date: '2023-01-12 10:15', event: '法务审核', desc: '合规性扫描通过，条款无风险' },
        { date: '2023-01-13 16:00', event: '供应商签署', desc: '上海宏达工业 完成电子签章' },
        { date: '2023-01-15 09:00', event: '归档生效', desc: '我方完成签署，合同正式生效' }
      ]
    };

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <button onClick={() => setSelectedContractId(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                 <ArrowLeft size={24} />
              </button>
              <div>
                 <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-slate-900">{contract.name}</h2>
                    <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-black rounded uppercase border border-green-100 flex items-center gap-1">
                       <CheckCircle size={12} /> {contract.status}
                    </span>
                 </div>
                 <p className="text-sm text-slate-500 mt-1">合同编号: {contract.id} · 类型: {contract.type}</p>
              </div>
           </div>
           <div className="flex gap-3">
              <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                 <Printer size={18} /> 打印
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2">
                 <Download size={18} /> 下载电子件
              </button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Left Column: Contract Details */}
           <div className="lg:col-span-2 space-y-6">
              {/* Sourcing Traceability Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                    <LinkIcon size={120} />
                 </div>
                 <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <History size={16} /> 采购寻源链路追溯
                 </h3>
                 
                 <div className="flex items-center gap-6 relative z-10">
                    {/* Source Node */}
                    <div className="flex-1 bg-white/10 rounded-2xl p-4 border border-white/10">
                       <div className="flex items-center gap-2 mb-2">
                          {contract.source.type === 'inquiry' && <MessageSquareQuote size={18} className="text-yellow-400" />}
                          {contract.source.type === 'bidding' && <Gavel size={18} className="text-yellow-400" />}
                          {contract.source.type === 'mall' && <ShoppingBag size={18} className="text-yellow-400" />}
                          <span className="text-xs font-bold text-slate-300 uppercase">
                             来源: {contract.source.type === 'inquiry' ? '询比价' : contract.source.type === 'bidding' ? '公开招标' : '商城直采'}
                          </span>
                       </div>
                       <p className="font-bold text-sm truncate" title={contract.source.projectTitle}>{contract.source.projectTitle}</p>
                       <p className="text-xs text-slate-400 font-mono mt-1">{contract.source.projectId}</p>
                    </div>

                    <ArrowRight className="text-slate-500" />

                    {/* Result Node */}
                    <div className="flex-1 bg-white/10 rounded-2xl p-4 border border-white/10">
                       <div className="flex items-center gap-2 mb-2">
                          <CheckCircle size={18} className="text-green-400" />
                          <span className="text-xs font-bold text-slate-300 uppercase">定标结果</span>
                       </div>
                       <p className="font-bold text-sm">中标金额: {contract.source.quoteAmount}</p>
                       <p className="text-xs text-green-400 mt-1">较预算节约 {contract.source.savings}</p>
                    </div>
                 </div>

                 <div className="mt-4 pt-4 border-t border-white/10 text-xs text-slate-400 flex gap-2">
                    <span className="font-bold text-slate-300">定标决策依据:</span>
                    <span>{contract.source.awardReason}</span>
                 </div>
              </div>

              {/* Document Preview Placeholder */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[500px] flex flex-col">
                 <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                       <FileText size={20} className="text-blue-600"/> 合同正文条款
                    </h3>
                    <div className="text-xs text-slate-500">共 24 页 · 已签署归档</div>
                 </div>
                 
                 {/* Mock Content */}
                 <div className="flex-1 bg-slate-50 rounded-xl p-8 border border-slate-100 text-slate-600 text-sm leading-8 font-serif">
                    <p className="font-bold text-center text-lg text-slate-900 mb-8">年度原材料采购框架协议</p>
                    <p className="mb-4"><span className="font-bold">甲方（买方）：</span>{contract.parties.buyer}</p>
                    <p className="mb-4"><span className="font-bold">乙方（卖方）：</span>{contract.parties.supplier}</p>
                    <p className="mb-4">鉴于甲方希望从乙方采购原材料，乙方愿意向甲方提供该等原材料。双方经友好协商，达成如下协议：</p>
                    <p className="mb-4 font-bold">第一条 采购范围与价格</p>
                    <p className="mb-4">1.1 本协议项下的原材料包括但不限于聚丙烯、聚乙烯等，具体规格详见附件采购清单。</p>
                    <p className="mb-4">1.2 价格依据甲方于 {contract.source.awardDate} 发起的 {contract.source.projectId} 项目中标结果执行，即人民币 {contract.amount}（含税）。</p>
                    <p className="mb-4 font-bold">第二条 交付与验收</p>
                    <p className="mb-4">2.1 乙方应按照甲方发出的具体采购订单（PO）规定的时间、地点交付货物。</p>
                    <p className="text-center text-slate-400 mt-8 italic">- 以下省略 20 页 -</p>
                    
                    {/* Signature Area */}
                    <div className="mt-12 flex justify-between">
                       <div className="relative">
                          <p className="font-bold mb-8">甲方代表签字：</p>
                          <p>日期：{contract.signDate}</p>
                          <div className="absolute -top-6 left-10 w-32 h-32 border-4 border-red-500 rounded-full flex items-center justify-center opacity-60 rotate-12 pointer-events-none">
                             <div className="w-24 h-24 border border-red-500 rounded-full flex items-center justify-center">
                                <span className="text-red-500 text-xs font-black">智采云合同专用章</span>
                             </div>
                          </div>
                       </div>
                       <div className="relative">
                          <p className="font-bold mb-8">乙方代表签字：</p>
                          <p>日期：{contract.signDate}</p>
                          <div className="absolute -top-6 left-10 w-32 h-32 border-4 border-red-500 rounded-full flex items-center justify-center opacity-60 -rotate-6 pointer-events-none">
                             <div className="w-24 h-24 border border-red-500 rounded-full flex items-center justify-center">
                                <span className="text-red-500 text-xs font-black">上海宏达合同专用章</span>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Right Column: Meta Info */}
           <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Building2 size={20} className="text-blue-600"/> 签约方信息
                 </h3>
                 <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <p className="text-xs font-bold text-slate-400 uppercase mb-2">供应商 (乙方)</p>
                       <p className="font-bold text-slate-900 mb-1">{contract.parties.supplier}</p>
                       <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">
                          <User size={12} /> {contract.parties.supplierContact}
                       </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <p className="text-xs font-bold text-slate-400 uppercase mb-2">采购方 (甲方)</p>
                       <p className="font-bold text-slate-900 mb-1">{contract.parties.buyer}</p>
                       <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">
                          <User size={12} /> 采购部-张建国
                       </div>
                    </div>
                 </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Receipt size={20} className="text-blue-600"/> 商务条款摘要
                 </h3>
                 <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-50">
                       <span className="text-slate-500">合同总额</span>
                       <span className="font-black text-slate-900">{contract.amount}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                       <span className="text-slate-500">有效期</span>
                       <span className="font-medium text-slate-900 text-right w-32">{contract.validity}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-50">
                       <span className="text-slate-500">付款方式</span>
                       <span className="font-medium text-slate-900">月结 60 天</span>
                    </div>
                    <div className="flex justify-between py-2">
                       <span className="text-slate-500">履约保证金</span>
                       <span className="font-medium text-slate-900">已缴纳 (¥50,000)</span>
                    </div>
                 </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Clock size={20} className="text-blue-600"/> 签约全流程日志
                 </h3>
                 <div className="pl-4 border-l-2 border-slate-100 space-y-6">
                    {contract.timeline.map((log, i) => (
                       <div key={i} className="relative">
                          <div className="absolute -left-[21px] top-1 w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-sm"></div>
                          <p className="text-xs text-slate-400 font-mono mb-0.5">{log.date}</p>
                          <p className="text-sm font-bold text-slate-900">{log.event}</p>
                          <p className="text-xs text-slate-500 mt-1">{log.desc}</p>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  if (selectedContractId) return renderContractDetail();

  return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <FileText className="text-blue-600" size={24} />
              合同管理
            </h1>
            <p className="text-sm text-slate-500 mt-1">支持全流程电子签章、合同合规性审查及履约监控。</p>
          </div>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-md transition-all">
            <Signature size={18} />
            起草电子合同
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><FileText size={24} /></div>
            <div><p className="text-sm text-slate-500 font-bold">累计签署</p><p className="text-2xl font-black text-slate-900">156 份</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-orange-50 text-orange-600 rounded-xl"><Clock size={24} /></div>
            <div><p className="text-sm text-slate-500 font-bold">待我签署</p><p className="text-2xl font-black text-slate-900">4 份</p></div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-green-50 text-green-600 rounded-xl"><Shield size={24} /></div>
            <div><p className="text-sm text-slate-500 font-bold">合规扫描正常</p><p className="text-2xl font-black text-slate-900">100%</p></div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 flex gap-4 border-b border-slate-50 bg-slate-50/50">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="搜索合同编号、名称、签署方..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium" />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              <Filter size={18} />
              筛选
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-left">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase w-20 text-center whitespace-nowrap">序号</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase">合同名称</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase">签约供应商</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase">合同金额</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase">状态</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase">签署时间</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contracts.map((c, idx) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-center font-bold text-slate-400">{idx + 1}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{c.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">{c.id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">{c.supplier}</td>
                  <td className="px-6 py-4 font-black text-slate-900">{c.amount}</td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold w-fit ${
                      c.status === '已签署' ? 'bg-green-50 text-green-700 border border-green-100' : 
                      c.status === '待审核' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}>
                      {c.status === '已签署' ? <CheckCircle size={12} /> : <Clock size={12} />}
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-medium">{c.signDate}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => setSelectedContractId(c.id)}
                        className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors"
                      >
                        查看
                      </button>
                      <button className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><Download size={16} /></button>
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
