
import React, { useState } from 'react';
import { 
  Plus, Layers, BrainCircuit, ChevronLeft, ChevronRight, X, CheckCircle2, AlertTriangle, Calendar, Building2, MapPin
} from 'lucide-react';

interface ProcurementNeedsProps {
  onNavigateToPlan: (data?: any) => void;
}

const ProcurementNeeds: React.FC<ProcurementNeedsProps> = ({ onNavigateToPlan }) => {
  const [needs, setNeeds] = useState([
    { id: 'REQ-HR-001', dept: '人力资源部', item: 'A4纸、黑色签字笔', category: '办公用品', qty: 50, budget: 2000, date: '2023-10-25', status: '待处理', risk: null },
    { id: 'REQ-IT-002', dept: 'IT部', item: '戴尔显示器 24寸', category: 'IT设备', qty: 10, budget: 12000, date: '2023-10-26', status: '待处理', risk: null },
    { id: 'REQ-MFG-003', dept: '生产部', item: '劳保手套、防护眼镜', category: 'MRO', qty: 500, budget: 5000, date: '2023-10-26', status: '待处理', risk: null },
    { id: 'REQ-ADM-004', dept: '行政部', item: '打印纸、文件夹', category: '办公用品', qty: 100, budget: 4000, date: '2023-10-27', status: '待处理', risk: null },
    { id: 'REQ-MKT-005', dept: '市场部', item: '宣传画册印制', category: '营销物料', qty: 2000, budget: 15000, date: '2023-10-28', status: '待处理', risk: null },
    { id: 'REQ-FIN-006', dept: '财务部', item: '财务凭证装订机', category: '办公设备', qty: 2, budget: 3000, date: '2023-10-28', status: '待处理', risk: null },
    { id: 'REQ-RD-007', dept: '研发部', item: '测试服务器', category: 'IT设备', qty: 3, budget: 45000, date: '2023-10-29', status: '待处理', risk: null },
    { id: 'REQ-HR-008', dept: '人力资源部', item: '员工体检服务', category: '员工福利', qty: 150, budget: 60000, date: '2023-10-29', status: '待处理', risk: null },
    { id: 'REQ-MFG-009', dept: '生产部', item: '工业润滑油', category: 'MRO', qty: 20, budget: 8000, date: '2023-10-30', status: '待处理', risk: null },
    { id: 'REQ-ADM-010', dept: '行政部', item: '绿植租赁服务', category: '行政服务', qty: 1, budget: 12000, date: '2023-10-30', status: '待处理', risk: null },
    { id: 'REQ-IT-011', dept: 'IT部', item: '无线路由器', category: 'IT设备', qty: 5, budget: 2500, date: '2023-10-31', status: '待处理', risk: null },
    { id: 'REQ-MKT-012', dept: '市场部', item: '展会搭建服务', category: '营销服务', qty: 1, budget: 80000, date: '2023-10-31', status: '待处理', risk: null },
    { id: 'REQ-RD-013', dept: '研发部', item: '正版设计软件授权', category: '软件许可', qty: 10, budget: 50000, date: '2023-11-01', status: '待处理', risk: null },
    { id: 'REQ-MFG-014', dept: '生产部', item: '叉车维修配件', category: 'MRO', qty: 15, budget: 6500, date: '2023-11-01', status: '待处理', risk: null },
    { id: 'REQ-HR-015', dept: '人力资源部', item: '中秋节礼品', category: '员工福利', qty: 200, budget: 40000, date: '2023-11-02', status: '待处理', risk: null },
    { id: 'REQ-ADM-016', dept: '行政部', item: '保洁用品', category: '办公用品', qty: 50, budget: 1500, date: '2023-11-02', status: '待处理', risk: null },
    { id: 'REQ-FIN-017', dept: '财务部', item: '验钞机', category: '办公设备', qty: 3, budget: 1200, date: '2023-11-03', status: '待处理', risk: null },
    { id: 'REQ-IT-018', dept: 'IT部', item: '移动硬盘 2TB', category: 'IT设备', qty: 8, budget: 4000, date: '2023-11-03', status: '待处理', risk: null },
    { id: 'REQ-MKT-019', dept: '市场部', item: '定制伴手礼', category: '营销物料', qty: 500, budget: 25000, date: '2023-11-04', status: '待处理', risk: null },
    { id: 'REQ-RD-020', dept: '研发部', item: '3D打印耗材', category: '研发物料', qty: 30, budget: 4500, date: '2023-11-04', status: '待处理', risk: null },
  ]);
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);

  const [isMerging, setIsMerging] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeAnalysisData, setMergeAnalysisData] = useState<any>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const totalPages = Math.ceil(needs.length / itemsPerPage);
  const currentNeeds = needs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleNeedSelection = (id: string) => {
    setSelectedNeeds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    const currentIds = currentNeeds.map(n => n.id);
    const allSelected = currentIds.every(id => selectedNeeds.includes(id));
    
    if (allSelected) {
      setSelectedNeeds(prev => prev.filter(id => !currentIds.includes(id)));
    } else {
      setSelectedNeeds(prev => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const handleMergeNeeds = () => {
    if (selectedNeeds.length < 2) {
      alert("请至少选择两条采购需求进行智能合并分析");
      return;
    }
    
    setIsMerging(true);
    
    // Simulate a fast AI processing delay for better UX
    setTimeout(() => {
      const itemsToMerge = needs.filter(n => selectedNeeds.includes(n.id));
      const totalBudget = itemsToMerge.reduce((sum, item) => sum + item.budget, 0);
      
      // Group by category to make the overview more intelligent
      const categories = Array.from(new Set(itemsToMerge.map(i => i.category)));
      const depts = Array.from(new Set(itemsToMerge.map(i => i.dept)));
      
      const planData = {
        title: `联合采购项目（${categories.join('、')}等）`,
        budget: totalBudget,
        overview: `基于 ${depts.join('、')} 等部门需求的智能合并。系统已将选中的同类物资（${categories.join('、')}）合并采购以发挥规模效应，争取更优的集采折扣。`,
        items: itemsToMerge.map(item => ({
          name: item.item,
          spec: '-', // Default spec
          qty: item.qty,
          unit: '件', // Default unit
          price: item.budget / item.qty // Estimate price
        }))
      };

      setMergeAnalysisData({
        planData,
        itemsToMerge,
        categories,
        depts,
        totalBudget,
        reasons: [
          { icon: <Layers size={16} className="text-blue-600"/>, title: '采购内容相似度高', desc: `选中的需求主要集中在 ${categories.join('、')} 类别，合并采购可有效降低采购成本。` },
          { icon: <Building2 size={16} className="text-emerald-600"/>, title: '跨部门协同', desc: `整合了 ${depts.join('、')} 的共性需求，减少重复采购流程。` },
          { icon: <Calendar size={16} className="text-purple-600"/>, title: '交期相近', desc: '各需求期望交货日期在同一时间窗口内，适合统一安排物流配送。' },
          { icon: <MapPin size={16} className="text-amber-600"/>, title: '交货地点一致', desc: '需求部门均位于集团总部大楼，便于统一收货与分发。' }
        ]
      });
      
      setIsMerging(false);
      setIsMergeModalOpen(true);
    }, 800); // Slightly longer delay for "analysis"
  };

  const handleConfirmMerge = () => {
    if (mergeAnalysisData) {
      setSelectedNeeds([]);
      setIsMergeModalOpen(false);
      onNavigateToPlan(mergeAnalysisData.planData);
    }
  };

  const renderMergeModal = () => {
    if (!isMergeModalOpen || !mergeAnalysisData) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                <BrainCircuit size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">智能辅助合并分析报告</h3>
                <p className="text-sm text-slate-500">AI 已对您选择的 {mergeAnalysisData.itemsToMerge.length} 项需求进行深度分析</p>
              </div>
            </div>
            <button onClick={() => setIsMergeModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-xl transition-colors">
              <X size={24} />
            </button>
          </div>
          
          <div className="p-8 overflow-y-auto flex-1 space-y-8">
            {/* Analysis Reasons */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" /> 合并依据与优势
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mergeAnalysisData.reasons.map((reason: any, idx: number) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex gap-4">
                    <div className="mt-1 bg-white p-2 rounded-lg shadow-sm h-fit">
                      {reason.icon}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 mb-1">{reason.title}</div>
                      <div className="text-sm text-slate-500 leading-relaxed">{reason.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Merged Items Preview */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Layers size={16} className="text-blue-500" /> 拟合并需求清单
              </h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold">需求部门</th>
                      <th className="px-4 py-3 font-bold">物资名称</th>
                      <th className="px-4 py-3 font-bold">类别</th>
                      <th className="px-4 py-3 font-bold text-right">数量</th>
                      <th className="px-4 py-3 font-bold text-right">预算</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mergeAnalysisData.itemsToMerge.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{item.dept}</td>
                        <td className="px-4 py-3 text-slate-700">{item.item}</td>
                        <td className="px-4 py-3 text-slate-500">{item.category}</td>
                        <td className="px-4 py-3 text-right font-mono">{item.qty}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">¥{item.budget.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-bold text-slate-900 text-right">合并总预算：</td>
                      <td colSpan={2} className="px-4 py-3 font-bold text-blue-600 text-right text-lg font-mono">
                        ¥{mergeAnalysisData.totalBudget.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            
            <div className="bg-blue-50 text-blue-800 p-4 rounded-2xl flex gap-3 items-start border border-blue-100">
              <AlertTriangle size={20} className="text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-bold">AI 建议：</span> 
                确认合并后，系统将自动生成一份联合采购方案草稿，您可以继续在方案中调整采购方式、供应商邀请名单及具体执行计划。
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
            <button 
              onClick={() => setIsMergeModalOpen(false)}
              className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 transition-colors"
            >
              取消合并
            </button>
            <button 
              onClick={handleConfirmMerge}
              className="px-6 py-2.5 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all flex items-center gap-2"
            >
              <CheckCircle2 size={18} />
              确认合并并生成方案
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900">部门采购需求汇总</h2>
          <p className="text-sm text-slate-500 mt-1">HR、IT、生产及行政部门提交的待处理需求池</p>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={handleMergeNeeds}
             disabled={isMerging}
             className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-70"
           >
             {isMerging ? <BrainCircuit size={18} className="animate-pulse" /> : <Layers size={18} />}
             {isMerging ? '智能合并中...' : '智能辅助合并'}
           </button>
           <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-800 transition-all">
             <Plus size={18} /> 新增需求
           </button>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-fit">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-left">
              <tr>
                <th className="px-6 py-4 w-12">
                  <input 
                    type="checkbox" 
                    checked={currentNeeds.length > 0 && currentNeeds.every(n => selectedNeeds.includes(n.id))}
                    onChange={handleSelectAll}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer" 
                  />
                </th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase w-20 text-center whitespace-nowrap">序号</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase">单号 / 部门</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase">物资内容</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase">类别</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-right">预估预算</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">AI 预审</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentNeeds.map((n, idx) => (
                <tr key={n.id} className={`hover:bg-slate-50 transition-colors ${selectedNeeds.includes(n.id) ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      checked={selectedNeeds.includes(n.id)} 
                      onChange={() => toggleNeedSelection(n.id)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer" 
                    />
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-slate-400 whitespace-nowrap">
                    {(currentPage - 1) * itemsPerPage + idx + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{n.dept}</div>
                    <div className="text-xs text-slate-400 font-mono">{n.id}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">{n.item} <span className="text-slate-400">x{n.qty}</span></td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">{n.category}</span></td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">¥{n.budget.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <button className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="点击进行AI单据合规性检查">
                      <BrainCircuit size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="text-sm text-slate-500 font-medium">
              显示 {(currentPage - 1) * itemsPerPage + 1} 到 {Math.min(currentPage * itemsPerPage, needs.length)} 条，共 {needs.length} 条
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPage(idx + 1)}
                  className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                    currentPage === idx + 1 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {renderMergeModal()}
    </div>
  );
};

export default ProcurementNeeds;
