
import React, { useState } from 'react';
import { 
  Truck, Printer, Package, CreditCard, ArrowLeft, CheckCircle, 
  Box, MapPin, User, FileText, Link as LinkIcon, ChevronRight
} from 'lucide-react';

const OrderManagement: React.FC = () => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const orders = [
    { id: 'PO-20231101-001', supplier: '苏州精控机械有限公司', amount: 85000, date: '2023-11-01', status: '待发货', items: '精密轴承 x500' },
    { id: 'PO-20231028-005', supplier: '晨光科力普', amount: 4500, date: '2023-10-28', status: '已发货', items: 'A4纸, 硒鼓' },
    { id: 'PO-20231025-012', supplier: '戴尔(中国)有限公司', amount: 125000, date: '2023-10-25', status: '已收货', items: 'Latitude 笔记本 x15' },
    { id: 'PO-20231020-003', supplier: '顺丰速运', amount: 12000, date: '2023-10-20', status: '已完成', items: '10月物流服务费' },
  ];

  const renderOrderDetail = () => {
    const order = {
        id: 'PO-20231101-001',
        status: '待发货', 
        supplier: '苏州精控机械有限公司',
        amount: 85000,
        createDate: '2023-11-01',
        contract: {
            id: 'CON-001',
            name: '2023年度原料框架协议',
            terms: '月结30天，验收合格后付款'
        },
        delivery: {
            deadline: '2023-11-15', // Contract agreed date
            location: '江苏省苏州市工业园区星湖街328号 2号仓库',
            contact: '库管-李四 (13900001111)',
            method: '供应商配送'
        },
        logistics: {
            carrier: '顺丰速运',
            trackingNo: 'SF1234567890',
            currentStatus: '运输中',
            steps: [
                { time: '2023-11-02 14:30', status: '运输中', desc: '快件已到达 [苏州新区中转场]', active: true },
                { time: '2023-11-02 09:15', status: '已发货', desc: '供应商已发货，快递员已揽件', active: false },
                { time: '2023-11-01 16:20', status: '仓库拣货', desc: '仓库正在拣货打包中', active: false },
                { time: '2023-11-01 10:30', status: '订单确认', desc: '供应商已确认订单，准备备货', active: false },
            ]
        },
        items: [
            { name: '精密轴承', spec: 'Model-X 高转速', qty: 500, unit: '个', price: 170, total: 85000 }
        ]
    };

    return (
       <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          {/* Header */}
          <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
             <div className="flex items-center gap-4">
                <button onClick={() => setSelectedOrderId(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                   <ArrowLeft size={24} />
                </button>
                <div>
                   <div className="flex items-center gap-3">
                      <h2 className="text-xl font-black text-slate-900">订单详情: {order.id}</h2>
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-black rounded uppercase border border-amber-100 flex items-center gap-1">
                         <Truck size={12} /> {order.status}
                      </span>
                   </div>
                   <p className="text-sm text-slate-500 mt-1">供应商: {order.supplier} · 下单日期: {order.createDate}</p>
                </div>
             </div>
             <div className="flex gap-3">
                <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                   <Printer size={18} /> 打印订单
                </button>
                <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg flex items-center gap-2">
                   <CreditCard size={18} /> 发起付款
                </button>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             {/* Left Column: Items & Logistics */}
             <div className="lg:col-span-2 space-y-6">
                 {/* Process Steps */}
                 <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center relative">
                        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-100 -z-0 mx-8"></div>
                        {['订单确认', '发货', '运输中', '收货验收'].map((step, idx) => {
                           const isActive = idx <= 2; // Mocking current step at index 2 (运输中)
                           return (
                              <div key={idx} className="relative z-10 flex flex-col items-center bg-white px-2">
                                 <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all ${
                                    isActive ? 'bg-blue-600 border-blue-100 text-white' : 'bg-white border-slate-200 text-slate-300'
                                 }`}>
                                    {isActive ? <CheckCircle size={18} /> : <div className="w-2 h-2 bg-slate-300 rounded-full"></div>}
                                 </div>
                                 <p className={`text-xs font-bold mt-2 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>{step}</p>
                              </div>
                           )
                        })}
                    </div>
                 </div>

                 {/* Order Items */}
                 <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                       <Box className="text-blue-600" size={20} /> 订单物资明细
                    </h3>
                    <table className="w-full text-sm">
                       <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                          <tr>
                             <th className="px-4 py-3 text-left rounded-l-xl">物资名称</th>
                             <th className="px-4 py-3 text-left">规格型号</th>
                             <th className="px-4 py-3 text-right">数量</th>
                             <th className="px-4 py-3 text-center">单位</th>
                             <th className="px-4 py-3 text-right">单价</th>
                             <th className="px-4 py-3 text-right rounded-r-xl">小计</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {order.items.map((item, i) => (
                             <tr key={i} className="hover:bg-slate-50">
                                <td className="px-4 py-4 font-bold text-slate-900">{item.name}</td>
                                <td className="px-4 py-4 text-slate-600">{item.spec}</td>
                                <td className="px-4 py-4 text-right font-mono">{item.qty}</td>
                                <td className="px-4 py-4 text-center text-slate-500">{item.unit}</td>
                                <td className="px-4 py-4 text-right font-mono text-slate-600">¥{item.price}</td>
                                <td className="px-4 py-4 text-right font-mono font-bold text-slate-900">¥{item.total.toLocaleString()}</td>
                             </tr>
                          ))}
                       </tbody>
                       <tfoot className="bg-slate-50/50">
                          <tr>
                             <td colSpan={5} className="px-4 py-4 text-right font-bold text-slate-500 uppercase text-xs">订单总额 (含税)</td>
                             <td className="px-4 py-4 text-right font-black text-lg text-blue-600">¥{order.amount.toLocaleString()}</td>
                          </tr>
                       </tfoot>
                    </table>
                 </div>

                 {/* Logistics Tracking */}
                 <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                       <Truck className="text-blue-600" size={20} /> 物流跟踪
                    </h3>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl mb-6 border border-slate-100">
                       <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          <Package size={24} className="text-blue-600"/>
                       </div>
                       <div>
                          <p className="text-sm font-bold text-slate-900">{order.logistics.carrier} : {order.logistics.trackingNo}</p>
                          <p className="text-xs text-slate-500 mt-0.5">预计送达: 2023-11-04 (剩余 2 天)</p>
                       </div>
                       <button className="ml-auto text-xs font-bold text-blue-600 hover:underline">复制单号</button>
                    </div>

                    <div className="pl-4 border-l-2 border-slate-100 space-y-8">
                       {order.logistics.steps.map((step, i) => (
                          <div key={i} className="relative">
                             <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${step.active ? 'bg-blue-600 scale-125' : 'bg-slate-300'}`}></div>
                             <p className={`text-sm font-bold ${step.active ? 'text-blue-600' : 'text-slate-900'}`}>{step.status}</p>
                             <p className="text-xs text-slate-500 mt-1 mb-1">{step.time}</p>
                             <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg inline-block">{step.desc}</p>
                          </div>
                       ))}
                    </div>
                 </div>
             </div>

             {/* Right Column: Meta Info */}
             <div className="space-y-6">
                 {/* Contract Association */}
                 <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                       <FileText className="text-blue-600" size={20} /> 关联合同
                    </h3>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-4">
                       <div className="flex items-center gap-2 mb-2">
                          <LinkIcon size={14} className="text-slate-400" />
                          <span className="text-xs font-bold text-slate-500 uppercase">来源合同</span>
                       </div>
                       <p className="font-bold text-slate-900 text-sm mb-1">{order.contract.name}</p>
                       <p className="text-xs text-slate-400 font-mono">{order.contract.id}</p>
                    </div>
                    <div className="space-y-3 text-sm">
                       <div className="flex justify-between py-2 border-b border-slate-50">
                          <span className="text-slate-500">结算条款</span>
                          <span className="font-medium text-slate-900">{order.contract.terms}</span>
                       </div>
                    </div>
                    <button 
                        onClick={() => alert('跳转至合同详情页面')}
                        className="w-full mt-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors"
                    >
                       查看合同详情
                    </button>
                 </div>

                 {/* Delivery Info */}
                 <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                       <MapPin className="text-blue-600" size={20} /> 交付信息
                    </h3>
                    <div className="space-y-4">
                       <div>
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">约定交货日期</p>
                          <div className="flex items-center gap-2 text-slate-900 font-bold">
                             {order.delivery.deadline}
                          </div>
                       </div>
                       <div>
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">收货地址</p>
                          <p className="text-sm text-slate-700 leading-relaxed font-medium">{order.delivery.location}</p>
                       </div>
                       <div className="pt-4 border-t border-slate-50">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                                <User size={14} className="text-slate-500" />
                             </div>
                             <div>
                                <p className="text-xs font-bold text-slate-900">{order.delivery.contact}</p>
                                <p className="text-[10px] text-slate-500 uppercase">现场收货人</p>
                             </div>
                          </div>
                       </div>
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
            <Truck className="text-blue-600" size={24} />
            订单协同
          </h1>
          <p className="text-sm text-slate-500 mt-1">采购订单下达、发货跟踪及收货验收</p>
        </div>
        <div className="flex gap-3">
           <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl font-bold hover:bg-slate-50 transition-all">
              <Printer size={18} /> 批量打印
           </button>
           <button className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-800 shadow-lg transition-all">
              <Package size={18} />
              新建订单
           </button>
        </div>
      </div>

      {/* Order Status Cards */}
      <div className="grid grid-cols-4 gap-6">
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 text-blue-100"><Truck size={64} /></div>
            <p className="text-sm font-bold text-slate-500 z-10">待发货订单</p>
            <div>
               <span className="text-3xl font-black text-slate-900">5</span>
               <span className="text-xs text-blue-600 font-bold ml-2 bg-blue-50 px-2 py-0.5 rounded">急需跟进</span>
            </div>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
            <p className="text-sm font-bold text-slate-500">在途物资</p>
            <div>
               <span className="text-3xl font-black text-slate-900">12</span>
               <span className="text-xs text-slate-400 ml-2">单</span>
            </div>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
            <p className="text-sm font-bold text-slate-500">待验收</p>
            <div>
               <span className="text-3xl font-black text-slate-900">3</span>
               <span className="text-xs text-amber-600 font-bold ml-2 bg-amber-50 px-2 py-0.5 rounded">需质检</span>
            </div>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
            <p className="text-sm font-bold text-slate-500">本月完成</p>
            <div>
               <span className="text-3xl font-black text-slate-900">45</span>
               <span className="text-xs text-green-600 font-bold ml-2">98% 及时率</span>
            </div>
         </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
         <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-left">
               <tr>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase w-20 text-center">序号</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase">订单号</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase">供应商</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase">订单内容摘要</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-right">金额</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">状态</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase">下单日期</th>
                  <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {orders.map((o, i) => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedOrderId(o.id)}>
                     <td className="px-6 py-4 text-center font-bold text-slate-400">{i + 1}</td>
                     <td className="px-6 py-4 font-mono font-bold text-slate-900">{o.id}</td>
                     <td className="px-6 py-4 font-bold text-slate-700">{o.supplier}</td>
                     <td className="px-6 py-4 text-slate-600">{o.items}</td>
                     <td className="px-6 py-4 text-right font-black text-slate-900">¥{o.amount.toLocaleString()}</td>
                     <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                           o.status === '待发货' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                           o.status === '已发货' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                           o.status === '已收货' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                           'bg-green-50 text-green-700 border border-green-100'
                        }`}>
                           {o.status}
                        </span>
                     </td>
                     <td className="px-6 py-4 text-slate-500 font-medium">{o.date}</td>
                     <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => setSelectedOrderId(o.id)}
                          className="text-blue-600 font-bold hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors text-xs"
                        >
                           查看
                        </button>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );

  return selectedOrderId ? renderOrderDetail() : renderList();
};

export default OrderManagement;
