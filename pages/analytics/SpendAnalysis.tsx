
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { PieChart as PieChartIcon, FileText } from 'lucide-react';

const supplierRankData = [
  { name: '中国石化', value: 450, category: '原材料' },
  { name: '浪潮信息', value: 280, category: 'IT设备' },
  { name: '宝钢股份', value: 210, category: '原材料' },
  { name: '顺丰速运', value: 150, category: '物流服务' },
  { name: '京东企业购', value: 95, category: '综合物资' },
];

const categoryData = [
  { name: '生产原料', value: 450000, color: '#2563eb' },
  { name: 'IT设备', value: 210000, color: '#4f46e5' },
  { name: '物流服务', value: 180000, color: '#7c3aed' },
  { name: '办公用品', value: 85000, color: '#9333ea' },
  { name: '行政服务', value: 120000, color: '#c026d3' },
];

const largeOrders = [
  { id: 'PO-20231025-001', title: '年度服务器集群扩容', supplier: '浪潮信息', amount: 2450000, date: '2023-10-25', dept: '技术部' },
  { id: 'PO-20231020-003', title: 'Q4季度原材料采购', supplier: '中国石化', amount: 1800000, date: '2023-10-20', dept: '生产部' },
  { id: 'PO-20231015-012', title: '新厂区安防监控系统', supplier: '海康威视', amount: 850000, date: '2023-10-15', dept: '行政部' },
  { id: 'PO-20231008-005', title: '自动化流水线改造', supplier: '西门子中国', amount: 620000, date: '2023-10-08', dept: '生产部' },
  { id: 'PO-20231001-002', title: '全国物流运输年框', supplier: '顺丰速运', amount: 500000, date: '2023-10-01', dept: '物流部' },
];

const SpendAnalysis: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
             <PieChartIcon className="text-blue-600" size={20} /> 采购支出占比 (按品类)
          </h3>
          <div className="h-[300px] flex items-center">
            <div className="flex-1 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-40 flex flex-col justify-center gap-3">
              {categoryData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                  <div className="flex flex-col">
                     <span className="text-[10px] text-slate-500">{d.name}</span>
                     <span className="text-xs font-bold text-slate-900">¥{(d.value/10000).toFixed(1)}w</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
             <BarChart className="text-blue-600" size={20} /> 主要成交供应商分析
          </h3>
          <div className="space-y-4">
             {supplierRankData.map((s, i) => (
                <div key={i} className="flex items-center gap-4">
                   <div className="w-8 text-center text-xs font-bold text-slate-400">0{i+1}</div>
                   <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                         <span className="font-bold text-slate-700">{s.name}</span>
                         <span className="text-slate-500">¥{s.value}万</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                         <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(s.value / 450) * 100}%` }}></div>
                      </div>
                   </div>
                </div>
             ))}
          </div>
        </div>
      </div>

      {/* Large Transactions Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
               <FileText className="text-blue-600" size={20} /> 大额采购明细 Top 5
            </h3>
            <button className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">导出全部</button>
         </div>
         <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-left text-slate-500">
               <tr>
                  <th className="px-6 py-4 font-bold uppercase w-16 text-center">序号</th>
                  <th className="px-6 py-4 font-bold uppercase">订单编号</th>
                  <th className="px-6 py-4 font-bold uppercase">项目名称</th>
                  <th className="px-6 py-4 font-bold uppercase">供应商</th>
                  <th className="px-6 py-4 font-bold uppercase">申请部门</th>
                  <th className="px-6 py-4 font-bold uppercase text-right">金额</th>
                  <th className="px-6 py-4 font-bold uppercase text-center">日期</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {largeOrders.map((order, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                     <td className="px-6 py-4 text-center font-bold text-slate-400">{i + 1}</td>
                     <td className="px-6 py-4 font-mono text-slate-500 text-xs font-bold">{order.id}</td>
                     <td className="px-6 py-4 font-bold text-slate-900">{order.title}</td>
                     <td className="px-6 py-4 text-slate-700">{order.supplier}</td>
                     <td className="px-6 py-4 text-slate-600"><span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{order.dept}</span></td>
                     <td className="px-6 py-4 text-right font-black text-slate-900">¥{order.amount.toLocaleString()}</td>
                     <td className="px-6 py-4 text-center text-slate-500 text-xs font-medium">{order.date}</td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
};

export default SpendAnalysis;
