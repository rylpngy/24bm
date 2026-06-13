
import React, { useState } from 'react';
import { 
  Search, Package, Printer, MoreHorizontal, Download, ArrowLeft, 
  CheckCircle2, Truck, User, MapPin, FileText, CreditCard, Box,
  Clock, AlertCircle
} from 'lucide-react';

interface OrderItem {
  name: string;
  spec: string;
  qty: number;
  unit: string;
  price: number;
}

interface Order {
  id: string;
  customer: string;
  amount: number;
  date: string;
  status: '待确认' | '生产中' | '待发货' | '已发货' | '已完成';
  items: OrderItem[];
  address: string;
  contact: string;
  phone: string;
  timeline: { status: string; time: string; active: boolean }[];
  paymentStatus: '已付预款' | '待结算' | '已结清';
}

const SupplierOrders: React.FC = () => {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const orders: Order[] = [
    { 
      id: 'PO-20231102-005', 
      customer: '智采云科技集团', 
      amount: 85000, 
      date: '2023-11-02', 
      status: '待确认', 
      paymentStatus: '待结算',
      address: '上海市浦东新区张江高科园区科苑路88号',
      contact: '李工',
      phone: '13900001111',
      items: [
        { name: '精密轴承 Model-X', spec: '高转速', qty: 500, unit: '个', price: 170 }
      ],
      timeline: [
        { status: '买家下单', time: '2023-11-02 09:30', active: true },
        { status: '商家接单', time: '待处理', active: false },
        { status: '生产备货', time: '待处理', active: false },
        { status: '物流发货', time: '待处理', active: false },
        { status: '确认收货', time: '待处理', active: false }
      ]
    },
    { 
      id: 'PO-20231029-012', 
      customer: '上海宏博贸易', 
      amount: 12500, 
      date: '2023-10-29', 
      status: '生产中', 
      paymentStatus: '已付预款',
      address: '上海市普陀区真北路100号',
      contact: '王经理',
      phone: '13800002222',
      items: [
        { name: 'A4复印纸', spec: '70g 500张/包', qty: 200, unit: '箱', price: 45 },
        { name: '惠普硒鼓', spec: 'Q2612A', qty: 50, unit: '个', price: 70 }
      ],
      timeline: [
        { status: '买家下单', time: '2023-10-29 10:00', active: true },
        { status: '商家接单', time: '2023-10-29 10:15', active: true },
        { status: '生产备货', time: '进行中', active: true },
        { status: '物流发货', time: '待处理', active: false },
        { status: '确认收货', time: '待处理', active: false }
      ]
    },
    { 
      id: 'PO-20231025-008', 
      customer: '杭州大和电子', 
      amount: 45000, 
      date: '2023-10-25', 
      status: '待发货', 
      paymentStatus: '待结算',
      address: '浙江省杭州市滨江区长河路500号',
      contact: '赵工',
      phone: '15800003333',
      items: [
        { name: '服务器机柜', spec: '42U 标准', qty: 2, unit: '台', price: 22500 }
      ],
      timeline: [
        { status: '买家下单', time: '2023-10-25 14:00', active: true },
        { status: '商家接单', time: '2023-10-25 14:30', active: true },
        { status: '生产备货', time: '2023-10-28 16:00', active: true },
        { status: '物流发货', time: '待处理', active: false },
        { status: '确认收货', time: '待处理', active: false }
      ]
    },
  ];

  const handleViewDetail = (order: Order) => {
    setSelectedOrder(order);
    setView('detail');
  };

  const renderDetail = () => {
    if (!selectedOrder) return null;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                 <ArrowLeft size={24} />
              </button>
              <div>
                 <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-slate-900">订单号: {selectedOrder.id}</h2>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${
                        selectedOrder.status === '待确认' ? 'bg-red-50 text-red-700 border-red-100' :
                        selectedOrder.status === '生产中' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-green-50 text-green-700 border-green-100'
                    }`}>
                       {selectedOrder.status}
                    </span>
                 </div>
                 <p className="text-sm text-slate-500 mt-1">客户: {selectedOrder.customer} · 下单时间: {selectedOrder.date}</p>
              </div>
           </div>
           <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                 <Printer size={18} /> 打印发货单
              </button>
              {selectedOrder.status === '待确认' && (
                <button className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg">
                   <CheckCircle2 size={18} /> 确认接单
                </button>
              )}
              {selectedOrder.status === '待发货' && (
                <button className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-orange-700 shadow-lg">
                   <Truck size={18} /> 安排发货
                </button>
              )}
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Left: Items & Timeline */}
           <div className="lg:col-span-2 space-y-6">
              {/* Timeline */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Clock className="text-blue-600" size={20} /> 订单进度
                 </h3>
                 <div className="relative flex justify-between items-start">
                    <div className="absolute left-0 right-0 top-3 h-1 bg-slate-100 -z-0 mx-4"></div>
                    {selectedOrder.timeline.map((step, idx) => (
                       <div key={idx} className="relative z-10 flex flex-col items-center">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center border-4 ${
                             step.active ? 'bg-blue-600 border-blue-100 text-white' : 'bg-white border-slate-200 text-slate-300'
                          }`}>
                             {step.active ? <div className="w-2 h-2 bg-white rounded-full"></div> : <div className="w-2 h-2 bg-slate-300 rounded-full"></div>}
                          </div>
                          <p className={`text-xs font-bold mt-2 ${step.active ? 'text-slate-900' : 'text-slate-400'}`}>{step.status}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{step.time}</p>
                       </div>
                    ))}
                 </div>
              </div>

              {/* Items */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Box className="text-blue-600" size={20} /> 订购商品
                 </h3>
                 <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                       <tr>
                          <th className="px-4 py-3 text-left rounded-l-xl">商品信息</th>
                          <th className="px-4 py-3 text-right">单价</th>
                          <th className="px-4 py-3 text-center">数量</th>
                          <th className="px-4 py-3 text-right rounded-r-xl">小计</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {selectedOrder.items.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                             <td className="px-4 py-4">
                                <p className="font-bold text-slate-900">{item.name}</p>
                                <p className="text-xs text-slate-500">{item.spec}</p>
                             </td>
                             <td className="px-4 py-4 text-right font-mono">¥{item.price.toLocaleString()}</td>
                             <td className="px-4 py-4 text-center">{item.qty} {item.unit}</td>
                             <td className="px-4 py-4 text-right font-mono font-bold text-slate-900">¥{(item.price * item.qty).toLocaleString()}</td>
                          </tr>
                       ))}
                    </tbody>
                    <tfoot className="bg-slate-50/50">
                       <tr>
                          <td colSpan={3} className="px-4 py-4 text-right font-bold text-slate-500 uppercase text-xs">订单总额</td>
                          <td className="px-4 py-4 text-right font-black text-lg text-blue-600">¥{selectedOrder.amount.toLocaleString()}</td>
                       </tr>
                    </tfoot>
                 </table>
              </div>
           </div>

           {/* Right: Customer & Summary */}
           <div className="lg:col-span-1 space-y-6">
              {/* Customer Info */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <User className="text-blue-600" size={20} /> 收货信息
                 </h3>
                 <div className="space-y-4 text-sm">
                    <div>
                       <p className="text-xs font-bold text-slate-400 uppercase mb-1">收货单位</p>
                       <p className="font-bold text-slate-900">{selectedOrder.customer}</p>
                    </div>
                    <div>
                       <p className="text-xs font-bold text-slate-400 uppercase mb-1">联系人</p>
                       <p className="font-medium text-slate-900">{selectedOrder.contact} ({selectedOrder.phone})</p>
                    </div>
                    <div>
                       <p className="text-xs font-bold text-slate-400 uppercase mb-1">收货地址</p>
                       <p className="font-medium text-slate-700 flex items-start gap-1">
                          <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                          {selectedOrder.address}
                       </p>
                    </div>
                 </div>
              </div>

              {/* Payment Info */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <CreditCard className="text-blue-600" size={20} /> 结算状态
                 </h3>
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">当前状态</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                       selectedOrder.paymentStatus === '已结清' ? 'bg-green-100 text-green-700' : 
                       'bg-amber-100 text-amber-700'
                    }`}>{selectedOrder.paymentStatus}</span>
                 </div>
                 <div className="mt-4 flex gap-2">
                    <button className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50">
                       查看发票
                    </button>
                    <button className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50">
                       关联回款
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  const renderList = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Package className="text-orange-600" size={24} />
            销售订单
          </h1>
          <p className="text-sm text-slate-500 mt-1">查看及确认来自采购方的订单</p>
        </div>
        <div className="flex gap-3">
           <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl font-bold hover:bg-slate-50">
              <Download size={18} /> 导出订单
           </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex gap-2">
               {['全部', '待确认', '生产中', '待发货', '已完成'].map(status => (
                  <button key={status} className="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-white hover:shadow-sm transition-all">{status}</button>
               ))}
            </div>
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
               <input type="text" placeholder="搜索订单号或客户名称..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none w-64" />
            </div>
         </div>
         <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-left">
               <tr>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase w-20 text-center">序号</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase">订单号</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase">客户名称</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase">商品摘要</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-right">金额</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">状态</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase">下单日期</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {orders.map((o, i) => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleViewDetail(o)}>
                     <td className="px-6 py-4 text-center font-bold text-slate-400">{i + 1}</td>
                     <td className="px-6 py-4 font-mono font-bold text-slate-900">{o.id}</td>
                     <td className="px-6 py-4 font-bold text-slate-700">{o.customer}</td>
                     <td className="px-6 py-4 text-slate-600">{o.items.map(i => i.name).join(', ')}</td>
                     <td className="px-6 py-4 text-right font-black text-slate-900">¥{o.amount.toLocaleString()}</td>
                     <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                           o.status === '待确认' ? 'bg-red-50 text-red-700' :
                           o.status === '生产中' ? 'bg-blue-50 text-blue-700' :
                           o.status === '待发货' ? 'bg-orange-50 text-orange-700' :
                           'bg-green-50 text-green-700'
                        }`}>
                           {o.status}
                        </span>
                     </td>
                     <td className="px-6 py-4 text-slate-500 font-medium">{o.date}</td>
                     <td className="px-6 py-4 text-center">
                        <button className="text-slate-400 hover:text-orange-600 p-2 rounded-full hover:bg-orange-50 transition-colors">
                           <MoreHorizontal size={18} />
                        </button>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );

  return view === 'detail' ? renderDetail() : renderList();
};

export default SupplierOrders;
