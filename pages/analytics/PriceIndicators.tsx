
import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, AlertCircle, Globe, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const priceTrendData = [
  { month: '1月', myPrice: 4200, marketPrice: 4300 },
  { month: '2月', myPrice: 4150, marketPrice: 4350 },
  { month: '3月', myPrice: 4250, marketPrice: 4400 },
  { month: '4月', myPrice: 4300, marketPrice: 4600 }, // Market spike
  { month: '5月', myPrice: 4280, marketPrice: 4550 },
  { month: '6月', myPrice: 4100, marketPrice: 4200 },
];

const materialVariances = [
  { code: 'M001', name: '聚丙烯颗粒 (PP)', avgPrice: 7200, marketPrice: 7500, variance: -4.0, trend: 'down' },
  { code: 'M002', name: '304不锈钢板', avgPrice: 15200, marketPrice: 14800, variance: 2.7, trend: 'up' },
  { code: 'M003', name: '工业润滑油', avgPrice: 850, marketPrice: 850, variance: 0.0, trend: 'flat' },
  { code: 'M004', name: '服务器内存条 64G', avgPrice: 1800, marketPrice: 2100, variance: -14.3, trend: 'down' },
  { code: 'M005', name: 'A4复印纸', avgPrice: 180, marketPrice: 185, variance: -2.7, trend: 'down' },
];

const marketIndices = [
  { name: 'LME 铜', value: 8120.5, change: 1.2, trend: 'up' },
  { name: 'WTI 原油', value: 78.4, change: -0.5, trend: 'down' },
  { name: '螺纹钢', value: 3850, change: 0.8, trend: 'up' },
  { name: '聚乙烯', value: 8150, change: -1.5, trend: 'down' },
  { name: '纸浆', value: 5600, change: 0.2, trend: 'up' }
];

const PriceIndicators: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      
      {/* Market Indices Ticker */}
      <div className="bg-slate-900 rounded-2xl p-4 text-white flex items-center justify-between shadow-xl relative overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-50"></div>
         <div className="flex items-center gap-4 relative z-10">
            <div className="p-2 bg-white/10 rounded-lg">
               <Globe size={20} className="text-blue-300" />
            </div>
            <div>
               <h3 className="font-bold text-sm">全球大宗商品行情</h3>
               <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Zap size={10} className="text-yellow-400 fill-yellow-400" /> 数据实时更新中
               </p>
            </div>
         </div>
         
         <div className="flex gap-8 overflow-x-auto no-scrollbar relative z-10 px-4">
            {marketIndices.map((idx, i) => (
               <div key={i} className="flex flex-col min-w-[100px]">
                  <span className="text-xs text-slate-400 font-bold mb-1">{idx.name}</span>
                  <div className="flex items-center gap-2">
                     <span className="text-lg font-black tracking-tight">{idx.value}</span>
                     <span className={`text-[10px] font-bold flex items-center ${idx.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                        {idx.trend === 'up' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {Math.abs(idx.change)}%
                     </span>
                  </div>
               </div>
            ))}
         </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="text-blue-600" size={20} /> 关键物资价格走势
              </h3>
              <p className="text-xs text-slate-500 mt-1">对比企业采购单价与行业市场指数 (基准: 聚丙烯)</p>
            </div>
            <select className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-3 py-2 outline-none">
              <option>聚丙烯颗粒 (PP)</option>
              <option>304 不锈钢</option>
              <option>服务器内存</option>
            </select>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" name="我司采购均价" dataKey="myPrice" stroke="#2563eb" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                <Line type="monotone" name="市场行情指数" dataKey="marketPrice" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="md:w-96 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
           <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
             <AlertCircle className="text-blue-600" size={20} /> 价格异动预警
           </h3>
           <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {materialVariances.map((m, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                   <div className="flex justify-between items-start mb-2">
                      <div>
                         <span className="text-xs font-bold text-slate-900 block">{m.name}</span>
                         <span className="text-[10px] text-slate-400 font-mono">{m.code}</span>
                      </div>
                      <span className={`text-xs font-black px-1.5 py-0.5 rounded ${
                         m.variance > 0 ? 'bg-red-50 text-red-600' : 
                         m.variance < 0 ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                         {m.variance > 0 ? '+' : ''}{m.variance}%
                      </span>
                   </div>
                   <div className="flex justify-between text-[10px] text-slate-500">
                      <span>采购: ¥{m.avgPrice}</span>
                      <span>市场: ¥{m.marketPrice}</span>
                   </div>
                </div>
              ))}
           </div>
           <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                 <span className="font-bold text-blue-600">AI 洞察：</span> 
                 近期内存条市场价格持续走低，建议IT部门适当增加备货以锁定低成本。
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default PriceIndicators;
