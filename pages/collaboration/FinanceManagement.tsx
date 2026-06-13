
import React, { useState } from 'react';
import { 
  Receipt, CreditCard, AlertTriangle, CheckSquare, FileCheck, ArrowLeft, Ban, CheckCircle, Scale,
  Landmark, Clock, Link, FileText, Package, ChevronRight
} from 'lucide-react';

const FinanceManagement: React.FC = () => {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const invoices = [
     { id: 'INV-2023110101', po: 'PO-20231025-012', supplier: '戴尔(中国)有限公司', amount: 125000, dueDate: '2023-11-25', status: '待付款' },
     { id: 'INV-2023102805', po: 'PO-20231028-005', supplier: '晨光科力普', amount: 4500, dueDate: '2023-11-28', status: '已付款' },
     { id: 'INV-2023102003', po: 'PO-20231020-003', supplier: '顺丰速运', amount: 12000, dueDate: '2023-11-20', status: '已付款' },
  ];

  const renderFinanceDetail = () => {
    const invoice = {
       id: 'INV-2023110101',
       po: 'PO-20231025-012',
       supplier: '戴尔(中国)有限公司',
       amount: 125000,
       dueDate: '2023-11-25',
       status: '待付款',
       invoiceDate: '2023-11-01',
       bankInfo: {
          accountName: '戴尔(中国)有限公司',
          bankName: '中国银行厦门分行',
          accountNo: '3510 **** **** 8888'
       },
       matchStatus: {
          poAmount: 125000,
          receiptAmount: 125000,
          invoiceAmount: 125000,
          isMatched: true
       },
       approvalFlow: [
          { step: '发票录入', user: '财务专员-王五', status: 'completed', time: '11-01 10:00' },
          { step: '三单匹配', user: '系统自动', status: 'completed', time: '11-01 10:05' },
          { step: '部门审批', user: 'IT部经理', status: 'current', time: '处理中' },
          { step: '财务复核', user: '财务总监', status: 'pending' },
          { step: '出纳付款', user: '待定', status: 'pending' }
       ],
       items: [
         { name: 'Latitude 笔记本电脑', spec: 'i7/16G/512G', qty: 15, unit: '台', price: 8333.33, total: 125000 }
       ]
    };

    return (
       <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          {/* Header */}
          <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
             <div className="flex items-center gap-4">
                <button onClick={() => setSelectedInvoiceId(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                   <ArrowLeft size={24} />
                </button>
                <div>
                   <div className="flex items-center gap-3">
                      <h2 className="text-xl font-black text-slate-900">付款单详情</h2>
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-black rounded uppercase border border-amber-100 flex items-center gap-1">
                         <CreditCard size={12} /> {invoice.status}
                      </span>
                   </div>
                   <p className="text-sm text-slate-500 mt-1">发票号: {invoice.id} · 供应商: {invoice.supplier}</p>
                </div>
             </div>
             <div className="flex gap-3">
                <button className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-bold hover:bg-red-100 flex items-center gap-2">
                   <Ban size={18} /> 驳回申请
                </button>
                <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg flex items-center gap-2">
                   <CheckCircle size={18} /> 批准付款
                </button>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             {/* Left Column */}
             <div className="lg:col-span-2 space-y-6">
                {/* 3-Way Match Card */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <Scale className="text-blue-600" size={20} /> 三单匹配校验 (3-Way Matching)
                   </h3>
                   <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center relative">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">采购订单 (PO)</p>
                          <p className="font-black text-slate-900">¥{invoice.matchStatus.poAmount.toLocaleString()}</p>
                          <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 bg-white border border-green-200 rounded-full flex items-center justify-center text-green-500 z-10 shadow-sm">
                             <CheckCircle size={14} />
                          </div>
                      </div>
                      <div className="flex-1 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center relative">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">入库单 (Receipt)</p>
                          <p className="font-black text-slate-900">¥{invoice.matchStatus.receiptAmount.toLocaleString()}</p>
                          <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 bg-white border border-green-200 rounded-full flex items-center justify-center text-green-500 z-10 shadow-sm">
                             <CheckCircle size={14} />
                          </div>
                      </div>
                      <div className="flex-1 p-4 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                          <p className="text-xs font-bold text-blue-500 uppercase mb-1">发票金额 (Invoice)</p>
                          <p className="font-black text-blue-700">¥{invoice.matchStatus.invoiceAmount.toLocaleString()}</p>
                      </div>
                   </div>
                   <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-2 text-sm text-green-700 font-bold justify-center">
                      <CheckCircle size={16} /> 系统自动校验通过：金额一致，单价一致，数量一致
                   </div>
                </div>

                {/* Invoice Visualization */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                         <Receipt className="text-blue-600" size={20} /> 增值税专用发票
                      </h3>
                      <button className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg">查看原件扫描件</button>
                   </div>
                   
                   <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 relative overflow-hidden">
                      <div className="flex justify-between mb-8 border-b border-slate-200 pb-4">
                         <div>
                            <p className="text-xs text-slate-400">购买方</p>
                            <p className="font-bold text-slate-700">智采云科技集团</p>
                         </div>
                         <div className="text-right">
                            <p className="text-xs text-slate-400">销售方</p>
                            <p className="font-bold text-slate-700">{invoice.supplier}</p>
                         </div>
                      </div>
                      
                      <table className="w-full text-sm mb-8">
                         <thead className="text-slate-400 text-xs uppercase border-b border-slate-200">
                            <tr>
                               <th className="text-left py-2">货物名称</th>
                               <th className="text-right py-2">单价</th>
                               <th className="text-center py-2">数量</th>
                               <th className="text-right py-2">金额</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-200/50">
                            {invoice.items.map((item, i) => (
                               <tr key={i}>
                                  <td className="py-3 font-medium text-slate-700">{item.name} <span className="text-slate-400 text-xs ml-1">{item.spec}</span></td>
                                  <td className="py-3 text-right font-mono text-slate-600">¥{item.price.toLocaleString()}</td>
                                  <td className="py-3 text-center text-slate-600">{item.qty}</td>
                                  <td className="py-3 text-right font-mono font-bold text-slate-900">¥{item.total.toLocaleString()}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                      
                      <div className="flex justify-end gap-8 pt-4 border-t border-slate-200 border-dashed">
                         <div className="text-right">
                            <p className="text-xs text-slate-400">税额 (13%)</p>
                            <p className="font-mono font-bold text-slate-600">¥{(invoice.amount * 0.13).toLocaleString()}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-xs text-slate-400">价税合计 (小写)</p>
                            <p className="font-mono font-black text-xl text-blue-600">¥{invoice.amount.toLocaleString()}</p>
                         </div>
                      </div>
                      
                      <div className="absolute top-4 right-1/2 translate-x-1/2 w-32 h-32 border-4 border-red-500/20 rounded-full flex items-center justify-center -rotate-12 pointer-events-none">
                         <span className="text-red-500/20 font-black text-xl uppercase">验真通过</span>
                      </div>
                   </div>
                </div>
             </div>

             {/* Right Column */}
             <div className="space-y-6">
                {/* Bank Info */}
                <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none"><Landmark size={80} /></div>
                   <div className="relative z-10">
                      <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                         <CreditCard size={20} className="text-blue-400"/> 收款账户信息
                      </h3>
                      <div className="space-y-4">
                         <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">户名</p>
                            <p className="font-medium">{invoice.bankInfo.accountName}</p>
                         </div>
                         <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">开户行</p>
                            <p className="font-medium">{invoice.bankInfo.bankName}</p>
                         </div>
                         <div className="pt-2 border-t border-white/10">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">账号</p>
                            <p className="font-mono text-xl font-bold tracking-wider text-blue-300">{invoice.bankInfo.accountNo}</p>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Approval Timeline */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <Clock size={20} className="text-blue-600"/> 审批流程
                   </h3>
                   <div className="pl-4 border-l-2 border-slate-100 space-y-6">
                      {invoice.approvalFlow.map((step, i) => (
                         <div key={i} className="relative">
                             <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                                step.status === 'completed' ? 'bg-green-500' :
                                step.status === 'current' ? 'bg-blue-600 animate-pulse' : 'bg-slate-200'
                             }`}></div>
                             <p className={`text-sm font-bold ${step.status === 'pending' ? 'text-slate-400' : 'text-slate-900'}`}>{step.step}</p>
                             <p className="text-xs text-slate-500 mt-0.5">{step.user} {step.time ? `· ${step.time}` : ''}</p>
                         </div>
                      ))}
                   </div>
                </div>
                
                {/* Related Links */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Link size={20} className="text-blue-600"/> 关联单据
                   </h3>
                   <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer group">
                         <div className="flex items-center gap-3">
                            <FileText size={16} className="text-slate-400 group-hover:text-blue-600" />
                            <span className="text-sm font-bold text-slate-700">采购订单 {invoice.po}</span>
                         </div>
                         <ChevronRight size={14} className="text-slate-300" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer group">
                         <div className="flex items-center gap-3">
                            <Package size={16} className="text-slate-400 group-hover:text-blue-600" />
                            <span className="text-sm font-bold text-slate-700">入库单 GR-20231101</span>
                         </div>
                         <ChevronRight size={14} className="text-slate-300" />
                      </div>
                   </div>
                </div>
             </div>
          </div>
       </div>
    );
  };

  if (selectedInvoiceId) return renderFinanceDetail();

  return (
      <div className="space-y-6 animate-in fade-in duration-300">
         <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Receipt className="text-blue-600" size={24} />
              财务管理
            </h1>
            <p className="text-sm text-slate-500 mt-1">采购发票录入、对账及付款申请</p>
          </div>
          <button className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-800 shadow-lg transition-all">
            <CreditCard size={18} />
            申请付款
          </button>
        </div>

        <div className="grid grid-cols-3 gap-6">
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                 <div>
                    <p className="text-sm font-bold text-slate-500">本月待付总额</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">¥ 345,800</p>
                 </div>
                 <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><AlertTriangle size={20}/></div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                 <div className="bg-amber-500 h-1.5 rounded-full" style={{width: '65%'}}></div>
              </div>
              <p className="text-xs text-slate-400 mt-2">12 笔款项即将到期</p>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                 <div>
                    <p className="text-sm font-bold text-slate-500">已付金额</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">¥ 1,280,000</p>
                 </div>
                 <div className="p-3 bg-green-50 text-green-600 rounded-xl"><CheckSquare size={20}/></div>
              </div>
              <p className="text-xs text-slate-400 mt-4">本月付款进度正常</p>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                 <div>
                    <p className="text-sm font-bold text-slate-500">发票待认证</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">8 <span className="text-xs font-normal text-slate-400">张</span></p>
                 </div>
                 <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><FileCheck size={20}/></div>
              </div>
              <button className="text-xs font-bold text-blue-600 hover:underline">前往税务系统认证 &rarr;</button>
           </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
           <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-left">
                 <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase w-20 text-center">序号</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">发票号码</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">关联订单</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">供应商</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-right">开票金额</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">应付日期</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">付款状态</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {invoices.map((inv, i) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4 text-center font-bold text-slate-400">{i + 1}</td>
                       <td className="px-6 py-4 font-mono font-bold text-slate-900">{inv.id}</td>
                       <td className="px-6 py-4 font-mono text-slate-600 text-xs">{inv.po}</td>
                       <td className="px-6 py-4 font-bold text-slate-700">{inv.supplier}</td>
                       <td className="px-6 py-4 text-right font-black text-slate-900">¥{inv.amount.toLocaleString()}</td>
                       <td className="px-6 py-4 text-slate-500 font-medium">{inv.dueDate}</td>
                       <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                             inv.status === '已付款' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                             {inv.status}
                          </span>
                       </td>
                       <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => setSelectedInvoiceId(inv.id)}
                            className="text-blue-600 font-bold hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors text-xs"
                          >
                             查看详情
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

export default FinanceManagement;
