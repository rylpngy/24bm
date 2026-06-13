
import React, { useState } from 'react';
import { Truck, Search, MapPin, PackageCheck, Printer, ArrowLeft, Box, User, Clock } from 'lucide-react';

interface Delivery {
  id: string;
  orderId: string;
  customer: string;
  carrier: string;
  tracking: string;
  status: string;
  date: string;
  address: string;
  contact: string;
  content: string;
  logistics: { time: string; desc: string; status: string }[];
}

const SupplierDelivery: React.FC = () => {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  const deliveries: Delivery[] = [
    { 
      id: 'DO-20231102-01', 
      orderId: 'PO-20231102-005', 
      customer: '智采云科技集团', 
      carrier: '顺丰速运', 
      tracking: 'SF1234567890', 
      status: '运输中', 
      date: '2023-11-03',
      address: '上海市浦东新区张江高科园区科苑路88号',
      contact: '李工 (13900001111)',
      content: '精密轴承 Model-X x500',
      logistics: [
        { time: '2023-11-03 14:30', desc: '快件已到达 [上海浦东集散中心]', status: 'transport' },
        { time: '2023-11-03 09:00', desc: '快件已从 [苏州工业园网点] 发出', status: 'transport' },
        { time: '2023-11-02 18:00', desc: '顺丰速运 已收取快件', status: 'picked' }
      ]
    },
    { 
      id: 'DO-20231028-03', 
      orderId: 'PO-20231028-005', 
      customer: '晨光科力普', 
      carrier: '中通快递', 
      tracking: '75123456789', 
      status: '已签收', 
      date: '2023-10-30',
      address: '上海市徐汇区宜山路',
      contact: '前台',
      content: 'A4纸 x200箱, 硒鼓 x50',
      logistics: [
        { time: '2023-10-30 10:00', desc: '已签收，签收人：前台', status: 'signed' },
        { time: '2023-10-30 08:30', desc: '派件中', status: 'delivering' },
        { time: '2023-10-28 20:00', desc: '已发货', status: 'shipped' }
      ]
    },
  ];

  const handleViewDetail = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setView('detail');
  };

  const renderDetail = () => {
    if (!selectedDelivery) return null;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                 <ArrowLeft size={24} />
              </button>
              <div>
                 <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-slate-900">发货单: {selectedDelivery.id}</h2>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${
                        selectedDelivery.status === '运输中' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        selectedDelivery.status === '已签收' ? 'bg-green-50 text-green-700 border-green-100' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                       {selectedDelivery.status}
                    </span>
                 </div>
                 <p className="text-sm text-slate-500 mt-1">关联订单: {selectedDelivery.orderId} · 发货日期: {selectedDelivery.date}</p>
              </div>
           </div>
           <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                 <Printer size={18} /> 补打面单
              </button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Left: Tracking */}
           <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Truck className="text-orange-600" size={20} /> 物流轨迹
                 </h3>
                 
                 <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl mb-8 border border-slate-100">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-slate-700 font-bold">
                       {selectedDelivery.carrier.substring(0,2)}
                    </div>
                    <div>
                       <p className="text-sm font-bold text-slate-900">{selectedDelivery.carrier} : {selectedDelivery.tracking}</p>
                       <p className="text-xs text-slate-500 mt-0.5">官方电话：95338</p>
                    </div>
                 </div>

                 <div className="pl-4 border-l-2 border-slate-100 space-y-8">
                    {selectedDelivery.logistics.map((log, i) => (
                       <div key={i} className="relative">
                          <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${i === 0 ? 'bg-blue-600 scale-125' : 'bg-slate-300'}`}></div>
                          <p className={`text-sm font-bold ${i === 0 ? 'text-blue-600' : 'text-slate-900'}`}>{log.status}</p>
                          <p className="text-xs text-slate-500 mt-1 mb-1">{log.time}</p>
                          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg inline-block">{log.desc}</p>
                       </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* Right: Info */}
           <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <MapPin className="text-orange-600" size={20} /> 收货信息
                 </h3>
                 <div className="space-y-4 text-sm">
                    <div>
                       <p className="text-xs font-bold text-slate-400 uppercase mb-1">收货客户</p>
                       <p className="font-bold text-slate-900">{selectedDelivery.customer}</p>
                    </div>
                    <div>
                       <p className="text-xs font-bold text-slate-400 uppercase mb-1">联系人</p>
                       <p className="font-medium text-slate-900 flex items-center gap-2"><User size={14} /> {selectedDelivery.contact}</p>
                    </div>
                    <div>
                       <p className="text-xs font-bold text-slate-400 uppercase mb-1">地址</p>
                       <p className="font-medium text-slate-700 leading-relaxed">{selectedDelivery.address}</p>
                    </div>
                 </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Box className="text-orange-600" size={20} /> 包裹内容
                 </h3>
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm text-slate-700 font-medium">
                    {selectedDelivery.content}
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
            <Truck className="text-orange-600" size={24} />
            发货管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">安排物流发货，打印面单与跟踪物流轨迹</p>
        </div>
        <button className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-orange-700 shadow-lg shadow-orange-200">
            <PackageCheck size={18} />
            批量发货
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {deliveries.map((d, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-orange-300 transition-all cursor-pointer group" onClick={() => handleViewDetail(d)}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{d.id}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${d.status === '运输中' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                {d.status}
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-orange-600 transition-colors">{d.customer}</h3>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase font-bold">发货日期</p>
                        <p className="text-sm font-bold text-slate-700">{d.date}</p>
                    </div>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">关联订单</span>
                        <span className="font-mono font-bold text-slate-700">{d.orderId}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">承运商</span>
                        <span className="font-bold text-slate-700">{d.carrier}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">运单号</span>
                        <span className="font-mono font-bold text-blue-600">{d.tracking}</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2">
                        <Printer size={16} /> 打印面单
                    </button>
                    <button className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2">
                        <MapPin size={16} /> 轨迹详情
                    </button>
                </div>
            </div>
         ))}
      </div>
    </div>
  );

  return view === 'detail' ? renderDetail() : renderList();
};

export default SupplierDelivery;
