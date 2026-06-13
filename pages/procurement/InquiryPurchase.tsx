
import React, { useState, useRef } from 'react';
import { 
  Plus, Search, CheckCircle2, Clock, AlertCircle, ArrowRight, UserPlus, 
  FileText, ChevronRight, Sparkles, Loader2, X, Send, History, Trophy,
  ClipboardList, Megaphone, ArrowLeft, Info, Calendar, Download,
  Package, BrainCircuit, Users, Zap, Eye, Database, Percent, TrendingUp,
  BarChart3, ExternalLink
} from 'lucide-react';
import { evaluateQuotationsStructured, QuoteAnalysisResult } from '../../services/geminiService';
import { ProcurementMethod, ApprovalStatus } from '../../types';

enum InquiryStep {
  CREATE = 1,
  INVITE = 2,
  PUBLISH = 3,
  RECEIVE = 4,
  AWARD = 5
}

interface ProjectItem {
  name: string;
  spec: string;
  qty: number;
  unit: string;
}

interface Project {
  id: string;
  title: string;
  method: ProcurementMethod;
  status: ApprovalStatus;
  budget: number;
  deadline: string;
  createTime: string;
  quotesCount: number;
  currentStep: number;
  
  demandDetails?: {
    items: ProjectItem[];
    specialTerms?: string;
  };
  invitedSuppliers?: { name: string; status: 'pending' | 'accepted' | 'declined' | 'viewed'; lastAction?: string }[];
  quotes?: any[];
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

const InquiryPurchase: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<QuoteAnalysisResult | null>(null);
  
  // Material Selection Modal State
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

  // Create Form State
  const [newProject, setNewProject] = useState<Project>({
    id: `RFQ-${Date.now().toString().slice(-8)}`,
    title: '',
    method: ProcurementMethod.INQUIRY,
    status: ApprovalStatus.DRAFT,
    budget: 0,
    deadline: '',
    createTime: new Date().toISOString().split('T')[0],
    quotesCount: 0,
    currentStep: 1,
    demandDetails: {
      items: [{ name: '', spec: '', qty: 1, unit: '批' }],
      specialTerms: ''
    },
    invitedSuppliers: [],
    quotes: []
  });

