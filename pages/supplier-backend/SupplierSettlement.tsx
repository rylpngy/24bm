
import React, { useState, useEffect } from 'react';
import { 
  Receipt, Wallet, ArrowDownLeft, ArrowUpRight, Download, Printer, 
  Search, Filter, ChevronLeft, FileText, CheckCircle2, AlertTriangle, 
  Clock, CreditCard, Send, Building2, Calendar, FileCheck, Coins
} from 'lucide-react';

interface SupplierSettlementProps {
    initialTab?: string;
}

// --- Types ---

interface Settlement {
  id: string;
  customer: string;
  period: string;
  amount: number;
  status: '待确认' | '已确认' | '异议中';
  createDate: string;
  orders: { id: string; date: string; amount: number; items: string }[];
}

interface Invoice {
  id: string;
  customer: string;
  type: '增值税专用发票' | '增值税普通发票';
  amount: number;
  taxAmount: number;
  status: '待开票' | '已开票' | '已红冲';
  date: string;
  content: string;
}

interface Receivable {
  id: string;
  customer: string;
  sourceType: string; // e.g. 订单款, 质保金
  sourceId: string;
  amount: number;
  receivedAmount: number;
  dueDate: string;
  status: '待回款' | '部分回款' | '已结清' | '逾期';
  reminders: { date: string; type: string; result: string }[];
}

// --- Mock Data ---

const mockSettlements: Settlement[] = [
  { 
    id: 'STM-202310-001', 
    customer: '智采云科技集团', 
    period: '2023年10月', 
    amount: 158000.00, 
    status: '待确认', 
    createDate: '2023-11-01',
    orders: [
      { id: 'PO-20231005-01', date: '2023-10-05', amount: 50000, items: '服务器 x2' },
      { id: 'PO-20231015-03', date: '2023-10-15', amount: 80000, items: '存储设备 x1' },
      { id: 'PO-20231028-09', date: '2023-10-28', amount: 28000, items: '维保服务' }
    ]
  },
  { 
    id: 'STM-202309-005', 
    customer: '上海宏博贸易', 
    period: '2023年09月', 
    amount: 42500.00, 
    status: '已确认', 
    createDate: '2023-10-01',
    orders: [
      { id: 'PO-20230910-02', date: '2023-09-10', amount: 42500, items: '办公耗材批次A' }
    ]
  }
];

const mockInvoices: Invoice[] = [
  { id: 'INV-88293011', customer: '智采云科技集团', type: '增值税专用发票', amount: 158000.00, taxAmount: 18185.84, status: '待开票', date: '-', content: '计算机硬件及服务' },
  { id: 'INV-88293005', customer: '杭州大和电子', type: '增值税专用发票', amount: 25000.00, taxAmount: 2876.11, status: '已开票', date: '2023-10-25', content: '电子元器件' },
  { id: 'INV-88291002', customer: '无锡恒润科技', type: '增值税普通发票', amount: 5000.00, taxAmount: 0, status: '已红冲', date: '2023-09-15', content: '技术咨询费' },
];

const mockReceivables: Receivable[] = [
  { 
    id: 'REC-202311-01', 
    customer: '智采云科技集团', 
    sourceType: '对账单', 
    sourceId: 'STM-202310-001', 
    amount: 158000.00, 
    receivedAmount: 0, 
    dueDate: '2023-11-30', 
    status: '待回款',
    reminders: []
  },
  { 
    id: 'REC-202308-05', 
    customer: '上海宏博贸易', 
    sourceType: '订单款', 
    sourceId: 'PO-20230805-02', 
    amount: 12000.00, 
    receivedAmount: 0, 
    dueDate: '2023-10-05', 
    status: '逾期',
    reminders: [
      { date: '2023-10-06', type: '系统通知', result: '已发送' },
      { date: '2023-10-15', type: '人工催款', result: '客户承诺月底付' },
      { date: '2023-11-01', type: '律师函警告', result: '准备中' }
    ]
  },
  { 
    id: 'REC-202309-12', 
    customer: '杭州大和电子', 
    sourceType: '质保金', 
    sourceId: 'PO-20230101-01', 
    amount: 50000.00, 
    receivedAmount: 20000, 
    dueDate: '2023-12-31', 
    status: '部分回款',
    reminders: []
  }
];

