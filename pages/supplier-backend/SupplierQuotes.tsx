
import React, { useState } from 'react';
import { 
  Search, MessageSquareQuote, Clock, CheckCircle2, ArrowRight, ArrowLeft, 
  FileText, UploadCloud, Calculator, Calendar, Download, Printer, X
} from 'lucide-react';

interface QuoteItem {
  id: string;
  name: string;
  spec: string;
  qty: number;
  unit: string;
  userPrice?: number; // For input
  taxRate?: number;
  delivery?: string;
  remark?: string;
}

interface QuoteRequest {
  id: string;
  title: string;
  buyer: string;
  deadline: string;
  status: '待报价' | '已报价' | '已截标';
  publishDate: string;
  contact: string;
  description: string;
  items: QuoteItem[];
  // Fields for submitted quote
  submittedDate?: string;
  totalAmount?: number;
  validityDate?: string;
  attachments?: string[];
}

const SupplierQuotes: React.FC = () => {
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<QuoteRequest | null>(null); // State for the form being edited

  // Mock Data
  const [requests, setRequests] = useState<QuoteRequest[]>([
    { 
      id: 'RFQ-20231104-03', 
      title: 'Q4季度办公用品集中采购询价', 
      buyer: '智采云 - 行政部', 
      contact: '李行政 (021-12345678)',
      deadline: '2023-11-10', 
      publishDate: '2023-11-04',
      status: '待报价', 
      description: '集团总部Q4季度常规办公消耗品采购，要求报价含税含运费，送货上门。',
      items: [
        { id: 'i1', name: 'A4复印纸', spec: '80g 500张/包', qty: 200, unit: '箱', userPrice: 0 },
        { id: 'i2', name: '惠普硒鼓', spec: 'Q2612A 原装', qty: 50, unit: '个', userPrice: 0 },
        { id: 'i3', name: '强力文件夹', spec: '蓝色 50mm', qty: 300, unit: '个', userPrice: 0 }
      ]
    },
    { 
      id: 'RFQ-20231020-05', 
      title: '双十一营销物料制作询价', 
      buyer: '智采云 - 市场部', 
      contact: '王市场 (13900001111)',
      deadline: '2023-10-25', 
      publishDate: '2023-10-20',
      status: '已报价', 
      description: '双十一活动线下物料制作，需严格按照设计图纸制作，工期紧迫。',
      submittedDate: '2023-10-22 14:30',
      totalAmount: 45800,
      validityDate: '2023-11-30',
      attachments: ['报价单_盖章版.pdf', '材质样板说明.jpg'],
      items: [
        { id: 'i1', name: '易拉宝', spec: '80x200cm 塑钢', qty: 50, unit: '套', userPrice: 120, remark: '含画面打印' },
        { id: 'i2', name: '横幅', spec: '10m 红底白字', qty: 20, unit: '条', userPrice: 80 },
        { id: 'i3', name: '宣传册', spec: 'A4 骑马钉 16P', qty: 2000, unit: '本', userPrice: 15 }
      ]
    },
  ]);

  const handleAction = (request: QuoteRequest) => {
    setSelectedId(request.id);
    if (request.status === '待报价') {
      // Initialize form data with default values
      const initForm = {
          ...request,
          items: request.items.map(i => ({ ...i, userPrice: undefined, taxRate: 13, delivery: '3天' }))
      };
      setFormData(initForm);
      setView('form');
    } else {
      setView('detail');
    }
  };

  const handleFormChange = (itemId: string, field: keyof QuoteItem, value: any) => {
    if (!formData) return;
    const newItems = formData.items.map(item => 
        item.id === itemId ? { ...item, [field]: value } : item
    );
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
      if (!formData) return 0;
      return formData.items.reduce((sum, item) => sum + (item.qty * (Number(item.userPrice) || 0)), 0);
  };

  const handleSubmitQuote = () => {
      if (!formData) return;
      // In a real app, API call here.
      // Update local state to simulate submission
      const updatedRequests = requests.map(r => 
        r.id === formData.id 
            ? { ...formData, status: '已报价' as const, submittedDate: new Date().toISOString().split('T')[0], totalAmount: calculateTotal() } 
            : r
      );
      setRequests(updatedRequests);
      setView('list');
      setSelectedId(null);
  };

  // --- Views ---

  const renderQuoteForm = () => {
    if (!formData) return null;
    const total = calculateTotal();

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-20">
            <div className="flex items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-xl font-black text-slate-900">立即报价: {formData.title}</h2>
                    <p className="text-sm text-slate-500 mt-1">单号: {formData.id} · 截止: {formData.deadline}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Item List Form */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <Calculator className="text-orange-600" size={20} /> 报价明细
                        </h3>
                        <div className="space-y-6">
                            {formData.items.map((item, idx) => (
                                <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="text-xs font-bold text-slate-400 bg-white border px-1.5 py-0.5 rounded mr-2">#{idx + 1}</span>
                                            <span className="font-bold text-slate-900">{item.name}</span>
                                            <p className="text-xs text-slate-500 mt-1 pl-8">规格: {item.spec}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-400 uppercase">采购数量</p>
                                            <p className="font-mono font-black text-lg text-slate-900">{item.qty} <span className="text-xs text-slate-500 font-normal">{item.unit}</span></p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">含税单价 (元)</label>
                                            <input 
                                                type="number" 
                                                value={item.userPrice || ''} 
                                                onChange={(e) => handleFormChange(item.id, 'userPrice', e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">税率 (%)</label>
                                            <input 
                                                type="number" 
                                                value={item.taxRate} 
                                                onChange={(e) => handleFormChange(item.id, 'taxRate', e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">承诺交期</label>
                                            <input 
                                                type="text" 
                                                value={item.delivery} 
                                                onChange={(e) => handleFormChange(item.id, 'delivery', e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none"
                                                placeholder="如：3天"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">行小计</label>
                                            <div className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm font-black text-slate-900 text-right">
                                                ¥{((item.qty * (Number(item.userPrice) || 0))).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <input 
                                            type="text" 
                                            value={item.remark || ''} 
                                            onChange={(e) => handleFormChange(item.id, 'remark', e.target.value)}
                                            className="w-full bg-transparent border-b border-slate-200 py-1 text-xs text-slate-600 focus:border-orange-500 outline-none"
                                            placeholder="添加备注说明..."
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Attachments */}
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <UploadCloud className="text-blue-600" size={20} /> 附件上传
                        </h3>
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-slate-400 hover:border-orange-400 hover:bg-orange-50 transition-all cursor-pointer">
                            <UploadCloud size={32} className="mb-2" />
                            <p className="text-sm font-bold">点击上传正式报价单 (PDF/Excel)</p>
                            <p className="text-xs mt-1">支持最大 10MB 文件</p>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    {/* Buyer Info */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-4">采购方信息</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between py-2 border-b border-slate-50">
                                <span className="text-slate-500">采购单位</span>
                                <span className="font-bold text-slate-900 text-right w-32">{formData.buyer}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-50">
                                <span className="text-slate-500">联系人</span>
                                <span className="font-bold text-slate-900">{formData.contact}</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 mt-2">
                                <span className="font-bold block mb-1">采购说明:</span>
                                {formData.description}
                            </div>
                        </div>
                    </div>

                    {/* Summary & Submit */}
                    <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl sticky top-6">
                        <h3 className="font-bold text-lg mb-6">报价汇总</h3>
                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-sm">含税总额</span>
                                <span className="text-2xl font-black text-orange-400">¥{total.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-sm">物资项数</span>
                                <span className="font-bold">{formData.items.length} 项</span>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">报价有效期</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                        type="date" 
                                        className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-orange-500"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <button 
                                onClick={handleSubmitQuote}
                                className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 size={18} /> 提交报价
                            </button>
                            <button 
                                onClick={() => setView('list')}
                                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderQuoteDetail = () => {
    // In a real app, fetch detail by ID. Using found mock object for now.
    const quote = requests.find(r => r.id === selectedId);
    if (!quote) return null;

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-black text-slate-900">{quote.title}</h2>
                            <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-black rounded uppercase border border-green-100">
                                {quote.status}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">提交时间: {quote.submittedDate} · 有效期至: {quote.validityDate}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                        <Printer size={18} /> 打印
                    </button>
                    <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg">
                        <Download size={18} /> 导出报价单
                    </button>
                </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-end mb-6 pb-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="text-blue-600" size={20} /> 报价详情
                    </h3>
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">报价总额 (含税)</p>
                        <p className="text-3xl font-black text-slate-900">¥{quote.totalAmount?.toLocaleString()}</p>
                    </div>
                </div>

                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <tr>
                            <th className="px-4 py-3 text-left">物资名称</th>
                            <th className="px-4 py-3 text-left">规格型号</th>
                            <th className="px-4 py-3 text-center">数量</th>
                            <th className="px-4 py-3 text-right">单价</th>
                            <th className="px-4 py-3 text-right">小计</th>
                            <th className="px-4 py-3 text-left pl-6">备注</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {quote.items.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="px-4 py-4 font-bold text-slate-900">{item.name}</td>
                                <td className="px-4 py-4 text-slate-600">{item.spec}</td>
                                <td className="px-4 py-4 text-center">{item.qty} {item.unit}</td>
                                <td className="px-4 py-4 text-right font-mono">¥{item.userPrice}</td>
                                <td className="px-4 py-4 text-right font-mono font-bold text-slate-900">¥{((item.userPrice || 0) * item.qty).toLocaleString()}</td>
                                <td className="px-4 py-4 pl-6 text-slate-500 text-xs">{item.remark || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {quote.attachments && quote.attachments.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-900 mb-4">相关附件</h4>
                        <div className="flex gap-4">
                            {quote.attachments.map((file, i) => (
                                <div key={i} className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-pointer hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all">
                                    <FileText size={16} /> {file}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
  };

  const renderList = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <MessageSquareQuote className="text-orange-600" size={24} />
            询价回复
          </h1>
          <p className="text-sm text-slate-500 mt-1">处理来自采购方的定向询价与比价邀请</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
         {requests.map((q, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-orange-300 transition-all group">
               <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${q.status === '待报价' ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                        <MessageSquareQuote size={24} />
                     </div>
                     <div>
                        <h3 className="text-lg font-bold text-slate-900">{q.title}</h3>
                        <p className="text-sm text-slate-500 mt-1">采购方：{q.buyer}</p>
                     </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                     q.status === '待报价' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-green-50 text-green-600 border border-green-100'
                  }`}>
                     {q.status}
                  </span>
               </div>
               
               <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm text-slate-600">
                  <span className="font-bold text-slate-400 mr-2">询价摘要:</span> 
                  {q.items.map(item => item.name).join(', ')}
               </div>

               <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
                     <Clock size={14} /> 截止时间: {q.deadline}
                  </div>
                  <button 
                    onClick={() => handleAction(q)}
                    className={`px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors ${
                     q.status === '待报价' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                     {q.status === '待报价' ? '立即报价' : '查看报价单'} <ArrowRight size={16} />
                  </button>
               </div>
            </div>
         ))}
      </div>
    </div>
  );

  if (view === 'form') return renderQuoteForm();
  if (view === 'detail') return renderQuoteDetail();
  return renderList();
};

export default SupplierQuotes;
