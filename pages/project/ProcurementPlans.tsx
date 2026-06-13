
import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Search, ChevronsUpDown, ChevronLeft, Trash2, 
  Package, Sparkles, CheckCircle2, Clock, Loader2, ShieldCheck, 
  BrainCircuit, Zap, AlertOctagon, ClipboardList, CheckSquare, X,
  TrendingUp, AlertTriangle, RefreshCcw
} from 'lucide-react';

interface PlanStage {
  name: string;
  status: 'completed' | 'current' | 'pending';
  date?: string;
  assignee?: string;
}

interface Plan {
  id: string;
  title: string;
  content: string;
  procurementMethod: string;
  solicitationMethod: string;
  budget: number;
  items: { name: string; qty: number; unit: string; budget: number }[];
  status: string;
  stages: PlanStage[];
  aiRiskAnalysis?: {
    score: number;
    issues: string[];
    suggestion: string;
  } | null;
  createDate: string;
  dept: string;
}

interface Material {
  id: string;
  code: string;
  name: string;
  spec: string;
  unit: string;
  price: number;
  category: string;
}

interface ProcurementPlansProps {
  initialData?: any;
  onClearInitialData?: () => void;
  onBackToNeeds?: () => void;
}

const ProcurementPlans: React.FC<ProcurementPlansProps> = ({ initialData, onClearInitialData, onBackToNeeds }) => {
  // --- State for Plans ---
  const [plans, setPlans] = useState<Plan[]>([
    {
      id: 'PLAN-2023-088',
      title: '2023年度第四季度办公用品集中采购',
      content: '集团总部及各分公司Q4季度常规办公消耗品、打印耗材集中采购，包含A4纸、硒鼓、文件夹等物资。',
      procurementMethod: '询价',
      solicitationMethod: '邀请',
      budget: 158000,
      dept: '行政部',
      items: [
        { name: 'A4复印纸 (80g)', qty: 500, unit: '箱', budget: 90000 },
        { name: 'HP原装硒鼓', qty: 200, unit: '个', budget: 68000 }
      ],
      status: '审批中',
      createDate: '2023-10-25',
      stages: [
        { name: '需求整合', status: 'completed', date: '10-25 09:00', assignee: '系统自动' },
        { name: '方案制定', status: 'completed', date: '10-25 14:30', assignee: '张经理' },
        { name: '方案审批', status: 'current', date: '处理中', assignee: '王总监' },
        { name: '采购执行', status: 'pending' },
        { name: '验收归档', status: 'pending' }
      ],
      aiRiskAnalysis: null
    },
    {
      id: 'PLAN-2023-092',
      title: '二号车间自动化流水线设备改造',
      content: '生产线机械臂升级及传送带控制系统更换，需包含安装调试服务。',
      procurementMethod: '公开招标',
      solicitationMethod: '公开',
      budget: 4500000,
      dept: '生产技术部',
      items: [
        { name: '六轴工业机械臂', qty: 4, unit: '台', budget: 3200000 },
        { name: '智能传送带系统', qty: 1, unit: '套', budget: 1300000 }
      ],
      status: '方案制定',
      createDate: '2023-10-27',
      stages: [
        { name: '需求整合', status: 'completed', date: '10-27 10:00', assignee: '李工' },
        { name: '方案制定', status: 'current', date: '处理中', assignee: '采购部' },
        { name: '方案审批', status: 'pending' },
        { name: '招标公告', status: 'pending' },
        { name: '开标评标', status: 'pending' }
      ],
      aiRiskAnalysis: null
    }
  ]);
  
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [activeStageIndex, setActiveStageIndex] = useState<number>(0);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [isRiskScanning, setIsRiskScanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('全部方式');

  // --- State for Material Modal & New Plan Items ---
  const [newPlanItems, setNewPlanItems] = useState<{
    id: string;
    name: string;
    spec: string;
    qty: number;
    unit: string;
    price: number; // User entered budget price
    marketPrice?: number; // Fetched market price
  }[]>([
    { id: 'item-1', name: '示例物资', spec: '常规规格', qty: 1, unit: '个', price: 0, marketPrice: 0 }
  ]);

  // --- Create Form State ---
  const [createForm, setCreateForm] = useState({
    title: '',
    budget: 0,
    overview: '',
    method: '询价',
    solicitationMethod: '公开',
    isUrgent: '普通',
    needApproval: '否'
  });

  const [isSuggestingMethod, setIsSuggestingMethod] = useState(false);
  const [aiMethodSuggestion, setAiMethodSuggestion] = useState<any>(null);

  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [materialLibrary, setMaterialLibrary] = useState<Material[]>([
    { id: 'M001', code: 'MT-001', name: 'A4复印纸', spec: '70g 500张/包', unit: '包', price: 25, category: '办公用品' },
    { id: 'M002', code: 'MT-002', name: '黑色签字笔', spec: '0.5mm 按动式', unit: '支', price: 2, category: '办公用品' },
    { id: 'M003', code: 'MT-003', name: '戴尔显示器', spec: '24寸 IPS 1080P', unit: '台', price: 1200, category: 'IT设备' },
    { id: 'M004', code: 'MT-004', name: '劳保手套', spec: '棉纱耐磨', unit: '双', price: 5, category: 'MRO' },
    { id: 'M005', code: 'MT-005', name: '六轴机械臂', spec: '负载10kg 臂展1.5m', unit: '台', price: 85000, category: '生产设备' },
    { id: 'M006', code: 'MT-006', name: '工业润滑油', spec: 'L-HM46 18L/桶', unit: '桶', price: 380, category: 'MRO' },
    { id: 'M007', code: 'MT-007', name: '服务器内存', spec: '32G DDR4 ECC', unit: '条', price: 850, category: 'IT设备' },
  ]);
  const [materialSearchTerm, setMaterialSearchTerm] = useState('');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false);
  const [newMaterialForm, setNewMaterialForm] = useState<Partial<Material>>({ name: '', spec: '', unit: '', price: 0, category: '通用' });
  const [cameFromNeeds, setCameFromNeeds] = useState(false);

  // --- Handlers ---

  useEffect(() => {
    if (initialData) {
      setIsEditingPlan(true);
      setSelectedPlanId(null);
      setCameFromNeeds(true);
      
      setCreateForm(prev => ({
        ...prev,
        title: initialData.title || '',
        budget: initialData.budget || 0,
        overview: initialData.overview || ''
      }));

      if (initialData.items && Array.isArray(initialData.items)) {
        setNewPlanItems(initialData.items.map((item: any, idx: number) => ({
           id: item.id || `ITEM-PRE-${Date.now()}-${idx}`,
           name: item.name,
           spec: item.spec || '-',
           qty: item.qty || 1,
           unit: item.unit || '件',
           price: item.price || 0,
           marketPrice: item.price * (1 + (Math.random() * 0.2 - 0.1)) // Mock logic: +/- 10%
        })));
      }

      if (onClearInitialData) {
        onClearInitialData();
      }
    }
  }, [initialData, onClearInitialData]);

  const handleSuggestMethod = () => {
    setIsSuggestingMethod(true);
    setTimeout(() => {
      let suggestedMethod = '询价';
      let suggestedSolicitation = '邀请';
      let reason = '';
      let recommendedSuppliers: any[] = [];

      if (createForm.budget > 1000000) {
        suggestedMethod = '招标';
        suggestedSolicitation = '公开';
        reason = '根据公司内控合规要求，采购预算超过100万元的项目，建议采用公开招标方式，以确保采购过程的公平、公正、公开，降低合规风险。';
      } else if (createForm.budget > 200000) {
        suggestedMethod = '竞价';
        suggestedSolicitation = '邀请';
        reason = '采购预算在20万至100万之间，且采购标的规格标准统一，建议采用邀请竞价方式。通过引入竞争机制，可有效降低采购成本，同时邀请优质供应商可保障履约质量。';
        recommendedSuppliers = [
          { name: '联想（北京）有限公司', rating: 4.9, reason: '历史合作评价极高，IT设备类核心供应商，响应速度快。' },
          { name: '京东企业购', rating: 4.8, reason: '品类齐全，物流配送能力强，价格透明。' },
          { name: '得力集团有限公司', rating: 4.7, reason: '办公用品类优质供应商，产品质量稳定，售后服务好。' }
        ];
      } else {
        suggestedMethod = '询价';
        suggestedSolicitation = '邀请';
        reason = '采购预算较小，为提高采购效率，建议采用邀请询价方式。直接向库内优质供应商询价，可快速锁定价格并完成采购。';
        recommendedSuppliers = [
          { name: '晨光文具股份有限公司', rating: 4.8, reason: '办公耗材类长期合作供应商，性价比高。' },
          { name: '齐心集团股份有限公司', rating: 4.6, reason: '综合办公物资供应商，可满足多样化需求。' }
        ];
      }

      setAiMethodSuggestion({
        method: suggestedMethod,
        solicitation: suggestedSolicitation,
        reason,
        suppliers: recommendedSuppliers
      });
      setCreateForm(prev => ({ ...prev, method: suggestedMethod, solicitationMethod: suggestedSolicitation }));
      setIsSuggestingMethod(false);
    }, 1000);
  };

  const handleRiskScan = async (planId: string) => {
    setIsRiskScanning(true);
    setTimeout(() => {
      setPlans(prev => prev.map(p => {
        if (p.id === planId) {
          const issues = [];
          let score = 95;
          if (p.budget > 1000000 && p.procurementMethod !== '公开招标') {
             issues.push('大额采购建议优先采用公开招标方式以确保合规');
             score -= 20;
          }
          if (p.budget > 50000 && p.solicitationMethod === '邀请' && p.items.length < 3) {
             issues.push('邀请招标供应商数量可能不足，建议增加候选名单');
             score -= 10;
          }
          if (issues.length === 0) issues.push('暂未发现明显合规风险');
          
          return {
            ...p,
            aiRiskAnalysis: {
              score,
              issues,
              suggestion: score > 80 ? '方案整体合规，建议推进。' : '建议修改采购方式或增加内控审批流程。'
            }
          };
        }
        return p;
      }));
      setIsRiskScanning(false);
    }, 1500);
  };

  const handleAddItemsFromModal = () => {
    const selected = materialLibrary.filter(m => selectedMaterialIds.includes(m.id));
    const newItems = selected.map(m => ({
      id: `ITEM-${Date.now()}-${m.id}`,
      name: m.name,
      spec: m.spec,
      qty: 1,
      unit: m.unit,
      price: m.price, // Default to system price as budget
      marketPrice: m.price * (1 + (Math.random() * 0.15 - 0.05)) // Simulate dynamic market price
    }));
    let currentItems = [...newPlanItems];
    if (currentItems.length === 1 && currentItems[0].name === '示例物资' && newItems.length > 0) {
      currentItems = [];
    }
    setNewPlanItems([...currentItems, ...newItems]);
    setIsMaterialModalOpen(false);
    setSelectedMaterialIds([]);
  };

  const handleCreateNewMaterial = () => {
    if (!newMaterialForm.name) return;
    const newMat: Material = {
      id: `M-${Date.now()}`,
      code: `MT-NEW-${Date.now().toString().slice(-4)}`,
      name: newMaterialForm.name || '未命名',
      spec: newMaterialForm.spec || '-',
      unit: newMaterialForm.unit || '件',
      price: Number(newMaterialForm.price) || 0,
      category: newMaterialForm.category || '通用'
    };
    setMaterialLibrary([newMat, ...materialLibrary]);
    setSelectedMaterialIds([...selectedMaterialIds, newMat.id]); 
    setIsCreatingMaterial(false);
    setNewMaterialForm({ name: '', spec: '', unit: '', price: 0, category: '通用' });
  };

  const updateNewPlanItem = (index: number, field: string, value: any) => {
    const updated = [...newPlanItems];
    updated[index] = { ...updated[index], [field]: value };
    setNewPlanItems(updated);
  };

  const removeNewPlanItem = (index: number) => {
    const updated = newPlanItems.filter((_, i) => i !== index);
    setNewPlanItems(updated);
  };

  // Calculate totals for budget variance analysis
  const totalBudget = newPlanItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
  const totalMarket = newPlanItems.reduce((acc, item) => acc + (item.qty * (item.marketPrice || item.price)), 0);
  const variancePercent = totalMarket > 0 ? ((totalBudget - totalMarket) / totalMarket) * 100 : 0;

  // --- Renders ---

  const renderCreatePlanForm = () => (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300 pb-24 relative">
      {/* --- Material Selection Modal --- */}
      {isMaterialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-900">选择采购物料</h3>
              <button onClick={() => setIsMaterialModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {!isCreatingMaterial ? (
                // VIEW 1: SELECT EXISTING
                <>
                  <div className="p-6 border-b border-slate-100 flex gap-4">
                    <div className="relative flex-1">
                      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="搜索物料编码、名称或规格..." 
                        value={materialSearchTerm}
                        onChange={(e) => setMaterialSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button 
                      onClick={() => setIsCreatingMaterial(true)} 
                      className="px-4 py-2.5 bg-white border border-blue-200 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 flex items-center gap-2"
                    >
                      <Plus size={16} /> 新建物料
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 w-12 text-center rounded-tl-lg">
                            <input type="checkbox" className="rounded text-blue-600" />
                          </th>
                          <th className="px-4 py-3 text-left">物料编码</th>
                          <th className="px-4 py-3 text-left">名称</th>
                          <th className="px-4 py-3 text-left">规格型号</th>
                          <th className="px-4 py-3 text-center">单位</th>
                          <th className="px-4 py-3 text-right">参考单价</th>
                          <th className="px-4 py-3 text-center rounded-tr-lg">分类</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {materialLibrary
                          .filter(m => m.name.includes(materialSearchTerm) || m.code.includes(materialSearchTerm))
                          .map(m => (
                          <tr 
                            key={m.id} 
                            onClick={() => {
                              setSelectedMaterialIds(prev => 
                                prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                              );
                            }}
                            className={`hover:bg-blue-50 cursor-pointer transition-colors ${selectedMaterialIds.includes(m.id) ? 'bg-blue-50/50' : ''}`}
                          >
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="checkbox" 
                                checked={selectedMaterialIds.includes(m.id)}
                                readOnly
                                className="rounded text-blue-600 focus:ring-blue-500 pointer-events-none" 
                              />
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.code}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{m.name}</td>
                            <td className="px-4 py-3 text-slate-600">{m.spec}</td>
                            <td className="px-4 py-3 text-center text-slate-500">{m.unit}</td>
                            <td className="px-4 py-3 text-right font-mono">¥{m.price}</td>
                            <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-500">{m.category}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                // VIEW 2: CREATE NEW
                <div className="flex-1 p-8 flex flex-col items-center justify-center bg-slate-50">
                   <div className="w-full max-w-lg bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                      <h4 className="text-lg font-black text-slate-900 mb-6 text-center">录入新物料信息</h4>
                      <div className="space-y-4">
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">物料名称 <span className="text-red-500">*</span></label>
                            <input 
                              type="text" 
                              value={newMaterialForm.name} 
                              onChange={e => setNewMaterialForm({...newMaterialForm, name: e.target.value})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" 
                              placeholder="例如：高级打印纸"
                            />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">规格型号</label>
                               <input 
                                 type="text" 
                                 value={newMaterialForm.spec} 
                                 onChange={e => setNewMaterialForm({...newMaterialForm, spec: e.target.value})}
                                 className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" 
                                 placeholder="例如：A4 80g"
                               />
                            </div>
                            <div>
                               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">计量单位</label>
                               <input 
                                 type="text" 
                                 value={newMaterialForm.unit} 
                                 onChange={e => setNewMaterialForm({...newMaterialForm, unit: e.target.value})}
                                 className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" 
                                 placeholder="例如：箱"
                               />
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">参考单价</label>
                               <input 
                                 type="number" 
                                 value={newMaterialForm.price} 
                                 onChange={e => setNewMaterialForm({...newMaterialForm, price: Number(e.target.value)})}
                                 className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" 
                                 placeholder="0.00"
                               />
                            </div>
                            <div>
                               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">物料分类</label>
                               <select 
                                 value={newMaterialForm.category} 
                                 onChange={e => setNewMaterialForm({...newMaterialForm, category: e.target.value})}
                                 className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                               >
                                  <option>通用</option>
                                  <option>办公用品</option>
                                  <option>IT设备</option>
                                  <option>MRO</option>
                                  <option>生产原料</option>
                               </select>
                            </div>
                         </div>
                      </div>
                      <div className="flex gap-3 mt-8">
                         <button 
                           onClick={() => setIsCreatingMaterial(false)}
                           className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200"
                         >
                           返回选择
                         </button>
                         <button 
                           onClick={handleCreateNewMaterial}
                           disabled={!newMaterialForm.name}
                           className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           保存并选中
                         </button>
                      </div>
                   </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {!isCreatingMaterial && (
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                <button 
                  onClick={() => setIsMaterialModalOpen(false)} 
                  className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50"
                >
                  取消
                </button>
                <button 
                  onClick={handleAddItemsFromModal}
                  disabled={selectedMaterialIds.length === 0}
                  className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  确认添加 ({selectedMaterialIds.length})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
         <button onClick={() => {
           setIsEditingPlan(false);
           if (cameFromNeeds && onBackToNeeds) {
             onBackToNeeds();
             setCameFromNeeds(false);
           }
         }} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
            <ChevronLeft size={24} />
         </button>
         <div>
            <h2 className="text-2xl font-black text-slate-900">新建采购方案</h2>
            <p className="text-sm text-slate-500">填写方案基本信息与执行策略</p>
         </div>
      </div>
      
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative">
        <div className="absolute left-0 top-8 w-1 h-6 bg-blue-600 rounded-r-lg"></div>
        <h3 className="text-lg font-black text-slate-900 mb-6 pl-4">基本信息</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
          <div className="col-span-1">
             <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase"><span className="text-red-500 mr-1">*</span>项目名称</label>
             <input 
               type="text" 
               value={createForm.title}
               onChange={e => setCreateForm({...createForm, title: e.target.value})}
               className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
               placeholder="请输入项目名称" 
             />
          </div>
          <div className="col-span-1">
             <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase"><span className="text-red-500 mr-1">*</span>紧急程度</label>
             <select 
               value={createForm.isUrgent}
               onChange={e => setCreateForm({...createForm, isUrgent: e.target.value})}
               className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
             >
                <option>普通</option><option>紧急</option>
             </select>
          </div>
          <div className="col-span-1">
             <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase"><span className="text-red-500 mr-1">*</span>是否需要审批</label>
             <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                  <input 
                    type="radio" 
                    name="approval" 
                    checked={createForm.needApproval === '是'} 
                    onChange={() => setCreateForm({...createForm, needApproval: '是'})}
                    className="w-4 h-4 text-blue-600 accent-blue-600" 
                  /> 
                  <span className="text-sm font-medium text-slate-700">是</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                  <input 
                    type="radio" 
                    name="approval" 
                    checked={createForm.needApproval === '否'} 
                    onChange={() => setCreateForm({...createForm, needApproval: '否'})}
                    className="w-4 h-4 text-blue-600 accent-blue-600" 
                  /> 
                  <span className="text-sm font-medium text-slate-700">否</span>
                </label>
             </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative">
         <div className="absolute left-0 top-8 w-1 h-6 bg-green-500 rounded-r-lg"></div>
         <h3 className="text-lg font-black text-slate-900 mb-6 pl-4">申请信息</h3>
         <div className="space-y-6">
            <div className="grid grid-cols-2 gap-8">
               <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">采购预算价 (万元)</label>
                  <input 
                    type="number" 
                    value={createForm.budget}
                    onChange={e => setCreateForm({...createForm, budget: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none" 
                    placeholder="0.00" 
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">项目概况介绍</label>
                  <textarea 
                    value={createForm.overview}
                    onChange={e => setCreateForm({...createForm, overview: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none resize-none h-10" 
                    placeholder="..."
                  ></textarea>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
               <div>
                  <div className="flex justify-between items-center mb-3">
                     <label className="block text-xs font-bold text-slate-500 uppercase">采购方式 & 征集方式</label>
                     <button 
                       onClick={handleSuggestMethod}
                       disabled={isSuggestingMethod || createForm.budget <= 0}
                       className="flex items-center gap-1 text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100 disabled:opacity-50 transition-colors"
                     >
                       {isSuggestingMethod ? <Loader2 size={12} className="animate-spin" /> : <BrainCircuit size={12} />}
                       AI 智能建议
                     </button>
                  </div>
                  <div className="flex gap-4 mb-4">
                     <div className="flex-1">
                        <select 
                          value={createForm.method}
                          onChange={e => setCreateForm({...createForm, method: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                        >
                           {['询价', '竞价', '协议采购', '招标', '商城'].map(m => <option key={m}>{m}</option>)}
                        </select>
                     </div>
                     <div className="flex-1">
                        <select 
                          value={createForm.solicitationMethod}
                          onChange={e => setCreateForm({...createForm, solicitationMethod: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                        >
                           {['公开', '邀请', '单一来源'].map(m => <option key={m}>{m}</option>)}
                        </select>
                     </div>
                  </div>
                  
                  {aiMethodSuggestion && (
                    <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                       <div className="flex items-start gap-2">
                          <Sparkles size={16} className="text-purple-600 mt-0.5 shrink-0" />
                          <div>
                             <p className="text-sm text-slate-700 leading-relaxed">
                               <span className="font-bold text-purple-700">AI 建议理由：</span>
                               {aiMethodSuggestion.reason}
                             </p>
                          </div>
                       </div>
                    </div>
                  )}
               </div>

               {createForm.solicitationMethod === '邀请' && aiMethodSuggestion?.suppliers?.length > 0 && (
                 <div className="animate-in fade-in slide-in-from-right-4">
                    <label className="block text-xs font-bold text-slate-500 mb-3 uppercase flex items-center gap-2">
                      <Sparkles size={14} className="text-purple-600" /> AI 推荐邀请供应商
                    </label>
                    <div className="space-y-3">
                       {aiMethodSuggestion.suppliers.map((sup: any, idx: number) => (
                         <div key={idx} className="bg-white border border-slate-200 p-3 rounded-xl flex items-start gap-3 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                               {sup.name.charAt(0)}
                            </div>
                            <div>
                               <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-slate-900 text-sm">{sup.name}</h4>
                                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                     ★ {sup.rating}
                                  </span>
                               </div>
                               <p className="text-xs text-slate-500 mt-1">{sup.reason}</p>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
               )}
            </div>
         </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative">
         <div className="absolute left-0 top-8 w-1 h-6 bg-purple-500 rounded-r-lg"></div>
         <div className="flex justify-between items-center mb-6 pl-4">
            <h3 className="text-lg font-black text-slate-900">采购内容明细</h3>
            <button 
              onClick={() => setIsMaterialModalOpen(true)}
              className="text-xs font-bold text-blue-600 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100 flex items-center gap-2 hover:bg-blue-100 transition-colors"
            >
               <Package size={14} /> 从物料库选择添加
            </button>
         </div>
         
         <div className="overflow-hidden border border-slate-100 rounded-xl">
            <table className="w-full text-sm">
               <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                     <th className="px-4 py-3 w-16 text-center">序号</th>
                     <th className="px-4 py-3 text-left">物资名称</th>
                     <th className="px-4 py-3 text-left">规格型号</th>
                     <th className="px-4 py-3 w-24 text-center">数量</th>
                     <th className="px-4 py-3 w-24 text-center">单位</th>
                     <th className="px-4 py-3 w-32 text-right">预算单价</th>
                     <th className="px-4 py-3 w-32 text-right text-blue-600">市场参考价</th>
                     <th className="px-4 py-3 w-32 text-right">小计</th>
                     <th className="px-4 py-3 w-16"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {newPlanItems.map((item, i) => {
                     const isPriceRisk = item.marketPrice && item.price < item.marketPrice * 0.9;
                     const isPriceHigh = item.marketPrice && item.price > item.marketPrice * 1.2;
                     
                     return (
                     <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            value={item.name}
                            onChange={(e) => updateNewPlanItem(i, 'name', e.target.value)}
                            className="w-full bg-transparent outline-none font-bold text-slate-700 placeholder:font-normal focus:bg-white focus:ring-2 focus:ring-purple-100 rounded px-2 transition-all" 
                            placeholder="输入名称" 
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            value={item.spec}
                            onChange={(e) => updateNewPlanItem(i, 'spec', e.target.value)}
                            className="w-full bg-transparent outline-none text-slate-600 focus:bg-white focus:ring-2 focus:ring-purple-100 rounded px-2 transition-all" 
                            placeholder="规格参数" 
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            value={item.qty}
                            onChange={(e) => updateNewPlanItem(i, 'qty', Number(e.target.value))}
                            className="w-full bg-transparent outline-none text-center font-mono focus:bg-white focus:ring-2 focus:ring-purple-100 rounded px-2 transition-all" 
                            placeholder="0" 
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            value={item.unit}
                            onChange={(e) => updateNewPlanItem(i, 'unit', e.target.value)}
                            className="w-full bg-transparent outline-none text-center focus:bg-white focus:ring-2 focus:ring-purple-100 rounded px-2 transition-all" 
                            placeholder="个" 
                          />
                        </td>
                        <td className="px-4 py-3 relative">
                          <input 
                            type="number" 
                            value={item.price}
                            onChange={(e) => updateNewPlanItem(i, 'price', Number(e.target.value))}
                            className={`w-full bg-transparent outline-none text-right font-mono focus:bg-white focus:ring-2 focus:ring-purple-100 rounded px-2 transition-all ${isPriceRisk ? 'text-red-500 font-bold' : ''} ${isPriceHigh ? 'text-amber-500 font-bold' : ''}`}
                            placeholder="0.00" 
                          />
                          {isPriceRisk && <AlertTriangle size={12} className="absolute top-1/2 -translate-y-1/2 left-0 text-red-500" title="预算显著低于市场价，可能流标" />}
                          {isPriceHigh && <AlertTriangle size={12} className="absolute top-1/2 -translate-y-1/2 left-0 text-amber-500" title="预算高于市场价20%，建议核实" />}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-400 text-xs">
                           {item.marketPrice ? `¥${item.marketPrice.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          ¥{(item.qty * item.price).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                           <button 
                             onClick={() => removeNewPlanItem(i)}
                             className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                           >
                             <Trash2 size={16} />
                           </button>
                        </td>
                     </tr>
                  );
                  })}
                  {newPlanItems.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        暂无明细，请点击右上角添加
                      </td>
                    </tr>
                  )}
               </tbody>
               <tfoot className="bg-slate-50/50">
                  <tr>
                     <td colSpan={7} className="px-4 py-3 text-right font-bold text-slate-500 uppercase text-xs">合计预算</td>
                     <td className="px-4 py-3 text-right font-black text-lg text-purple-600">
                        ¥{totalBudget.toLocaleString()}
                     </td>
                     <td></td>
                  </tr>
               </tfoot>
            </table>
         </div>
         
         <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 flex items-start gap-4">
            <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm"><Sparkles size={20} /></div>
            <div className="flex-1">
               <h4 className="text-sm font-bold text-blue-900 mb-1">AI 预算合理性评估</h4>
               <p className="text-xs text-blue-700 leading-relaxed">
                  当前方案总预算 <strong>¥{totalBudget.toLocaleString()}</strong>，市场参考总价约 <strong>¥{totalMarket.toFixed(0).toLocaleString()}</strong>。
                  {variancePercent < -10 && <span className="text-red-600 font-bold ml-1">预算偏低 {Math.abs(variancePercent).toFixed(1)}%，建议适当上调以免影响采购质量。</span>}
                  {variancePercent > 10 && <span className="text-amber-600 font-bold ml-1">预算偏高 {Math.abs(variancePercent).toFixed(1)}%，建议复核物资规格。</span>}
                  {Math.abs(variancePercent) <= 10 && <span className="text-green-600 font-bold ml-1">预算在合理市场浮动范围内。</span>}
               </p>
            </div>
            <button className="text-xs font-bold text-blue-600 border border-blue-200 bg-white px-3 py-1.5 rounded-lg hover:bg-blue-50 flex items-center gap-1">
               <RefreshCcw size={12}/> 重新测算
            </button>
         </div>
      </div>

      <div className="fixed bottom-0 left-64 right-0 p-4 bg-white border-t border-slate-200 flex justify-center gap-4 z-10">
         <button onClick={() => {
           setIsEditingPlan(false);
           if (cameFromNeeds && onBackToNeeds) {
             onBackToNeeds();
             setCameFromNeeds(false);
           }
         }} className="px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">取消</button>
         <button onClick={() => setIsEditingPlan(false)} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200">提交方案</button>
      </div>
    </div>
  );

  const renderPlanDetail = () => {
    const plan = plans.find(p => p.id === selectedPlanId);
    if (!plan) return null;

    const currentStageIndex = plan.stages.findIndex(s => s.status === 'current');
    // Default to current stage if activeStageIndex is not set or out of bounds
    const displayStageIndex = activeStageIndex >= 0 && activeStageIndex < plan.stages.length ? activeStageIndex : (currentStageIndex >= 0 ? currentStageIndex : 0);
    const activeStage = plan.stages[displayStageIndex];
    
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
         {/* Header */}
         <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => setSelectedPlanId(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                 <ChevronLeft size={24} />
              </button>
              <div>
                 <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-slate-900">{plan.title}</h2>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-black rounded uppercase border border-blue-100">
                       {plan.status}
                    </span>
                 </div>
                 <p className="text-sm text-slate-500 mt-1">方案编号: {plan.id} · 创建日期: {plan.createDate} · 申请部门: {plan.dept}</p>
              </div>
            </div>
            <div className="flex gap-3">
               <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                  <FileText size={18} /> 查看原件
               </button>
               {currentStageIndex === 2 && (
                 <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-200">
                    <CheckCircle2 size={18} /> 审批通过
                 </button>
               )}
            </div>
         </div>

         <div className="grid grid-cols-3 gap-6">
            {/* Left: Info & Stages */}
            <div className="col-span-2 space-y-6">
               {/* Info Cards */}
               <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                     <p className="text-xs font-bold text-slate-400 uppercase mb-1">采购预算</p>
                     <p className="text-xl font-black text-slate-900">¥{plan.budget.toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                     <p className="text-xs font-bold text-slate-400 uppercase mb-1">采购方式</p>
                     <p className="text-xl font-black text-blue-600">{plan.procurementMethod}</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                     <p className="text-xs font-bold text-slate-400 uppercase mb-1">征集方式</p>
                     <p className="text-xl font-black text-slate-900">{plan.solicitationMethod}</p>
                  </div>
               </div>

               {/* Stage Stepper */}
               <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-2">
                     <Clock className="text-blue-600" size={20} /> 执行进度跟踪
                  </h3>
                  <div className="relative flex items-center justify-between">
                     <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-100 -z-0"></div>
                     {plan.stages.map((stage, idx) => {
                        const isCompleted = stage.status === 'completed';
                        const isCurrent = stage.status === 'current';
                        const isActive = idx === displayStageIndex;
                        return (
                           <div 
                             key={idx} 
                             onClick={() => setActiveStageIndex(idx)}
                             className={`relative z-10 flex flex-col items-center bg-white px-2 cursor-pointer group`}
                           >
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all ${
                                 isActive ? 'ring-4 ring-blue-100 ' : ''
                              } ${
                                 isCompleted ? 'bg-green-500 border-green-100 text-white' :
                                 isCurrent ? 'bg-blue-600 border-blue-100 text-white scale-110' :
                                 'bg-white border-slate-200 text-slate-300 group-hover:border-blue-200'
                              }`}>
                                 {isCompleted ? <CheckCircle2 size={18} /> : 
                                  isCurrent ? <Loader2 size={18} className="animate-spin" /> :
                                  <div className="w-2 h-2 bg-slate-300 rounded-full"></div>}
                              </div>
                              <p className={`text-xs font-bold mt-3 transition-colors ${isActive ? 'text-blue-600' : isCurrent ? 'text-blue-600' : 'text-slate-500 group-hover:text-blue-500'}`}>{stage.name}</p>
                              {stage.date && <p className="text-[10px] text-slate-400 mt-0.5">{stage.date}</p>}
                           </div>
                        );
                     })}
                  </div>
               </div>

               {/* Stage Details Content */}
               <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[300px]">
                  <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                     <Sparkles className="text-purple-600" size={20} /> 
                     {activeStage?.name}阶段详情
                     <span className={`ml-2 px-2 py-0.5 text-[10px] rounded uppercase font-bold ${
                       activeStage?.status === 'completed' ? 'bg-green-100 text-green-700' :
                       activeStage?.status === 'current' ? 'bg-blue-100 text-blue-700' :
                       'bg-slate-100 text-slate-500'
                     }`}>
                       {activeStage?.status === 'completed' ? '已完成' : activeStage?.status === 'current' ? '进行中' : '未开始'}
                     </span>
                  </h3>
                  
                  {activeStage?.name === '需求整合' && (
                    <div className="space-y-4 animate-in fade-in">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        此阶段系统已自动收集并整合了来自 {plan.dept} 等部门的采购需求。通过 AI 语义分析，成功将相似度超过 85% 的物料进行了合并，预计可节约采购成本约 5%-8%。
                      </p>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">整合需求来源</h4>
                        <ul className="space-y-2 text-sm text-slate-700">
                          <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-500"/> 需求单 REQ-2023-1001 (行政部)</li>
                          <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-500"/> 需求单 REQ-2023-1005 (IT部)</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {activeStage?.name === '方案制定' && (
                    <div className="space-y-4 animate-in fade-in">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        采购方案已由 {activeStage.assignee || '采购专员'} 制定完毕。方案确定了采用 <span className="font-bold text-blue-600">{plan.procurementMethod}</span> 方式，并通过 <span className="font-bold text-blue-600">{plan.solicitationMethod}</span> 征集供应商。
                      </p>
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <h4 className="text-xs font-bold text-blue-800 uppercase mb-2 flex items-center gap-1"><BrainCircuit size={14}/> AI 策略建议采纳情况</h4>
                        <p className="text-sm text-blue-700">已采纳 AI 推荐的采购方式。系统推荐的 3 家优质供应商已加入邀请候选名单，历史履约评分均在 4.5 以上。</p>
                      </div>
                    </div>
                  )}

                  {activeStage?.name === '方案审批' && (
                    <div className="space-y-4 animate-in fade-in">
                      {activeStage.status === 'current' ? (
                        <>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            方案目前正在等待 <span className="font-bold text-slate-900">{activeStage.assignee}</span> 的审批。
                          </p>
                          <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
                            <Loader2 size={24} className="text-amber-500 animate-spin" />
                            <div>
                              <p className="text-sm font-bold text-amber-800">审批流转中</p>
                              <p className="text-xs text-amber-600 mt-0.5">已停留 2 小时 15 分钟</p>
                            </div>
                          </div>
                        </>
                      ) : activeStage.status === 'completed' ? (
                        <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl border border-green-100">
                          <CheckCircle2 size={24} className="text-green-500" />
                          <div>
                            <p className="text-sm font-bold text-green-800">审批已通过</p>
                            <p className="text-xs text-green-600 mt-0.5">审批人: {activeStage.assignee} · 审批时间: {activeStage.date}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 italic">前置阶段尚未完成，审批流程未触发。</p>
                      )}
                    </div>
                  )}

                  {(activeStage?.name === '采购执行' || activeStage?.name === '招标公告' || activeStage?.name === '开标评标') && (
                    <div className="space-y-4 animate-in fade-in">
                      {activeStage.status === 'pending' ? (
                        <p className="text-sm text-slate-400 italic">等待方案审批通过后，将自动进入执行阶段。系统将根据设定的征集方式自动发布公告或发送邀请函。</p>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-sm text-slate-600">采购活动正在按计划执行中。已向 5 家候选供应商发送邀请，目前已有 3 家响应。</p>
                          <div className="w-full bg-slate-100 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '60%' }}></div>
                          </div>
                          <p className="text-xs text-slate-500 text-right">供应商响应率: 60%</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeStage?.name === '验收归档' && (
                    <div className="space-y-4 animate-in fade-in">
                      {activeStage.status === 'pending' ? (
                        <p className="text-sm text-slate-400 italic">采购执行完成后，将在此处上传验收报告、合同扫描件及发票信息，完成项目闭环。</p>
                      ) : (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText size={24} className="text-slate-400" />
                            <div>
                              <p className="text-sm font-bold text-slate-700">项目归档文件.zip</p>
                              <p className="text-xs text-slate-500">包含合同、验收单、发票复印件</p>
                            </div>
                          </div>
                          <button className="text-sm font-bold text-blue-600 hover:text-blue-700">下载</button>
                        </div>
                      )}
                    </div>
                  )}
               </div>

               {/* Items Table */}
               <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                     <ClipboardList className="text-blue-600" size={20} /> 采购物资明细
                  </h3>
                  <table className="w-full text-sm">
                     <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <tr>
                           <th className="px-6 py-4 font-bold text-slate-500 uppercase w-20 text-center rounded-l-xl whitespace-nowrap">序号</th>
                           <th className="px-4 py-3 text-left">物资名称</th>
                           <th className="px-4 py-3 text-right">数量</th>
                           <th className="px-4 py-3 text-center">单位</th>
                           <th className="px-4 py-3 text-right rounded-r-xl">预算小计</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {plan.items.map((item, i) => (
                           <tr key={i} className="hover:bg-slate-50">
                              <td className="px-6 py-4 text-center font-bold text-slate-400 whitespace-nowrap">{i + 1}</td>
                              <td className="px-4 py-4 font-bold text-slate-900">{item.name}</td>
                              <td className="px-4 py-4 text-right font-mono">{item.qty}</td>
                              <td className="px-4 py-4 text-center text-slate-500">{item.unit}</td>
                              <td className="px-4 py-4 text-right font-mono font-bold text-slate-700">¥{item.budget.toLocaleString()}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Right: AI Risk & Approvals */}
            <div className="col-span-1 space-y-6">
               <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                     <ShieldCheck size={100} />
                  </div>
                  <div className="relative z-10">
                     <div className="flex items-center gap-2 mb-6">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg"><BrainCircuit size={20} /></div>
                        <div>
                           <h3 className="font-black text-lg">AI 风险雷达</h3>
                           <p className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Risk Scanner</p>
                        </div>
                     </div>

                     {!plan.aiRiskAnalysis ? (
                        <div className="text-center py-6">
                           <p className="text-sm text-slate-400 mb-4">点击扫描方案中的潜在合规风险</p>
                           <button 
                             onClick={() => handleRiskScan(plan.id)}
                             disabled={isRiskScanning}
                             className="w-full py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                           >
                             {isRiskScanning ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} className="text-yellow-500" />}
                             开始 AI 扫描
                           </button>
                        </div>
                     ) : (
                        <div className="animate-in fade-in zoom-in duration-300 space-y-4">
                           <div className="flex justify-between items-end border-b border-white/10 pb-4 mb-4">
                              <span className="text-sm font-bold text-slate-300">安全评分</span>
                              <span className={`text-3xl font-black ${plan.aiRiskAnalysis.score >= 90 ? 'text-green-400' : 'text-amber-400'}`}>
                                 {plan.aiRiskAnalysis.score}
                              </span>
                           </div>
                           <div>
                              <p className="text-xs font-bold text-slate-400 uppercase mb-2">风险提示</p>
                              <ul className="space-y-2">
                                 {plan.aiRiskAnalysis.issues.map((issue, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-white/80 leading-relaxed bg-white/5 p-2 rounded-lg">
                                       <AlertOctagon size={14} className="text-amber-500 shrink-0 mt-0.5" />
                                       {issue}
                                    </li>
                                 ))}
                              </ul>
                           </div>
                           <div className="bg-blue-600/20 p-3 rounded-xl border border-blue-500/30">
                              <p className="text-[10px] font-bold text-blue-300 mb-1 uppercase">AI 建议</p>
                              <p className="text-xs text-white">{plan.aiRiskAnalysis.suggestion}</p>
                           </div>
                           <button onClick={() => handleRiskScan(plan.id)} className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors">
                              重新扫描
                           </button>
                        </div>
                     )}
                  </div>
               </div>

               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                     <CheckSquare className="text-blue-600" size={16} /> 审批流转
                  </h3>
                  <div className="relative pl-4 border-l-2 border-slate-100 space-y-6">
                     {plan.stages.filter(s => s.status === 'completed' || s.status === 'current').map((s, i) => (
                        <div key={i} className="relative">
                           <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${s.status === 'completed' ? 'bg-green-500' : 'bg-blue-600'}`}></div>
                           <p className="text-sm font-bold text-slate-900">{s.name}</p>
                           <p className="text-xs text-slate-500 mt-0.5">{s.assignee} · {s.date}</p>
                           {s.status === 'current' && <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded mt-1 inline-block">当前节点</span>}
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </div>
    );
  };

  const renderPlanList = () => {
    // Filter Logic
    const filteredPlans = plans.filter(p => {
        const matchesSearch = searchTerm === '' || 
           p.title.includes(searchTerm) || 
           p.id.includes(searchTerm) || 
           p.content.includes(searchTerm);
        
        const matchesMethod = methodFilter === '全部方式' || p.procurementMethod === methodFilter;

        return matchesSearch && matchesMethod;
    });

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
         <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-xl font-black text-slate-900">采购项目管理</h2>
              <p className="text-sm text-slate-500 mt-1">统筹管理企业所有采购立项、方案审批及执行进度监控</p>
            </div>
            <button 
               onClick={() => setIsEditingPlan(true)} 
               className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
            >
               <Plus size={18} /> 新建项目
            </button>
         </div>

         {/* Search & Filter Bar */}
         <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
               <input 
                 type="text" 
                 placeholder="搜索项目编号、名称、采购内容..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" 
               />
            </div>
            <div className="relative min-w-[160px]">
               <select 
                 value={methodFilter}
                 onChange={(e) => setMethodFilter(e.target.value)}
                 className="w-full appearance-none bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl px-4 py-2.5 pr-10 outline-none hover:border-blue-400"
               >
                 <option value="全部方式">全部采购方式</option>
                 <option value="询价">询价</option>
                 <option value="公开招标">公开招标</option>
                 <option value="竞价">竞价</option>
               </select>
               <ChevronsUpDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
         </div>
         
         <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
           <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-left">
                 <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase w-20 text-center whitespace-nowrap">序号</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">项目编号</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">项目名称</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">采购内容</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">采购方式</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">当前阶段</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {filteredPlans.map((plan, index) => {
                   const currentStage = plan.stages.find(s => s.status === 'current');
                   const currentStageName = currentStage ? currentStage.name : (plan.stages.every(s => s.status === 'completed') ? '已完成' : '未开始');
                   
                   return (
                     <tr key={plan.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => setSelectedPlanId(plan.id)}>
                        <td className="px-6 py-4 text-center font-bold text-slate-400 whitespace-nowrap">
                           {index + 1}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-500 font-bold">
                           {plan.id}
                        </td>
                        <td className="px-6 py-4">
                           <p className="font-bold text-slate-900">{plan.title}</p>
                           <p className="text-xs text-slate-400 mt-0.5">{plan.dept}</p>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                           <p className="text-slate-600 truncate" title={plan.content}>{plan.content}</p>
                           <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">预算</span>
                              <span className="text-xs font-bold text-slate-700">¥{plan.budget.toLocaleString()}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                             plan.procurementMethod === '公开招标' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                             plan.procurementMethod === '询价' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                             'bg-slate-50 text-slate-700 border-slate-200'
                           }`}>
                             {plan.procurementMethod}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                              currentStageName === '已完成' ? 'bg-green-100 text-green-700' :
                              currentStageName === '未开始' ? 'bg-slate-100 text-slate-500' :
                              'bg-blue-50 text-blue-700'
                           }`}>
                              {currentStageName !== '已完成' && currentStageName !== '未开始' && (
                                 <span className="relative flex h-2 w-2">
                                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                   <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                 </span>
                              )}
                              {currentStageName}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <button className="px-3 py-1.5 bg-white border border-slate-200 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all shadow-sm">
                              查看详情
                           </button>
                        </td>
                     </tr>
                   );
                 })}
                 {filteredPlans.length === 0 && (
                    <tr>
                       <td colSpan={7} className="py-12 text-center text-slate-400">
                          <Search size={32} className="mx-auto mb-2 opacity-20" />
                          <p>未找到匹配的采购项目</p>
                       </td>
                    </tr>
                 )}
              </tbody>
           </table>
         </div>
      </div>
    );
  };

  if (isEditingPlan && !selectedPlanId) return renderCreatePlanForm();
  if (selectedPlanId) return renderPlanDetail();
  return renderPlanList();
};

export default ProcurementPlans;