const SupplierSettlement: React.FC<SupplierSettlementProps> = ({ initialTab = 'settlement' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
    setView('list');
    setSelectedId(null);
  }, [initialTab]);

  const handleViewDetail = (id: string) => {
    setSelectedId(id);
    setView('detail');
  };

  const handleBack = () => {
    setView('list');
    setSelectedId(null);
  };

  // --- Renderers: Settlement ---

  const renderSettlementDetail = () => {
    const item = mockSettlements.find(s => s.id === selectedId);
    if (!item) return null;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                 <ChevronLeft size={24} />
              </button>
              <div>
                 <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-slate-900">{item.period} 对账单</h2>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase ${
                        item.status === '待确认' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-green-50 text-green-700 border-green-100'
                    }`}>
                       {item.status}
                    </span>
                 </div>
                 <p className="text-sm text-slate-500 mt-1">单号: {item.id} · 客户: {item.customer}</p>
              </div>
           </div>
           <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                 <Download size={18} /> 导出 Excel
              </button>
              {item.status === '待确认' && (
                <button className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg">
                   <FileCheck size={18} /> 确认无误
                </button>
              )}
           </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Receipt size={20} className="text-blue-600"/> 对账明细
           </h3>
           <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                 <tr>
                    <th className="px-4 py-3 text-left">关联订单</th>
                    <th className="px-4 py-3 text-left">交易日期</th>
                    <th className="px-4 py-3 text-left">内容摘要</th>
                    <th className="px-4 py-3 text-right">交易金额 (含税)</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {item.orders.map((order, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                       <td className="px-4 py-4 font-mono font-bold text-slate-900">{order.id}</td>
                       <td className="px-4 py-4 text-slate-600">{order.date}</td>
                       <td className="px-4 py-4 text-slate-600">{order.items}</td>
                       <td className="px-4 py-4 text-right font-mono font-bold text-slate-900">¥{order.amount.toLocaleString()}</td>
                    </tr>
                 ))}
              </tbody>
              <tfoot className="bg-slate-50/50">
                 <tr>
                    <td colSpan={3} className="px-4 py-4 text-right font-bold text-slate-500 uppercase">本期应结总额</td>
                    <td className="px-4 py-4 text-right font-black text-xl text-blue-600">¥{item.amount.toLocaleString()}</td>
                 </tr>
              </tfoot>
           </table>
        </div>
      </div>
    );
  };

  // --- Renderers: Invoice ---

  const renderInvoiceDetail = () => {
    const item = mockInvoices.find(inv => inv.id === selectedId);
    if (!item) return null;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                 <ChevronLeft size={24} />
              </button>
              <div>
                 <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-slate-900">发票详情</h2>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase ${
                        item.status === '待开票' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-50 text-green-700 border-green-100'
                    }`}>
                       {item.status}
                    </span>
                 </div>
                 <p className="text-sm text-slate-500 mt-1">购买方: {item.customer} · 发票类型: {item.type}</p>
              </div>
           </div>
           <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                 <Printer size={18} /> 打印
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg">
                 <Download size={18} /> 下载 PDF
              </button>
           </div>
        </div>

        <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm flex justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
           {/* Invoice Visual */}
           <div className="w-full max-w-3xl bg-white border-2 border-slate-200 p-8 shadow-xl relative">
              <div className="flex justify-between items-start mb-10 border-b-2 border-dashed border-slate-100 pb-6">
                 <div>
                    <h1 className="text-2xl font-bold text-slate-900 text-center tracking-widest border-b-2 border-slate-900 pb-1 mb-1">{item.type}</h1>
                    <p className="text-center text-[10px] text-slate-400">INVOICE</p>
                 </div>
                 <div className="text-right space-y-1">
                    <p className="text-sm text-slate-500"><span className="text-slate-400 mr-2">发票代码:</span> 1234567890</p>
                    <p className="text-sm text-slate-500"><span className="text-slate-400 mr-2">发票号码:</span> {item.id.replace('INV-', '')}</p>
                    <p className="text-sm text-slate-500"><span className="text-slate-400 mr-2">开票日期:</span> {item.date}</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                 <div className="p-4 bg-slate-50 border border-slate-100">
                    <p className="font-bold text-slate-900 mb-2">购买方</p>
                    <div className="space-y-1 text-slate-600">
                       <p><span className="text-slate-400 w-16 inline-block">名称:</span> {item.customer}</p>
                       <p><span className="text-slate-400 w-16 inline-block">纳税人识别号:</span> 91310000XXXXXXXXXX</p>
                       <p><span className="text-slate-400 w-16 inline-block">地址电话:</span> 上海市浦东新区... 021-88888888</p>
                    </div>
                 </div>
                 <div className="p-4 bg-slate-50 border border-slate-100">
                    <p className="font-bold text-slate-900 mb-2">销售方</p>
                    <div className="space-y-1 text-slate-600">
                       <p><span className="text-slate-400 w-16 inline-block">名称:</span> 您的企业名称</p>
                       <p><span className="text-slate-400 w-16 inline-block">纳税人识别号:</span> 91320000XXXXXXXXXX</p>
                       <p><span className="text-slate-400 w-16 inline-block">地址电话:</span> 江苏省苏州市... 0512-66666666</p>
                    </div>
                 </div>
              </div>

              <table className="w-full text-sm mb-8 border border-slate-200">
                 <thead className="bg-slate-50 text-slate-500 text-xs text-center">
                    <tr>
                       <th className="p-2 border-r border-slate-200">货物或应税劳务名称</th>
                       <th className="p-2 border-r border-slate-200">规格型号</th>
                       <th className="p-2 border-r border-slate-200">单位</th>
                       <th className="p-2 border-r border-slate-200">数量</th>
                       <th className="p-2 border-r border-slate-200">单价</th>
                       <th className="p-2 border-r border-slate-200">金额</th>
                       <th className="p-2 border-r border-slate-200">税率</th>
                       <th className="p-2">税额</th>
                    </tr>
                 </thead>
                 <tbody className="text-slate-700 text-center">
                    <tr>
                       <td className="p-2 border-r border-slate-200 text-left">{item.content}</td>
                       <td className="p-2 border-r border-slate-200">-</td>
                       <td className="p-2 border-r border-slate-200">批</td>
                       <td className="p-2 border-r border-slate-200">1</td>
                       <td className="p-2 border-r border-slate-200">{(item.amount - item.taxAmount).toFixed(2)}</td>
                       <td className="p-2 border-r border-slate-200">{(item.amount - item.taxAmount).toFixed(2)}</td>
                       <td className="p-2 border-r border-slate-200">13%</td>
                       <td className="p-2">{item.taxAmount.toFixed(2)}</td>
                    </tr>
                 </tbody>
              </table>

              <div className="flex justify-end gap-8 pt-4 border-t-2 border-slate-900">
                 <div className="text-right">
                    <p className="text-xs text-slate-400">价税合计 (大写)</p>
                    <p className="font-bold text-slate-900">ⓧ 壹拾伍万捌仟元整</p>
                 </div>
                 <div className="text-right">
                    <p className="text-xs text-slate-400">价税合计 (小写)</p>
                    <p className="font-black text-xl text-blue-600">¥{item.amount.toLocaleString()}</p>
                 </div>
              </div>
              
              {/* Stamp */}
              <div className="absolute bottom-10 right-20 w-32 h-32 border-4 border-red-500/30 rounded-full flex items-center justify-center -rotate-12 pointer-events-none">
                 <div className="w-24 h-24 border border-red-500/30 rounded-full flex items-center justify-center">
                    <span className="text-red-500/30 font-black text-xs">发票专用章</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  // --- Renderers: Receivable ---

  const renderReceivableDetail = () => {
    const item = mockReceivables.find(r => r.id === selectedId);
    if (!item) return null;

    const progress = (item.receivedAmount / item.amount) * 100;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                 <ChevronLeft size={24} />
              </button>
              <div>
                 <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-slate-900">应收详情</h2>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase ${
                        item.status === '逾期' ? 'bg-red-50 text-red-700 border-red-100' : 
                        item.status === '已结清' ? 'bg-green-50 text-green-700 border-green-100' :
                        'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                       {item.status}
                    </span>
                 </div>
                 <p className="text-sm text-slate-500 mt-1">单号: {item.id} · 客户: {item.customer}</p>
              </div>
           </div>
           {item.status !== '已结清' && (
             <button className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-red-700 shadow-lg">
                <Send size={18} /> 发起催款
             </button>
           )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 space-y-6">
              {/* Progress Card */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Wallet size={20} className="text-blue-600"/> 回款进度
                 </h3>
                 <div className="mb-6">
                    <div className="flex justify-between items-end mb-2">
                       <span className="text-3xl font-black text-slate-900">¥{item.receivedAmount.toLocaleString()} <span className="text-sm text-slate-400 font-normal">/ {item.amount.toLocaleString()}</span></span>
                       <span className="font-bold text-blue-600">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                       <div className="bg-blue-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <div className="flex-1 p-4 bg-slate-50 rounded-xl">
                       <p className="text-xs text-slate-400 uppercase font-bold mb-1">待回款金额</p>
                       <p className="text-xl font-bold text-slate-900">¥{(item.amount - item.receivedAmount).toLocaleString()}</p>
                    </div>
                    <div className={`flex-1 p-4 rounded-xl ${item.status === '逾期' ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-900'}`}>
                       <p className={`text-xs uppercase font-bold mb-1 ${item.status === '逾期' ? 'text-red-400' : 'text-slate-400'}`}>应付日期</p>
                       <p className="text-xl font-bold">{item.dueDate}</p>
                    </div>
                 </div>
              </div>

              {/* Source Info */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <FileText size={20} className="text-blue-600"/> 款项来源
                 </h3>
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                       <p className="text-xs text-slate-500 uppercase font-bold mb-1">来源类型</p>
                       <p className="font-bold text-slate-900">{item.sourceType}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-xs text-slate-500 uppercase font-bold mb-1">关联单号</p>
                       <p className="font-mono font-bold text-blue-600 cursor-pointer hover:underline">{item.sourceId}</p>
                    </div>
                 </div>
              </div>
           </div>

           <div className="col-span-1">
              {/* Reminders */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-full">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Clock size={20} className="text-blue-600"/> 催款记录
                 </h3>
                 <div className="space-y-6 pl-2">
                    {item.reminders.length > 0 ? item.reminders.map((r, i) => (
                       <div key={i} className="relative pl-6 border-l-2 border-slate-100">
                          <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-slate-300"></div>
                          <p className="text-xs text-slate-400 mb-1">{r.date}</p>
                          <p className="text-sm font-bold text-slate-900">{r.type}</p>
                          <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded">{r.result}</p>
                       </div>
                    )) : (
                       <div className="text-center py-10 text-slate-400 text-xs">
                          暂无催款记录
                       </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  // --- Main Render Switch ---

  const renderContent = () => {
    // 1. Settlement
    if (activeTab === 'settlement') {
      if (view === 'detail') return renderSettlementDetail();
      return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
           <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-left">
                 <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">对账单号</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">客户名称</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">账期</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-right">金额</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">状态</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {mockSettlements.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleViewDetail(s.id)}>
                       <td className="px-6 py-4 font-mono font-bold text-slate-900">{s.id}</td>
                       <td className="px-6 py-4 font-bold text-slate-700">{s.customer}</td>
                       <td className="px-6 py-4 text-slate-600">{s.period}</td>
                       <td className="px-6 py-4 text-right font-black text-slate-900">¥{s.amount.toLocaleString()}</td>
                       <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                             s.status === '待确认' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                          }`}>{s.status}</span>
                       </td>
                       <td className="px-6 py-4 text-center">
                          <button className="text-blue-600 font-bold text-xs hover:underline">详情</button>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      );
    }

    // 2. Invoice
    if (activeTab === 'invoice') {
      if (view === 'detail') return renderInvoiceDetail();
      return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
           <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-left">
                 <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">发票流水号</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">购买方</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">发票类型</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-right">金额</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">状态</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {mockInvoices.map((inv, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleViewDetail(inv.id)}>
                       <td className="px-6 py-4 font-mono font-bold text-slate-900">{inv.id}</td>
                       <td className="px-6 py-4 font-bold text-slate-700">{inv.customer}</td>
                       <td className="px-6 py-4 text-slate-600">{inv.type}</td>
                       <td className="px-6 py-4 text-right font-black text-slate-900">¥{inv.amount.toLocaleString()}</td>
                       <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                             inv.status === '待开票' ? 'bg-amber-50 text-amber-700' : 
                             inv.status === '已开票' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>{inv.status}</span>
                       </td>
                       <td className="px-6 py-4 text-center">
                          <button className="text-blue-600 font-bold text-xs hover:underline">查看</button>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      );
    }

    // 3. Receivable
    if (activeTab === 'receivable') {
      if (view === 'detail') return renderReceivableDetail();
      return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
           <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-left">
                 <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">款项编号</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">付款方</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">款项性质</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-right">应收金额</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">应付日期</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">状态</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {mockReceivables.map((rec, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleViewDetail(rec.id)}>
                       <td className="px-6 py-4 font-mono font-bold text-slate-900">{rec.id}</td>
                       <td className="px-6 py-4 font-bold text-slate-700">{rec.customer}</td>
                       <td className="px-6 py-4 text-slate-600 flex items-center gap-1">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{rec.sourceType}</span>
                       </td>
                       <td className="px-6 py-4 text-right font-black text-slate-900">¥{rec.amount.toLocaleString()}</td>
                       <td className="px-6 py-4 font-medium text-slate-700">{rec.dueDate}</td>
                       <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                             rec.status === '逾期' ? 'bg-red-50 text-red-700' : 
                             rec.status === '已结清' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                          }`}>{rec.status}</span>
                       </td>
                       <td className="px-6 py-4 text-center">
                          <button className="text-blue-600 font-bold text-xs hover:underline">跟进</button>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Top Navigation & Summary */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            {activeTab === 'settlement' ? (
                <>
                    <Receipt className="text-orange-600" size={24} />
                    对账单
                </>
            ) : activeTab === 'invoice' ? (
                <>
                    <FileText className="text-orange-600" size={24} />
                    发票管理
                </>
            ) : (
                <>
                    <Wallet className="text-orange-600" size={24} />
                    应收账款
                </>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {activeTab === 'settlement' ? '查看及确认来自采购方的对账单' : 
             activeTab === 'invoice' ? '管理销售发票的开具与红冲' : 
             '监控应收账款回款进度与催收'}
          </p>
        </div>
      </div>

      {/* Conditional Summary Cards based on Tab */}
      {view === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {activeTab === 'settlement' && (
              <>
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">本月待确认</p>
                    <p className="text-2xl font-black text-blue-600">¥ 158,000.00</p>
                 </div>
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">累计已结算</p>
                    <p className="text-2xl font-black text-slate-900">¥ 2,450,000.00</p>
                 </div>
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">存在异议</p>
                    <p className="text-2xl font-black text-amber-500">0 笔</p>
                 </div>
              </>
           )}
           {activeTab === 'invoice' && (
              <>
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">待开票金额</p>
                    <p className="text-2xl font-black text-blue-600">¥ 158,000.00</p>
                 </div>
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">本月已开票</p>
                    <p className="text-2xl font-black text-slate-900">¥ 25,000.00</p>
                 </div>
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                       <p className="text-xs text-slate-400 font-bold uppercase mb-1">剩余发票额度</p>
                       <p className="text-xl font-bold text-slate-900">充足</p>
                    </div>
                    <button className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold">申领发票</button>
                 </div>
              </>
           )}
           {activeTab === 'receivable' && (
              <>
                 <div className="bg-gradient-to-br from-orange-500 to-red-500 p-6 rounded-2xl text-white shadow-lg">
                    <p className="text-orange-100 font-bold text-xs uppercase mb-1">逾期未回款</p>
                    <p className="text-3xl font-black">¥ 12,000.00</p>
                 </div>
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">本月即将到期</p>
                    <p className="text-2xl font-black text-blue-600">¥ 158,000.00</p>
                 </div>
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">平均回款周期</p>
                    <p className="text-2xl font-black text-slate-900">45 天</p>
                 </div>
              </>
           )}
        </div>
      )}

      {/* Main Content Area */}
      {renderContent()}
    </div>
  );
};

export default SupplierSettlement;