  const [projects, setProjects] = useState<Project[]>([
    { 
      id: 'RFQ-20231001', 
      title: '2024年度行政车辆维保服务询价', 
      method: ProcurementMethod.INQUIRY, 
      status: ApprovalStatus.PENDING, 
      budget: 80000, 
      deadline: '2023-11-15', 
      createTime: '2023-10-20', 
      quotesCount: 3,
      currentStep: InquiryStep.RECEIVE,
      demandDetails: { 
        items: [{ name: '车辆年度保养', spec: '包含15台行政用车年度保养', qty: 1, unit: '项' }],
        specialTerms: '要求具备上门取车服务。'
      },
      invitedSuppliers: [
        { name: '顺兴汽车修理', status: 'viewed', lastAction: '2小时前已读' },
        { name: '美车饰维保', status: 'accepted', lastAction: '已提交报价' },
        { name: '顶峰名车汇', status: 'pending', lastAction: '未读' },
        { name: '快修大师连锁', status: 'accepted', lastAction: '已提交报价' },
        { name: '安驰汽修', status: 'declined', lastAction: '已拒绝参与' },
        { name: '途虎养车工场店', status: 'viewed', lastAction: '10分钟前已读' }
      ],
      quotes: [
        { supplier: '顺兴汽车修理', totalTco: 75000, delivery: '实时响应', paymentTerms: '月结30天' },
        { supplier: '美车饰维保', totalTco: 78000, delivery: '2小时内', paymentTerms: '月结60天' },
        { supplier: '快修大师连锁', totalTco: 76500, delivery: '4小时内', paymentTerms: '月结45天' }
      ]
    },
    { 
      id: 'RFQ-20231002', 
      title: '研发部高性能工作站及显示器采购', 
      method: ProcurementMethod.INQUIRY, 
      status: ApprovalStatus.PENDING, 
      budget: 150000, 
      deadline: '2023-11-20', 
      createTime: '2023-10-22', 
      quotesCount: 4,
      currentStep: InquiryStep.RECEIVE,
      demandDetails: { 
        items: [
          { name: '高性能工作站', spec: 'i9-13900K/64G/2T SSD/RTX4090', qty: 5, unit: '台' },
          { name: '专业绘图显示器', spec: '32寸 4K 100%sRGB', qty: 10, unit: '台' }
        ],
        specialTerms: '需提供3年上门保修服务，包含首次上门安装调试。'
      },
      invitedSuppliers: [
        { name: '联想（北京）有限公司', status: 'accepted', lastAction: '已提交报价' },
        { name: '戴尔（中国）有限公司', status: 'accepted', lastAction: '已提交报价' },
        { name: '杭州华三通信技术有限公司', status: 'viewed', lastAction: '1天前已读' },
        { name: '上海曙光信息产业有限公司', status: 'pending', lastAction: '未读' }
      ],
      quotes: [
        { supplier: '联想（北京）有限公司', totalTco: 145000, delivery: '7天内', paymentTerms: '货到付款' },
        { supplier: '戴尔（中国）有限公司', totalTco: 148000, delivery: '14天内', paymentTerms: '月结30天' }
      ]
    },
    { 
      id: 'RFQ-20231003', 
      title: '2024年第一季度办公耗材集中采购', 
      method: ProcurementMethod.INQUIRY, 
      status: ApprovalStatus.DRAFT, 
      budget: 45000, 
      deadline: '2023-11-25', 
      createTime: '2023-10-25', 
      quotesCount: 0,
      currentStep: InquiryStep.INVITE,
      demandDetails: { 
        items: [
          { name: 'A4复印纸', spec: '70g 500张/包', qty: 200, unit: '包' },
          { name: '黑色签字笔', spec: '0.5mm 按动式', qty: 1000, unit: '支' },
          { name: '文件夹', spec: 'A4 蓝色 50mm', qty: 300, unit: '个' },
          { name: '订书机', spec: '省力型 24/6', qty: 50, unit: '个' }
        ],
        specialTerms: '要求分批次送货，每月送货一次。'
      },
      invitedSuppliers: [
        { name: '得力集团有限公司', status: 'pending', lastAction: '未读' },
        { name: '晨光文具股份有限公司', status: 'pending', lastAction: '未读' },
        { name: '齐心集团股份有限公司', status: 'pending', lastAction: '未读' }
      ],
      quotes: []
    },
    { 
      id: 'RFQ-20231004', 
      title: '包装纸箱及胶带批量采购', 
      method: ProcurementMethod.INQUIRY, 
      status: ApprovalStatus.PENDING, 
      budget: 120000, 
      deadline: '2023-11-18', 
      createTime: '2023-10-26', 
      quotesCount: 5,
      currentStep: InquiryStep.AWARD,
      demandDetails: { 
        items: [
          { name: '定制瓦楞纸箱', spec: '500*400*300mm 5层', qty: 10000, unit: '个' },
          { name: '封箱胶带', spec: '透明 48mm*100m', qty: 2000, unit: '卷' },
          { name: '气泡膜', spec: '宽50cm 长100m', qty: 100, unit: '卷' }
        ],
        specialTerms: '纸箱需印制公司Logo，提供样品确认后大货生产。'
      },
      invitedSuppliers: [
        { name: '杭州大和包装', status: 'accepted', lastAction: '已提交报价' },
        { name: '苏州精控包装', status: 'accepted', lastAction: '已提交报价' },
        { name: '上海宏博纸业', status: 'accepted', lastAction: '已提交报价' },
        { name: '无锡恒润包装', status: 'accepted', lastAction: '已提交报价' },
        { name: '南京天天包装', status: 'accepted', lastAction: '已提交报价' }
      ],
      quotes: [
        { supplier: '杭州大和包装', totalTco: 115000, delivery: '15天内', paymentTerms: '月结30天' },
        { supplier: '苏州精控包装', totalTco: 118000, delivery: '10天内', paymentTerms: '月结60天' },
        { supplier: '上海宏博纸业', totalTco: 112000, delivery: '20天内', paymentTerms: '预付30%' },
        { supplier: '无锡恒润包装', totalTco: 119000, delivery: '12天内', paymentTerms: '月结30天' },
        { supplier: '南京天天包装', totalTco: 116500, delivery: '14天内', paymentTerms: '月结45天' }
      ]
    },
    { 
      id: 'RFQ-20231005', 
      title: '车间劳保用品及工具采购', 
      method: ProcurementMethod.INQUIRY, 
      status: ApprovalStatus.DRAFT, 
      budget: 35000, 
      deadline: '2023-11-30', 
      createTime: '2023-10-28', 
      quotesCount: 0,
      currentStep: InquiryStep.PUBLISH,
      demandDetails: { 
        items: [
          { name: '防砸安全鞋', spec: '透气型 各种尺码', qty: 150, unit: '双' },
          { name: '防切割手套', spec: '5级防割', qty: 500, unit: '双' },
          { name: '防护眼镜', spec: '防飞溅 防雾', qty: 200, unit: '副' },
          { name: '电动螺丝刀', spec: '12V 锂电', qty: 20, unit: '把' }
        ],
        specialTerms: '安全鞋需提供尺码明细，工具需提供1年质保。'
      },
      invitedSuppliers: [
        { name: '3M中国有限公司', status: 'pending', lastAction: '未读' },
        { name: '霍尼韦尔安全防护', status: 'pending', lastAction: '未读' },
        { name: '世达工具', status: 'pending', lastAction: '未读' },
        { name: '代尔塔（中国）', status: 'pending', lastAction: '未读' }
      ],
      quotes: []
    },
    { 
      id: 'RFQ-20231006', 
      title: '数据中心服务器及网络设备扩容采购', 
      method: ProcurementMethod.INQUIRY, 
      status: ApprovalStatus.PENDING, 
      budget: 850000, 
      deadline: '2023-11-10', 
      createTime: '2023-10-29', 
      quotesCount: 2,
      currentStep: InquiryStep.RECEIVE,
      demandDetails: { 
        items: [
          { name: '机架式服务器', spec: '2U 双路至强 256G 8T', qty: 10, unit: '台' },
          { name: '核心交换机', spec: '48口万兆', qty: 2, unit: '台' },
          { name: '光模块', spec: '10G SFP+ 多模', qty: 40, unit: '个' },
          { name: '机柜', spec: '42U 标准机柜', qty: 4, unit: '个' }
        ],
        specialTerms: '需包含设备上架、系统安装、网络配置及联调服务。'
      },
      invitedSuppliers: [
        { name: '紫光股份', status: 'accepted', lastAction: '已提交报价' },
        { name: '浪潮信息', status: 'accepted', lastAction: '已提交报价' },
        { name: '华为技术有限公司', status: 'viewed', lastAction: '5小时前已读' }
      ],
      quotes: [
        { supplier: '紫光股份', totalTco: 820000, delivery: '30天内', paymentTerms: '3-3-3-1' },
        { supplier: '浪潮信息', totalTco: 835000, delivery: '20天内', paymentTerms: '月结30天' }
      ]
    },
    { 
      id: 'RFQ-20231007', 
      title: '2024年度员工体检服务采购', 
      method: ProcurementMethod.INQUIRY, 
      status: ApprovalStatus.PENDING, 
      budget: 250000, 
      deadline: '2023-11-05', 
      createTime: '2023-10-15', 
      quotesCount: 3,
      currentStep: InquiryStep.AWARD,
      demandDetails: { 
        items: [
          { name: '基础体检套餐', spec: '男/女常规检查', qty: 300, unit: '人次' },
          { name: '深度体检套餐', spec: '含CT、肿瘤标志物等', qty: 50, unit: '人次' }
        ],
        specialTerms: '需提供全国多城市门店支持，支持员工家属自费体检优惠。'
      },
      invitedSuppliers: [
        { name: '爱康国宾', status: 'accepted', lastAction: '已提交报价' },
        { name: '美年大健康', status: 'accepted', lastAction: '已提交报价' },
        { name: '慈铭体检', status: 'accepted', lastAction: '已提交报价' }
      ],
      quotes: [
        { supplier: '爱康国宾', totalTco: 245000, delivery: '全年有效', paymentTerms: '按月结算' },
        { supplier: '美年大健康', totalTco: 238000, delivery: '全年有效', paymentTerms: '季度结算' },
        { supplier: '慈铭体检', totalTco: 242000, delivery: '全年有效', paymentTerms: '按月结算' }
      ]
    },
    { 
      id: 'RFQ-20231008', 
      title: '园区绿化养护服务采购', 
      method: ProcurementMethod.INQUIRY, 
      status: ApprovalStatus.DRAFT, 
      budget: 180000, 
      deadline: '2023-12-01', 
      createTime: '2023-10-30', 
      quotesCount: 0,
      currentStep: InquiryStep.INVITE,
      demandDetails: { 
        items: [
          { name: '日常绿化养护', spec: '园区内草坪、灌木、乔木修剪及病虫害防治', qty: 12, unit: '月' },
          { name: '节日花卉布置', spec: '春节、国庆等重大节日花坛布置', qty: 4, unit: '次' }
        ],
        specialTerms: '需提供常驻养护人员2名，节假日需安排值班。'
      },
      invitedSuppliers: [
        { name: '绿城园林', status: 'pending', lastAction: '未读' },
        { name: '东方园林', status: 'pending', lastAction: '未读' }
      ],
      quotes: []
    },
    { 
      id: 'RFQ-20231009', 
      title: '办公楼三层装修改造工程采购', 
      method: ProcurementMethod.INQUIRY, 
      status: ApprovalStatus.PENDING, 
      budget: 600000, 
      deadline: '2023-11-28', 
      createTime: '2023-10-31', 
      quotesCount: 1,
      currentStep: InquiryStep.RECEIVE,
      demandDetails: { 
        items: [
          { name: '室内拆除工程', spec: '原隔断、吊顶、地毯拆除及清运', qty: 1, unit: '项' },
          { name: '装饰装修工程', spec: '新建玻璃隔断、矿棉板吊顶、方块地毯铺设', qty: 1, unit: '项' },
          { name: '强弱电改造', spec: '工位插座、网络布线、照明灯具更换', qty: 1, unit: '项' },
          { name: '空调及消防改造', spec: '风口移位、喷淋头及烟感调整', qty: 1, unit: '项' }
        ],
        specialTerms: '工期要求45天，需在夜间或周末施工，避免影响其他楼层办公。'
      },
      invitedSuppliers: [
        { name: '金螳螂建筑装饰', status: 'accepted', lastAction: '已提交报价' },
        { name: '亚厦股份', status: 'viewed', lastAction: '2小时前已读' },
        { name: '广田集团', status: 'pending', lastAction: '未读' }
      ],
      quotes: [
        { supplier: '金螳螂建筑装饰', totalTco: 585000, delivery: '40天', paymentTerms: '3-5-2' }
      ]
    }
  ]);

