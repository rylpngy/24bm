
import React, { useState } from 'react';
import { 
  ChevronLeft, Printer, Download, CreditCard, Landmark, History, Receipt, Building2, ArrowRight, FileText, Coins, Briefcase, AlertTriangle, CheckCircle2, Search
} from 'lucide-react';

const SupplierFinance: React.FC = () => {
  const [selectedFinanceId, setSelectedFinanceId] = useState<string | null>(null);

  const financeRecords = [
    { id: 'PAY-2023001', supplier: '苏州精控机械有限公司', type: '平台入驻年费', amount: 5800, status: '已缴纳', date: '2023-10-15' },
    { id: 'PAY-2023005', supplier: '杭州大和电子', type: '项目投标保证金', amount: 20000, status: '待缴纳', date: '2023-10-20' },
    { id: 'PAY-2023012', supplier: '上海宏博贸易', type: '项目投标保证金', amount: 50000, status: '已退还', date: '2023-09-01' },
    { id: 'PAY-2023018', supplier: '无锡恒润科技', type: '履约保证金', amount: 100000, status: '已缴纳', date: '2023-08-15' },
  ];

  const renderFinanceDetail = () => {
      const record = financeRecords.find(r => r.id === selectedFinanceId);
      if (!record) return null;

      // Extended mock data for detail view
      const detail = {
          ...record,
          transactionId: 'TRX-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          payer: '智采云科技集团',
          payee: record.supplier,
          bankAccount: '6222 **** **** 8888',
          bankName: '招商银行上海分行',
          method: '银行转账',
          invoiceNo: 'INV-2023-' + record.id.split('-')[1],
          notes: '2023年度供应商入驻技术服务费，含平台使用权及数据服务。',
          attachments: [
              { name: '电子回单.pdf', size: '1.2MB' },
              { name: '增值税专用发票.pdf', size: '0.8MB' }
          ],
          timeline: [
              { status: 'created', label: '账单生成', time: '2023-10-10 09:00', operator: '系统自动' },
              { status: 'pending', label: '财务审核', time: '2023-10-12 14:30', operator: '李财务' },
              { status: 'paid', label: '确认到账', time: record.date + ' 10:15', operator: '系统对接' },
              { status: 'completed', label: '对账完成', time: record.date + ' 16:00', operator: '王会计' }
          ]
      };

      return (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              {/* Header */}
              <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-4">
                      <button onClick={() => setSelectedFinanceId(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                          <ChevronLeft size={24} />
                      </button>
                      <div>
                          <div className="flex items-center gap-3">
                              <h2 className="text-xl font-black text-slate-900">费用详情: {detail.type}</h2>
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${
                                  detail.status === '已缴纳' ? 'bg-green-50 text-green-700 border-green-100' : 
                                  detail.status === '已退还' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                                  'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                  {detail.status}
                              </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">流水号: {detail.transactionId} · 日期: {detail.date}</p>
                      </div>
                  </div>
                  <div className="flex gap-3">
                      <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                          <Printer size={18} /> 打印回单
                      </button>
                      <button className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">
                          <Download size={18} /> 下载发票
                      </button>
                  </div>
              </div>

              {/* Top Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                      <p className="text-xs font-bold text-slate-400 uppercase">交易金额</p>
                      <p className="text-3xl font-black text-slate-900 tracking-tight">¥{detail.amount.toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                      <p className="text-xs font-bold text-slate-400 uppercase">付款方</p>
                      <p className="font-bold text-slate-900 truncate" title={detail.payer}>{detail.payer}</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                      <p className="text-xs font-bold text-slate-400 uppercase">收款方</p>
                      <p className="font-bold text-slate-900 truncate" title={detail.payee}>{detail.payee}</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                      <p className="text-xs font-bold text-slate-400 uppercase">支付方式</p>
                      <p className="font-bold text-slate-900 flex items-center gap-2">
                          <Landmark size={16} className="text-blue-600" /> {detail.method}
                      </p>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Details & Timeline */}
                  <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                              <History className="text-blue-600" size={20} /> 交易时间轴
                          </h3>
                          <div className="relative flex justify-between items-start">
                              <div className="absolute left-0 right-0 top-3 h-1 bg-slate-100 -z-0 mx-8"></div>
                              {detail.timeline.map((step, idx) => (
                                  <div key={idx} className="relative z-10 flex flex-col items-center">
                                      <div className={`w-8 h-8 rounded-full border-4 flex items-center justify-center bg-white ${
                                          idx === detail.timeline.length - 1 ? 'border-green-500 text-green-600' : 'border-blue-600 text-blue-600'
                                      }`}>
                                          <div className={`w-2.5 h-2.5 rounded-full ${idx === detail.timeline.length - 1 ? 'bg-green-500' : 'bg-blue-600'}`}></div>
                                      </div>
                                      <p className="text-xs font-bold text-slate-900 mt-2">{step.label}</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">{step.time}</p>
                                      <p className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded mt-1">{step.operator}</p>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                              <Receipt className="text-blue-600" size={20} /> 交易明细
                          </h3>
                          <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <div>
                                      <p className="text-xs text-slate-500 mb-1">收款银行</p>
                                      <p className="font-bold text-slate-900">{detail.bankName}</p>
                                  </div>
                                  <div>
                                      <p className="text-xs text-slate-500 mb-1">收款账号</p>
                                      <p className="font-mono font-bold text-slate-900">{detail.bankAccount}</p>
                                  </div>
                                  <div>
                                      <p className="text-xs text-slate-500 mb-1">关联发票号</p>
                                      <p className="font-mono font-bold text-slate-900">{detail.invoiceNo}</p>
                                  </div>
                                  <div>
                                      <p className="text-xs text-slate-500 mb-1">费用说明</p>
                                      <p className="text-sm font-medium text-slate-900">{detail.notes}</p>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Right Column: Supplier & Files */}
                  <div className="space-y-6">
                      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                              <Building2 className="text-blue-600" size={20} /> 供应商信息
                          </h3>
                          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                              <p className="font-bold text-slate-900 text-sm mb-1">{detail.supplier}</p>
                              <div 
                                className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-2"
                              >
                                  供应商 ID: {record.id}
                              </div>
                          </div>
                      </div>

                      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                              <FileText className="text-blue-600" size={20} /> 附件列表
                          </h3>
                          <div className="space-y-3">
                              {detail.attachments.map((file, i) => (
                                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-300 transition-colors group cursor-pointer">
                                      <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-red-500 shadow-sm">
                                              <FileText size={16} />
                                          </div>
                                          <div>
                                              <p className="text-xs font-bold text-slate-700">{file.name}</p>
                                              <p className="text-[10px] text-slate-400">{file.size}</p>
                                          </div>
                                      </div>
                                      <button className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Download size={16} />
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  if (selectedFinanceId) {
      return renderFinanceDetail();
  }

  return (
       <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
             <div>
                <h1 className="text-xl font-black text-slate-900">费用与资金管理</h1>
                <p className="text-sm text-slate-500 mt-1">管理供应商入库年费、项目报名费及保证金缴纳状态</p>
             </div>
             <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-200">
                <Coins size={18} />
                发起催缴
             </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                   <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><CreditCard size={20} /></div>
                   <span className="text-sm font-bold text-slate-500">本月入账总额</span>
                </div>
                <p className="text-2xl font-black text-slate-900">¥ 125,400</p>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                   <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Briefcase size={20} /></div>
                   <span className="text-sm font-bold text-slate-500">保证金沉淀池</span>
                </div>
                <p className="text-2xl font-black text-slate-900">¥ 2,500,000</p>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                   <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><AlertTriangle size={20} /></div>
                   <span className="text-sm font-bold text-slate-500">逾期未缴金额</span>
                </div>
                <p className="text-2xl font-black text-amber-500">¥ 12,000</p>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                   <div className="p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle2 size={20} /></div>
                   <span className="text-sm font-bold text-slate-500">缴纳率</span>
                </div>
                <p className="text-2xl font-black text-slate-900">94.5%</p>
             </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex gap-4">
                   <select className="bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg px-3 py-2 outline-none">
                      <option>所有费用类型</option>
                      <option>平台入驻年费</option>
                      <option>投标保证金</option>
                      <option>项目报名费</option>
                   </select>
                   <select className="bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg px-3 py-2 outline-none">
                      <option>所有状态</option>
                      <option>已缴纳</option>
                      <option>待缴纳</option>
                      <option>已退还</option>
                   </select>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" placeholder="搜索供应商或流水号" className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none w-64" />
                </div>
             </div>
             <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-left">
                   <tr>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase w-16 text-center whitespace-nowrap">序号</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase">供应商名称</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase">费用科目</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase text-right">金额</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">状态</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase">更新时间</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {financeRecords.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-4 text-center font-bold text-slate-400 whitespace-nowrap">
                            {i + 1}
                         </td>
                         <td className="px-6 py-4">
                            <div className="font-bold text-slate-900">{item.supplier}</div>
                            <div className="text-xs text-slate-400 font-mono">{item.id}</div>
                         </td>
                         <td className="px-6 py-4">
                            <span className="font-medium text-slate-700">{item.type}</span>
                         </td>
                         <td className="px-6 py-4 text-right">
                            <span className="font-mono font-bold text-slate-900">¥{item.amount.toLocaleString()}</span>
                         </td>
                         <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                               item.status === '已缴纳' ? 'bg-green-100 text-green-700' :
                               item.status === '待缴纳' ? 'bg-amber-100 text-amber-700' :
                               'bg-blue-100 text-blue-700'
                            }`}>
                               {item.status}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-slate-500">{item.date}</td>
                         <td className="px-6 py-4 text-center">
                            <button 
                                onClick={() => setSelectedFinanceId(item.id)}
                                className="text-blue-600 font-bold hover:underline"
                            >
                                详情
                            </button>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
       </div>
  );
};

export default SupplierFinance;