  const inquirySteps = [
    { step: 1, label: '建项需求', icon: ClipboardList },
    { step: 2, label: '选择供应商', icon: UserPlus },
    { step: 3, label: '发布询价单', icon: Megaphone },
    { step: 4, label: '接收报价', icon: History },
    { step: 5, label: '定标决策', icon: Trophy },
  ];

  const updateStep = (step: number) => {
    if (!selectedProject) return;
    const updated = { ...selectedProject, currentStep: step };
    if (step === InquiryStep.PUBLISH) updated.status = ApprovalStatus.PENDING;
    setSelectedProject(updated);
    setProjects(projects.map(p => p.id === selectedProject.id ? updated : p));
  };

  const handleAiEvaluate = async () => {
    if (!selectedProject || !selectedProject.quotes || selectedProject.quotes.length === 0) return;
    setIsEvaluating(true);
    setAiRecommendation(null);
    try {
      const result = await evaluateQuotationsStructured(
        selectedProject.title,
        selectedProject.demandDetails || {},
        selectedProject.quotes
      );
      setAiRecommendation(result);
    } catch (err) {
      console.error("AI Evaluation failed", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  // --- Material Modal Handlers (Skipped for brevity as they are unchanged) ---
  const handleAddItemsFromModal = () => {
    if (!selectedProject) return;
    const selected = materialLibrary.filter(m => selectedMaterialIds.includes(m.id));
    const newItems = selected.map(m => ({
      name: m.name,
      spec: m.spec,
      qty: 1,
      unit: m.unit
    }));
    const currentItems = selectedProject.demandDetails?.items || [];
    const filteredCurrent = (currentItems.length === 1 && !currentItems[0].name) ? [] : currentItems;
    const updatedProject = {
        ...selectedProject,
        demandDetails: {
            ...selectedProject.demandDetails,
            items: [...filteredCurrent, ...newItems]
        }
    };
    setSelectedProject(updatedProject as Project);
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

  const updateDemandItem = (index: number, field: string, value: any) => {
    if (!selectedProject || !selectedProject.demandDetails) return;
    const newItems = [...selectedProject.demandDetails.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setSelectedProject({
        ...selectedProject,
        demandDetails: { ...selectedProject.demandDetails, items: newItems }
    });
  };

  const removeDemandItem = (index: number) => {
    if (!selectedProject || !selectedProject.demandDetails) return;
    const newItems = selectedProject.demandDetails.items.filter((_, i) => i !== index);
    setSelectedProject({
        ...selectedProject,
        demandDetails: { ...selectedProject.demandDetails, items: newItems }
    });
  };

  // --- RENDERING INQUIRY STAGES ---

  const renderMaterialModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h3 className="text-xl font-black text-slate-900">选择采购物料</h3>
          <button onClick={() => setIsMaterialModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {!isCreatingMaterial ? (
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
      </div>
    </div>
  );

  // STEP 1: CREATE PROJECT (Unchanged from previous code)
  const renderCreateStage = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 relative">
      {isMaterialModalOpen && renderMaterialModal()}

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
        <section className="space-y-4">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Info className="text-blue-600" size={20} /> 基本信息
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">项目名称</label>
              <input type="text" value={selectedProject?.title} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="输入项目名称，如：Q4服务器设备采购" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">总预算 (元)</label>
              <input type="number" value={selectedProject?.budget} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Package className="text-blue-600" size={20} /> 物资明细
            </h3>
            <button 
              onClick={() => setIsMaterialModalOpen(true)}
              className="text-xs font-bold text-blue-600 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100 flex items-center gap-2 hover:bg-blue-100 transition-colors"
            >
               <Package size={14} /> 从物料库选择添加
            </button>
          </div>
          <div className="overflow-hidden border border-slate-100 rounded-2xl">
             <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase w-16 text-center">序号</th>
                    <th className="px-4 py-3 text-left">物资名称</th>
                    <th className="px-4 py-3 text-left">规格型号</th>
                    <th className="px-4 py-3 text-center w-24">数量</th>
                    <th className="px-4 py-3 text-center w-24">单位</th>
                    <th className="px-4 py-3 text-center w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedProject?.demandDetails?.items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 text-center font-bold text-slate-400">{i + 1}</td>
                      <td className="p-2"><input type="text" value={item.name} onChange={(e) => updateDemandItem(i, 'name', e.target.value)} className="w-full p-2 bg-transparent outline-none focus:bg-slate-50 rounded" placeholder="请输入名称" /></td>
                      <td className="p-2"><input type="text" value={item.spec} onChange={(e) => updateDemandItem(i, 'spec', e.target.value)} className="w-full p-2 bg-transparent outline-none focus:bg-slate-50 rounded" placeholder="请输入规格" /></td>
                      <td className="p-2 text-center"><input type="number" value={item.qty} onChange={(e) => updateDemandItem(i, 'qty', Number(e.target.value))} className="w-full p-2 bg-transparent text-center outline-none focus:bg-slate-50 rounded" /></td>
                      <td className="p-2 text-center"><input type="text" value={item.unit} onChange={(e) => updateDemandItem(i, 'unit', e.target.value)} className="w-full p-2 bg-transparent text-center outline-none focus:bg-slate-50 rounded" /></td>
                      <td className="p-2 text-center"><button onClick={() => removeDemandItem(i)} className="text-slate-300 hover:text-red-500"><X size={16}/></button></td>
                    </tr>
                  ))}
                  {(!selectedProject?.demandDetails?.items || selectedProject.demandDetails.items.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        暂无明细，请点击上方按钮从物料库选择
                      </td>
                    </tr>
                  )}
                </tbody>
             </table>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Calendar className="text-blue-600" size={20} /> 截止时间与商务要求
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">截止时间</label>
              <input type="datetime-local" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">商务特殊条款</label>
              <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none h-20" placeholder="如：账期不少于60天，需要提供原厂质保函等"></textarea>
            </div>
          </div>
        </section>

        <div className="pt-8 border-t flex justify-end">
          <button onClick={() => updateStep(2)} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-lg shadow-blue-200 flex items-center gap-2 hover:bg-blue-700 transition-all group">
            保存并下一步 <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );

  // STEP 2: INVITE SUPPLIERS (Unchanged)
  const renderInviteStage = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
             <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><UserPlus className="text-blue-600" /> 选择目标受邀方</h3>
             <div className="relative w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none" placeholder="搜索供应商库..." />
             </div>
          </div>

          {/* AI Recommendation Module */}
          <div className="bg-purple-50/50 border border-purple-100 p-6 rounded-2xl">
             <div className="flex items-center gap-2 mb-4">
                <BrainCircuit className="text-purple-600" size={20} />
                <h4 className="font-bold text-slate-900">AI 智能推荐供应商</h4>
                <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold ml-2">基于产品匹配度与能力评价模型</span>
             </div>
             <div className="grid grid-cols-2 gap-4">
               {[
                 { name: '联想（北京）有限公司', match: '98%', score: 4.9, reason: '历史采购同类IT设备履约极佳，产品完全匹配。' },
                 { name: '得力集团有限公司', match: '95%', score: 4.8, reason: '办公用品核心供应商，综合能力评价模型得分高。' },
                 { name: '苏州精控机械', match: '92%', score: 4.7, reason: '战略合作供应商，具备相关生产物料的供货能力。' },
                 { name: '京东企业购', match: '90%', score: 4.8, reason: '品类覆盖广，物流配送能力强，适合多品类采购。' }
               ].map((s, i) => (
                 <div key={i} className="p-4 bg-white border border-purple-100 rounded-xl flex flex-col gap-2 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                      匹配度 {s.match}
                    </div>
                    <div className="flex justify-between items-start pr-12">
                      <p className="font-bold text-slate-900 text-sm">{s.name}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-black text-amber-500">
                      <Trophy size={10} fill="currentColor" /> {s.score} 综合分
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{s.reason}</p>
                    <button className="mt-2 w-full py-1.5 bg-purple-50 text-purple-600 text-xs font-bold rounded-lg hover:bg-purple-100 transition-colors flex items-center justify-center gap-1">
                      <Plus size={14} /> 一键添加
                    </button>
                 </div>
               ))}
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             {/* Mock Available Suppliers */}
             {[
               { name: '苏州精控机械', tier: '战略合作', score: 95, category: '零部件' },
               { name: '杭州大和电子', tier: '重点供应', score: 88, category: '电子元器件' },
               { name: '上海宏博贸易', tier: '一般供应', score: 76, category: '办公设备' },
               { name: '无锡恒润科技', tier: '潜在供应商', score: 82, category: '系统集成' },
             ].map((s, i) => (
               <div key={i} className="p-4 border border-slate-100 rounded-2xl hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-slate-900">{s.name}</p>
                    <Plus size={18} className="text-slate-300 group-hover:text-blue-600" />
                  </div>
                  <div className="flex gap-2 mb-3">
                    <span className="text-[10px] bg-white border px-2 py-0.5 rounded-full font-bold text-slate-500 uppercase">{s.tier}</span>
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase">{s.category}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-black text-amber-500">
                    <Trophy size={10} fill="currentColor" /> {s.score} 综合分
                  </div>
               </div>
             ))}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl">
              <h4 className="text-sm font-black uppercase tracking-widest text-blue-400 mb-6 flex items-center gap-2">
                <Users size={16} /> 已选中受邀方 (3)
              </h4>
              <div className="space-y-3">
                {selectedProject?.invitedSuppliers?.map((s, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-sm font-bold">{s.name}</span>
                    <button className="text-white/40 hover:text-red-400 transition-colors"><X size={16} /></button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-6 leading-relaxed">
                <Info size={12} className="inline mr-1" /> 系统建议至少邀请 3 家以保证充分竞争和合规性审计。
              </p>
           </div>
           
           <button onClick={() => updateStep(3)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
             确认并下一步 <ArrowRight size={20} />
           </button>
           <button onClick={() => updateStep(1)} className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors">
             返回修改
           </button>
        </div>
      </div>
    </div>
  );

  // STEP 3: PUBLISH & REVIEW (Unchanged)
  const renderPublishStage = () => (
    <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-8 animate-in zoom-in-95 duration-300">
      <div className="text-center space-y-2">
         <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-200">
           <Send size={32} className="text-white" />
         </div>
         <h2 className="text-2xl font-black text-slate-900">询价函发布预览</h2>
         <p className="text-slate-500">确认后，询价单将正式发布并同步给受邀供应商</p>
      </div>

      <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 space-y-6">
         <div className="flex justify-between border-b border-slate-200 pb-4">
            <span className="text-sm text-slate-500 font-bold">项目名称</span>
            <span className="text-sm text-slate-900 font-black">{selectedProject?.title}</span>
         </div>
         <div className="flex justify-between border-b border-slate-200 pb-4">
            <span className="text-sm text-slate-500 font-bold">截止日期</span>
            <span className="text-sm text-slate-900 font-black">{selectedProject?.deadline}</span>
         </div>
         <div className="flex justify-between border-b border-slate-200 pb-4">
            <span className="text-sm text-slate-500 font-bold">受邀规模</span>
            <span className="text-sm text-slate-900 font-black">{selectedProject?.invitedSuppliers?.length} 家供应商</span>
         </div>
         <div className="space-y-3">
            <span className="text-sm text-slate-500 font-bold">物资摘要</span>
            <div className="bg-white p-4 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-2">
               {selectedProject?.demandDetails?.items.map((it, i) => (
                 <p key={i}>· {it.name} | {it.spec} | {it.qty}{it.unit}</p>
               ))}
            </div>
         </div>
      </div>

      <div className="flex gap-4 pt-4">
         <button onClick={() => updateStep(2)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all">返回重选</button>
         <button onClick={() => updateStep(4)} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2">
            确认正式发布 <Zap size={20} className="text-yellow-400" />
         </button>
      </div>
    </div>
  );

  // STEP 4: MONITOR / RECEIVE QUOTES (Unchanged)
  const renderReceiveStage = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3">
               <Clock size={24} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">剩余时间</p>
            <p className="text-2xl font-black text-slate-900">42:15:08</p>
         </div>
         <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-3">
               <CheckCircle2 size={24} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">已报价/受邀</p>
            <p className="text-2xl font-black text-slate-900">{selectedProject?.quotesCount} / {selectedProject?.invitedSuppliers?.length}</p>
         </div>
         <div className="md:col-span-2 bg-slate-900 p-6 rounded-3xl text-white flex items-center justify-between shadow-xl">
            <div>
               <h4 className="text-sm font-black flex items-center gap-2 mb-1"><Database size={16} className="text-blue-400" /> 实时监控塔</h4>
               <p className="text-[10px] text-slate-400">目前已有 2 家供应商正在起草报价函...</p>
            </div>
            <div className="flex -space-x-3">
               {[1,2,3].map(i => (
                 <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                    {String.fromCharCode(64+i)}
                 </div>
               ))}
            </div>
         </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-900">供应商参与进度</h3>
            <div className="flex gap-2">
               <button className="text-xs font-bold text-slate-600 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50">一键催标</button>
               <button onClick={() => updateStep(5)} className="text-xs font-bold text-white px-4 py-1.5 bg-blue-600 rounded-lg shadow-md hover:bg-blue-700">提前截标开标</button>
            </div>
         </div>
         
         <div className="divide-y">
            {selectedProject?.invitedSuppliers?.map((s, i) => (
               <div key={i} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${s.status === 'accepted' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                        {s.name.charAt(0)}
                     </div>
                     <div>
                        <p className="text-sm font-bold text-slate-900">{s.name}</p>
                        <p className="text-[10px] text-slate-400">{s.lastAction}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-6">
                     <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                        s.status === 'accepted' ? 'bg-green-100 text-green-700' : 
                        s.status === 'viewed' ? 'bg-blue-100 text-blue-700' : 
                        s.status === 'declined' ? 'bg-red-50 text-red-600' :
                        'bg-slate-100 text-slate-500'
                     }`}>
                        {s.status === 'accepted' ? '已提交报价' : 
                         s.status === 'viewed' ? '已查看询价单' : 
                         s.status === 'declined' ? '已拒绝' :
                         '待处理'}
                     </span>
                     <button className="text-slate-400 hover:text-blue-600"><Eye size={18} /></button>
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );

  // STEP 5: AWARD / FINAL DECISION
  const renderAwardStage = () => (
    <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-500">
       <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
             <div>
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                   <Trophy className="text-yellow-500" size={28} /> 询价结果比价与决标
                </h3>
                <p className="text-sm text-slate-500 mt-1">系统已完成自动价格穿透与商务加权计算</p>
             </div>
             <div className="flex gap-3">
                <button 
                  onClick={handleAiEvaluate}
                  disabled={isEvaluating}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200"
                >
                   {isEvaluating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                   AI 辅助智能分析
                </button>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
             {/* Market Price Benchmark Card - NEW ADDITION */}
             <div className="lg:col-span-1 bg-gradient-to-br from-slate-50 to-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10 pointer-events-none text-blue-600"><BarChart3 size={80} /></div>
                <h4 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                   <TrendingUp size={16} className="text-blue-600" /> 市场行情参考
                </h4>
                
                {/* Mock Market Data Logic - In real app, fetch from API */}
                <div className="space-y-4">
                   <div className="flex justify-between items-end">
                      <div>
                         <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">该品类市场均价</p>
                         <p className="text-2xl font-black text-slate-700">¥ 76,800</p>
                      </div>
                      <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded flex items-center">
                         <TrendingUp size={10} className="mr-1"/> +2.3%
                      </span>
                   </div>
                   
                   <div className="h-px bg-slate-200"></div>
                   
                   <div className="text-xs text-slate-600 space-y-1">
                      <div className="flex justify-between">
                         <span>最低报价溢价率:</span>
                         <span className="font-bold text-green-600">-2.34% (优)</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2">
                         <Info size={10} className="inline mr-1"/> 数据来源: MySteel / 1688 / 历史成交库
                      </p>
                   </div>
                   
                   <button className="w-full mt-2 py-1.5 border border-blue-200 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 flex items-center justify-center gap-1">
                      <ExternalLink size={10} /> 查看行情详情
                   </button>
                </div>
             </div>

             {/* Main Comparison Table Wrapper - Takes 3 cols */}
             <div className="lg:col-span-3">
                <div className="overflow-x-auto border border-slate-100 rounded-2xl h-full">
                   <table className="w-full text-sm h-full">
                      <thead className="bg-slate-50 text-slate-500 border-b">
                         <tr>
                            <th className="px-6 py-4 font-bold text-slate-500 uppercase w-16 text-center">排名</th>
                            <th className="px-6 py-4 text-left">供应商名称</th>
                            <th className="px-6 py-4 text-right">含税总额(TCO)</th>
                            <th className="px-6 py-4 text-left pl-10">商务条款</th>
                            <th className="px-6 py-4 text-center">决策意见</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y">
                         {selectedProject?.quotes?.sort((a,b) => a.totalTco - b.totalTco).map((q, i) => (
                            <tr key={i} className={`hover:bg-slate-50 transition-colors ${i === 0 ? 'bg-green-50/20' : ''}`}>
                               <td className="px-6 py-6">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black mx-auto ${i === 0 ? 'bg-yellow-400 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                     {i + 1}
                                  </div>
                               </td>
                               <td className="px-6 py-6">
                                  <p className="font-bold text-slate-900">{q.supplier}</p>
                                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase">历史履约：优</p>
                               </td>
                               <td className="px-6 py-6 text-right">
                                  <p className="text-lg font-mono font-black text-blue-600">¥{q.totalTco.toLocaleString()}</p>
                                  {i === 0 && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-black">最低价</span>}
                               </td>
                               <td className="px-6 py-6 pl-10 space-y-1">
                                  <p className="text-xs text-slate-600 font-medium">付款：{q.paymentTerms}</p>
                                  <p className="text-xs text-slate-600 font-medium">响应：{q.delivery}</p>
                               </td>
                               <td className="px-6 py-6 text-center">
                                  <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors">设为中标</button>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
       </div>

       {aiRecommendation && (
         <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group animate-in slide-in-from-bottom-4 duration-500">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><BrainCircuit size={80} /></div>
            <div className="flex items-center gap-3 mb-8">
               <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><Sparkles size={28}/></div>
               <div>
                  <h4 className="text-xl font-black">AI 智能决标策略报告</h4>
                  <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1">Intelligent Awarding Report</p>
               </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
               <div className="md:col-span-8 space-y-6">
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                     <p className="text-base leading-relaxed text-slate-200 font-medium">"{aiRecommendation.reasoning}"</p>
                  </div>

                  {aiRecommendation.itemizedAnalysis && aiRecommendation.itemizedAnalysis.length > 0 && (
                     <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                        <p className="text-[10px] font-black text-blue-400 mb-4 uppercase tracking-tighter">采购标的明细分析</p>
                        <div className="space-y-4">
                           {aiRecommendation.itemizedAnalysis.map((item, idx) => (
                              <div key={idx} className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                                 <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-slate-200">{item.itemName}</span>
                                    <span className="text-xs text-slate-400">{item.qty} {item.unit}</span>
                                 </div>
                                 <p className="text-xs text-slate-400 mb-2">规格: {item.spec}</p>
                                 <p className="text-sm text-slate-300">{item.analysis}</p>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-4 bg-green-500/5 rounded-2xl border border-green-500/10">
                        <p className="text-[10px] font-black text-green-400 mb-3 uppercase tracking-tighter">成交优势</p>
                        <ul className="space-y-2">
                           {aiRecommendation.pros.map((p, i) => <li key={i} className="text-xs text-slate-400 flex items-start gap-2"><div className="w-1 h-1 bg-green-400 rounded-full mt-1.5 shrink-0"></div> {p}</li>)}
                        </ul>
                     </div>
                     <div className="p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
                        <p className="text-[10px] font-black text-red-400 mb-3 uppercase tracking-tighter">关注风险</p>
                        <ul className="space-y-2">
                           {aiRecommendation.cons.map((c, i) => <li key={i} className="text-xs text-slate-400 flex items-start gap-2"><div className="w-1 h-1 bg-red-400 rounded-full mt-1.5 shrink-0"></div> {c}</li>)}
                        </ul>
                     </div>
                  </div>
               </div>
               <div className="md:col-span-4 flex flex-col gap-6">
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl shadow-xl border border-white/10 text-center">
                     <p className="text-[10px] font-black text-blue-100 uppercase mb-2">建议推荐供应商</p>
                     <h5 className="text-xl font-black mb-6">{aiRecommendation.recommendedSupplier}</h5>
                     <button onClick={() => alert('已自动生成采购建议书并提交审批')} className="w-full py-3 bg-white text-blue-700 rounded-xl font-black text-sm hover:bg-blue-50 transition-colors shadow-lg">立即采纳并提交审批</button>
                  </div>

                  {aiRecommendation.capabilityScores && aiRecommendation.capabilityScores.length > 0 && (
                     <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                        <p className="text-[10px] font-black text-blue-400 mb-4 uppercase tracking-tighter">供应商能力模型评估</p>
                        <div className="space-y-4">
                           {aiRecommendation.capabilityScores.map((score, idx) => (
                              <div key={idx} className="space-y-2">
                                 <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-200">{score.supplier}</span>
                                    <span className="text-xs font-black text-blue-400">{score.overallScore}分</span>
                                 </div>
                                 <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                                    <div className="bg-slate-800/50 p-2 rounded-lg text-center">
                                       <span className="block mb-1">价格</span>
                                       <span className="font-bold text-slate-300">{score.priceScore}</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg text-center">
                                       <span className="block mb-1">质量</span>
                                       <span className="font-bold text-slate-300">{score.qualityScore}</span>
                                    </div>
                                    <div className="bg-slate-800/50 p-2 rounded-lg text-center">
                                       <span className="block mb-1">售后</span>
                                       <span className="font-bold text-slate-300">{score.serviceScore}</span>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}

                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex justify-between items-center mt-auto">
                     <span className="text-[10px] text-slate-500 font-bold uppercase">模型置信度</span>
                     <span className="text-xs text-blue-400 font-black">96.8%</span>
                  </div>
               </div>
            </div>
         </div>
       )}
    </div>
  );

  // --- Main Logic ---
  
  if (selectedProject) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedProject(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
              <ArrowLeft size={24} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black text-slate-900">{selectedProject.title || '新询价立项'}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase border bg-blue-50 text-blue-700 border-blue-100">
                  {selectedProject.status}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">项目流水号：{selectedProject.id} · 类型：{selectedProject.method}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all">
              <Download size={18} /> 导出详情
            </button>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
          <div className="flex items-center justify-between">
            {inquirySteps.map((s, idx) => {
              const Icon = s.icon;
              const isPast = (selectedProject?.currentStep || 0) > s.step;
              const isCurrent = (selectedProject?.currentStep || 0) === s.step;
              return (
                <React.Fragment key={s.step}>
                  <div className="flex flex-col items-center gap-2 flex-1 relative group cursor-pointer" onClick={() => isPast && updateStep(s.step)}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                      isCurrent ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 ring-4 ring-blue-50' : 
                      isPast ? 'bg-green-100 text-green-600' : 'bg-slate-50 text-slate-300'
                    }`}>
                      {isPast ? <CheckCircle2 size={24} /> : <Icon size={24} />}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest mt-2 ${isCurrent ? 'text-blue-600' : 'text-slate-400'}`}>
                      {s.label}
                    </span>
                  </div>
                  {idx < inquirySteps.length - 1 && (
                    <div className={`h-0.5 w-16 mx-2 -mt-6 transition-all duration-1000 ${isPast ? 'bg-green-200' : 'bg-slate-100'}`}></div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Stage Content */}
        <div className="min-h-[600px]">
            {selectedProject.currentStep === InquiryStep.CREATE && renderCreateStage()}
            {selectedProject.currentStep === InquiryStep.INVITE && renderInviteStage()}
            {selectedProject.currentStep === InquiryStep.PUBLISH && renderPublishStage()}
            {selectedProject.currentStep === InquiryStep.RECEIVE && renderReceiveStage()}
            {selectedProject.currentStep === InquiryStep.AWARD && renderAwardStage()}
        </div>
      </div>
    );
  }

  // --- Default List View ---
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">询比采购</h1>
          <p className="text-sm text-slate-500 mt-1">管理各采购阶段的项目进度与协作</p>
        </div>
        <button 
          onClick={() => setSelectedProject(newProject)} 
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-2xl hover:bg-slate-800 transition-all font-bold shadow-xl shadow-slate-900/10"
        >
          <Plus size={20} /> 发起询价立项
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
           <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-left">
                 <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase w-20 text-center whitespace-nowrap">序号</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">项目编号</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">项目名称</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-right">预算</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">截止日期</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">项目阶段</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {projects.map((p, index) => {
                    const currentStepLabel = inquirySteps.find(s => s.step === p.currentStep)?.label;
                    return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => setSelectedProject(p)}>
                       <td className="px-6 py-4 text-center font-bold text-slate-400 whitespace-nowrap">
                          {index + 1}
                       </td>
                       <td className="px-6 py-4 font-mono text-slate-500 font-bold">
                          {p.id}
                       </td>
                       <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{p.title}</p>
                       </td>
                       <td className="px-6 py-4 text-right">
                          <span className="font-mono font-bold text-slate-900">¥{p.budget.toLocaleString()}</span>
                       </td>
                       <td className="px-6 py-4 font-medium text-slate-600">
                          {p.deadline}
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border uppercase bg-blue-50 text-blue-700 border-blue-100">
                               {p.status}
                             </span>
                             <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-900 text-white">
                               {currentStepLabel}
                             </span>
                          </div>
                       </td>
                       <td className="px-6 py-4 text-center">
                          <button className="px-3 py-1.5 bg-white border border-slate-200 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all shadow-sm">
                             查看详情
                          </button>
                       </td>
                    </tr>
                 )})}
                 {projects.length === 0 && (
                    <tr>
                       <td colSpan={7} className="py-12 text-center text-slate-400">
                          <Search size={32} className="mx-auto mb-2 opacity-20" />
                          <p>暂无正在进行中的询价项目</p>
                       </td>
                    </tr>
                 )}
              </tbody>
           </table>
      </div>
    </div>
  );
};

export default InquiryPurchase;
