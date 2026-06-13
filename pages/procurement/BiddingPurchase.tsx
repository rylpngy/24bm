
import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, ShieldCheck, Settings2, Gavel, Trophy, Plus, Search, 
  CheckCircle2, ArrowLeft, Download, Timer, UserPlus, X, Info, 
  Calendar, ArrowRight, DollarSign, Zap, AlertTriangle, Play, Pause, 
  Square, TrendingDown, Users, Bell, Clock, Activity, BarChart3
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ProcurementMethod, ApprovalStatus } from '../../types';

enum BiddingStep {
  SETUP = 1,
  QUALIFICATION = 2,
  PRE_BID = 3,
  AUCTION = 4,
  DECISION = 5
}

interface ProjectItem {
  name: string;
  spec: string;
  qty: number;
  unit: string;
}

interface BiddingRules {
  startTime: string;
  duration: number; // minutes
  startPrice: number; // Ceiling price
  reservePrice: number; // Bottom price
  minDecrement: number; // Step
  enableExtension: boolean; // Soft close
  extensionTrigger: number; // minutes before end
  extensionPeriod: number; // minutes to extend
}

interface BidRecord {
  id: string;
  supplier: string;
  price: number;
  time: string;
  timestamp: number;
  delta: number;
  isLeader: boolean;
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
  rules?: BiddingRules;
  invitedSuppliers?: { name: string; status: 'pending' | 'accepted' | 'declined' | 'viewed'; lastAction?: string; color?: string }[];
  quotes?: any[];
}

const BiddingPurchase: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // -- Simulation State --
  const [auctionStatus, setAuctionStatus] = useState<'ready' | 'active' | 'paused' | 'ended'>('ready');
  const [timeLeft, setTimeLeft] = useState(0); // seconds
  const [bidHistory, setBidHistory] = useState<BidRecord[]>([]);
  const [currentLowestBid, setCurrentLowestBid] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bidBotRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- Mock Data --
  const [projects, setProjects] = useState<Project[]>([
    { 
      id: 'BID-20231102', 
      title: '三号生产线自动化设备竞价采购', 
      method: ProcurementMethod.BIDDING, 
      status: ApprovalStatus.PENDING, 
      budget: 2500000, 
      deadline: '2023-11-20', 
      createTime: '2023-10-25', 
      quotesCount: 5,
      currentStep: BiddingStep.PRE_BID,
      demandDetails: { 
        items: [{ name: '自动化机械臂', spec: '六轴，负载10kg', qty: 4, unit: '台' }],
        specialTerms: '需包含现场安装调试与培训。'
      },
      invitedSuppliers: [
        { name: 'ABB机器人', status: 'accepted', lastAction: '已入场', color: '#3b82f6' },
        { name: '库卡中国', status: 'accepted', lastAction: '已入场', color: '#10b981' },
        { name: '发那科', status: 'accepted', lastAction: '已入场', color: '#f59e0b' },
        { name: '安川电机', status: 'pending', lastAction: '未确认', color: '#8b5cf6' }
      ],
      rules: {
        startTime: '',
        duration: 30,
        startPrice: 2500000,
        reservePrice: 2000000,
        minDecrement: 5000,
        enableExtension: true,
        extensionTrigger: 2,
        extensionPeriod: 5
      }
    },
    { 
      id: 'BID-20231105', 
      title: '办公区IT设备批量更新竞价', 
      method: ProcurementMethod.BIDDING, 
      status: ApprovalStatus.APPROVED, 
      budget: 800000, 
      deadline: '2023-11-25', 
      createTime: '2023-11-01', 
      quotesCount: 3,
      currentStep: BiddingStep.AUCTION,
      demandDetails: { 
        items: [
          { name: '高性能笔记本电脑', spec: 'i7/32G/1T', qty: 50, unit: '台' },
          { name: '27寸显示器', spec: '4K分辨率', qty: 50, unit: '台' }
        ],
        specialTerms: '要求提供3年上门保修服务。'
      },
      invitedSuppliers: [
        { name: '联想大客户部', status: 'accepted', lastAction: '已入场', color: '#3b82f6' },
        { name: '戴尔中国', status: 'accepted', lastAction: '已入场', color: '#10b981' },
        { name: '惠普企业服务', status: 'accepted', lastAction: '已入场', color: '#f59e0b' }
      ],
      rules: {
        startTime: '2023-11-15T10:00',
        duration: 60,
        startPrice: 800000,
        reservePrice: 700000,
        minDecrement: 2000,
        enableExtension: true,
        extensionTrigger: 3,
        extensionPeriod: 5
      }
    },
    { 
      id: 'BID-20231108', 
      title: '仓储中心叉车采购项目', 
      method: ProcurementMethod.BIDDING, 
      status: ApprovalStatus.COMPLETED, 
      budget: 1200000, 
      deadline: '2023-11-10', 
      createTime: '2023-10-20', 
      quotesCount: 4,
      currentStep: BiddingStep.DECISION,
      demandDetails: { 
        items: [{ name: '电动平衡重叉车', spec: '3吨，举高4.5米', qty: 8, unit: '辆' }],
        specialTerms: '需包含备用电池组及充电桩。'
      },
      invitedSuppliers: [
        { name: '合力叉车', status: 'accepted', lastAction: '已报价', color: '#3b82f6' },
        { name: '杭叉集团', status: 'accepted', lastAction: '已报价', color: '#10b981' },
        { name: '林德物料搬运', status: 'accepted', lastAction: '已报价', color: '#f59e0b' },
        { name: '丰田叉车', status: 'accepted', lastAction: '已报价', color: '#8b5cf6' }
      ],
      rules: {
        startTime: '2023-11-08T14:00',
        duration: 45,
        startPrice: 1200000,
        reservePrice: 1000000,
        minDecrement: 5000,
        enableExtension: false,
        extensionTrigger: 0,
        extensionPeriod: 0
      }
    },
    { 
      id: 'BID-20231112', 
      title: '年度劳保用品框架协议竞价', 
      method: ProcurementMethod.BIDDING, 
      status: ApprovalStatus.PENDING, 
      budget: 500000, 
      deadline: '2023-12-05', 
      createTime: '2023-11-10', 
      quotesCount: 0,
      currentStep: BiddingStep.SETUP,
      demandDetails: { 
        items: [
          { name: '安全帽', spec: 'ABS材质，防砸', qty: 2000, unit: '顶' },
          { name: '劳保鞋', spec: '防砸防穿刺', qty: 2000, unit: '双' },
          { name: '反光背心', spec: '国标高亮', qty: 2000, unit: '件' }
        ],
        specialTerms: '按季度分批交货，支持各地分公司单独下单。'
      },
      invitedSuppliers: [],
      rules: {
        startTime: '',
        duration: 30,
        startPrice: 500000,
        reservePrice: 400000,
        minDecrement: 1000,
        enableExtension: true,
        extensionTrigger: 2,
        extensionPeriod: 3
      }
    },
    { 
      id: 'BID-20231115', 
      title: '研发中心服务器扩容采购', 
      method: ProcurementMethod.BIDDING, 
      status: ApprovalStatus.APPROVED, 
      budget: 3500000, 
      deadline: '2023-12-10', 
      createTime: '2023-11-12', 
      quotesCount: 6,
      currentStep: BiddingStep.QUALIFICATION,
      demandDetails: { 
        items: [
          { name: 'GPU服务器', spec: '8卡 A800', qty: 2, unit: '台' },
          { name: '存储服务器', spec: '100TB NVMe', qty: 4, unit: '台' }
        ],
        specialTerms: '需提供原厂授权及5年维保。'
      },
      invitedSuppliers: [
        { name: '浪潮信息', status: 'accepted', lastAction: '已提交资质', color: '#3b82f6' },
        { name: '新华三', status: 'accepted', lastAction: '已提交资质', color: '#10b981' },
        { name: '华为政企', status: 'pending', lastAction: '未确认', color: '#f59e0b' },
        { name: '超聚变', status: 'accepted', lastAction: '已提交资质', color: '#8b5cf6' },
        { name: '曙光', status: 'accepted', lastAction: '已提交资质', color: '#ec4899' },
        { name: '宁畅', status: 'declined', lastAction: '已拒绝', color: '#64748b' }
      ],
      rules: {
        startTime: '2023-12-01T09:30',
        duration: 120,
        startPrice: 3500000,
        reservePrice: 3000000,
        minDecrement: 10000,
        enableExtension: true,
        extensionTrigger: 5,
        extensionPeriod: 10
      }
    },
    { 
      id: 'BID-20231118', 
      title: '全国门店安防监控系统改造', 
      method: ProcurementMethod.BIDDING, 
      status: ApprovalStatus.REJECTED, 
      budget: 1800000, 
      deadline: '2023-11-28', 
      createTime: '2023-11-15', 
      quotesCount: 0,
      currentStep: BiddingStep.SETUP,
      demandDetails: { 
        items: [
          { name: '高清网络摄像机', spec: '400万像素，星光级', qty: 500, unit: '台' },
          { name: 'NVR录像机', spec: '32路，支持AI分析', qty: 50, unit: '台' }
        ],
        specialTerms: '预算超标，需重新评估方案。'
      },
      invitedSuppliers: [],
      rules: {
        startTime: '',
        duration: 45,
        startPrice: 1800000,
        reservePrice: 1500000,
        minDecrement: 5000,
        enableExtension: true,
        extensionTrigger: 3,
        extensionPeriod: 5
      }
    },
    { 
      id: 'BID-20231120', 
      title: '员工食堂食材年度供应商竞价', 
      method: ProcurementMethod.BIDDING, 
      status: ApprovalStatus.APPROVED, 
      budget: 4000000, 
      deadline: '2023-12-20', 
      createTime: '2023-11-18', 
      quotesCount: 8,
      currentStep: BiddingStep.PRE_BID,
      demandDetails: { 
        items: [
          { name: '大米', spec: '东北大米，一级', qty: 50000, unit: 'kg' },
          { name: '食用油', spec: '非转基因大豆油', qty: 10000, unit: 'L' },
          { name: '鲜肉类', spec: '猪/牛/羊肉综合', qty: 20000, unit: 'kg' }
        ],
        specialTerms: '要求具备完善的食品安全追溯体系，每日冷链配送。'
      },
      invitedSuppliers: [
        { name: '中粮集团', status: 'accepted', lastAction: '已入场', color: '#3b82f6' },
        { name: '益海嘉里', status: 'accepted', lastAction: '已入场', color: '#10b981' },
        { name: '双汇发展', status: 'accepted', lastAction: '已入场', color: '#f59e0b' },
        { name: '本地农贸联社', status: 'accepted', lastAction: '已入场', color: '#8b5cf6' }
      ],
      rules: {
        startTime: '2023-12-15T10:00',
        duration: 90,
        startPrice: 4000000,
        reservePrice: 3500000,
        minDecrement: 20000,
        enableExtension: true,
        extensionTrigger: 5,
        extensionPeriod: 5
      }
    }
  ]);

  // Create Form State
  const [newProject, setNewProject] = useState<Project>({
    id: `BID-${Date.now().toString().slice(-8)}`,
    title: '',
    method: ProcurementMethod.BIDDING,
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
    rules: {
      startTime: '',
      duration: 20,
      startPrice: 0,
      reservePrice: 0,
      minDecrement: 100,
      enableExtension: true,
      extensionTrigger: 2,
      extensionPeriod: 5
    },
    quotes: []
  });

  const biddingSteps = [
    { step: 1, label: '竞价立项', icon: FileText },
    { step: 2, label: '资格预审', icon: ShieldCheck },
    { step: 3, label: '规则设置', icon: Settings2 },
    { step: 4, label: '正式竞价', icon: Gavel },
    { step: 5, label: '结果确认', icon: Trophy },
  ];

  // --- Effects for Auction Simulation ---

  useEffect(() => {
    // Timer Logic
    if (auctionStatus === 'active' && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0 && auctionStatus === 'active') {
      setAuctionStatus('ended');
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [auctionStatus, timeLeft]);

  useEffect(() => {
    // Bot Bidding Logic
    if (auctionStatus === 'active') {
      const randomDelay = Math.floor(Math.random() * 4000) + 3000; // 3-7 seconds
      bidBotRef.current = setTimeout(() => {
        simulateBotBid();
      }, randomDelay);
    }
    return () => { if (bidBotRef.current) clearTimeout(bidBotRef.current); };
  }, [auctionStatus, currentLowestBid, bidHistory]); 

  const simulateBotBid = () => {
    if (!selectedProject || !selectedProject.rules) return;
    
    // Pick a random supplier who is accepted
    const activeSuppliers = selectedProject.invitedSuppliers?.filter(s => s.status === 'accepted') || [];
    if (activeSuppliers.length === 0) return;
    
    // Weighted random to favor those who aren't currently leading (simple logic)
    const currentLeader = bidHistory.length > 0 ? bidHistory[0].supplier : '';
    const candidates = activeSuppliers.filter(s => s.name !== currentLeader);
    const randomSupplier = candidates.length > 0 
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : activeSuppliers[Math.floor(Math.random() * activeSuppliers.length)];

    // Calculate new price
    const decrement = selectedProject.rules.minDecrement;
    const drop = Math.floor(Math.random() * 2 + 1) * decrement; // Drop by 1-2x the step
    const newPrice = currentLowestBid - drop;

    // Stop if below reserve price (with some probability to stop early)
    if (newPrice < (selectedProject.rules.reservePrice * 0.95)) return;

    const newBid: BidRecord = {
      id: `BID-${Date.now()}`,
      supplier: randomSupplier.name,
      price: newPrice,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      timestamp: Date.now(),
      delta: -drop,
      isLeader: true
    };

    // Update history: Mark previous leader as false
    const updatedHistory = bidHistory.map(b => ({ ...b, isLeader: false }));
    setBidHistory([newBid, ...updatedHistory]);
    setCurrentLowestBid(newPrice);

    // Soft close logic: if bid in last N mins, extend
    const triggerSeconds = selectedProject.rules.extensionTrigger * 60;
    if (selectedProject.rules.enableExtension && timeLeft < triggerSeconds) {
        setTimeLeft(t => t + (selectedProject.rules!.extensionPeriod * 60));
    }
  };

  const startAuction = () => {
    if (!selectedProject?.rules) return;
    setAuctionStatus('active');
  };

  const toggleAuction = () => {
    if (auctionStatus === 'active') setAuctionStatus('paused');
    else if (auctionStatus === 'paused') setAuctionStatus('active');
    else if (auctionStatus === 'ready') startAuction();
  };

  const stopAuction = () => {
    setAuctionStatus('ended');
  };

  // --- Handlers ---

  const updateStep = (step: number) => {
    if (!selectedProject) return;
    const updated = { ...selectedProject, currentStep: step };
    
    // Initialize Simulation Data when entering Step 4
    if (step === BiddingStep.AUCTION && auctionStatus === 'ready') {
       const startPrice = selectedProject.rules?.startPrice || 2500000;
       setCurrentLowestBid(startPrice - 50000); // Already some bids
       setTimeLeft((selectedProject.rules?.duration || 30) * 60);
       
       // Pre-fill some history so it's not empty
       const initialHistory: BidRecord[] = [
         { id: 'b1', supplier: '发那科', price: startPrice - 50000, time: '10:05:22', timestamp: Date.now()-1000, delta: -20000, isLeader: true },
         { id: 'b2', supplier: '库卡中国', price: startPrice - 30000, time: '10:02:15', timestamp: Date.now()-50000, delta: -10000, isLeader: false },
         { id: 'b3', supplier: 'ABB机器人', price: startPrice - 20000, time: '10:01:05', timestamp: Date.now()-120000, delta: -20000, isLeader: false },
         { id: 'b4', supplier: '发那科', price: startPrice, time: '10:00:00', timestamp: Date.now()-300000, delta: 0, isLeader: false },
       ];
       setBidHistory(initialHistory);
    }

    setSelectedProject(updated);
    setProjects(projects.map(p => p.id === selectedProject.id ? updated : p));
  };

  // --- Renders ---

  const renderCreateStage = () => (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
        <Info className="text-blue-600" size={20} /> 竞价项目基础信息
      </h3>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase">项目名称</label>
          <input type="text" value={selectedProject?.title} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="输入竞价项目名称" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase">预算 (元)</label>
          <input type="number" value={selectedProject?.budget} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
        </div>
      </div>
      
      <div className="pt-8 border-t flex justify-end">
        <button onClick={() => updateStep(2)} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-lg shadow-blue-200 flex items-center gap-2 hover:bg-blue-700 transition-all group">
          保存并下一步 <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );

  const renderQualificationStage = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex justify-between items-center">
           <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><UserPlus className="text-blue-600" /> 邀请竞价方</h3>
           <div className="relative w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none" placeholder="搜索供应商..." />
           </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
           {[
             { name: 'ABB机器人', tier: '战略合作', score: 98, status: '已邀请' },
             { name: '库卡中国', tier: '重点供应', score: 95, status: '已邀请' },
             { name: '发那科', tier: '重点供应', score: 96, status: '已邀请' },
             { name: '安川电机', tier: '潜在供应商', score: 90, status: '未邀请' },
           ].map((s, i) => (
             <div key={i} className={`p-4 border rounded-2xl transition-all cursor-pointer group flex justify-between items-center ${s.status === '已邀请' ? 'border-green-200 bg-green-50/30' : 'border-slate-100 hover:border-blue-400'}`}>
                <div>
                  <p className="font-bold text-slate-900">{s.name}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] bg-white border px-2 py-0.5 rounded-full font-bold text-slate-500 uppercase">{s.tier}</span>
                  </div>
                </div>
                <div className="text-right">
                   {s.status === '已邀请' ? (
                      <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle2 size={14}/> 已入围</span>
                   ) : (
                      <button className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">邀请</button>
                   )}
                </div>
             </div>
           ))}
        </div>

        <div className="flex justify-end pt-6 border-t border-slate-100">
           <button onClick={() => updateStep(3)} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2">
             确认名单，进入规则设置 <ArrowRight size={18} />
           </button>
        </div>
      </div>
    </div>
  );

  const renderRuleSettingsStage = () => {
    const rules = selectedProject?.rules;
    const updateRules = (field: keyof BiddingRules, value: any) => {
        if (selectedProject) {
            const newRules = { ...selectedProject.rules!, [field]: value };
            setSelectedProject({ ...selectedProject, rules: newRules });
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                    <Settings2 className="text-blue-600" size={24} /> 竞价规则配置
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Time Rules */}
                    <div className="space-y-6">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Calendar size={16}/> 时间安排</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">计划开始时间</label>
                                    <input 
                                        type="datetime-local" 
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">竞价时长 (分钟)</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={rules?.duration} 
                                            onChange={e => updateRules('duration', Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                                        />
                                        <span className="text-sm text-slate-500 font-bold whitespace-nowrap">Mins</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Clock size={16}/> 延时机制 (防作弊)</h4>
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-medium text-slate-700">启用自动延时</span>
                                <div 
                                    onClick={() => updateRules('enableExtension', !rules?.enableExtension)}
                                    className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${rules?.enableExtension ? 'bg-blue-600' : 'bg-slate-300'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${rules?.enableExtension ? 'translate-x-4' : ''}`}></div>
                                </div>
                            </div>
                            {rules?.enableExtension && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">触发时间 (最后N分钟)</label>
                                        <input 
                                            type="number" 
                                            value={rules.extensionTrigger}
                                            onChange={e => updateRules('extensionTrigger', Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">延长周期 (分钟)</label>
                                        <input 
                                            type="number" 
                                            value={rules.extensionPeriod}
                                            onChange={e => updateRules('extensionPeriod', Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Price Rules */}
                    <div className="space-y-6">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><DollarSign size={16}/> 价格规则</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">起拍价 (最高限价)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                                        <input 
                                            type="number" 
                                            value={rules?.startPrice} 
                                            onChange={e => updateRules('startPrice', Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">保留价 (底价 - 仅内部可见)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                                        <input 
                                            type="number" 
                                            value={rules?.reservePrice} 
                                            onChange={e => updateRules('reservePrice', Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">最小降价幅度 (步长)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                                        <input 
                                            type="number" 
                                            value={rules?.minDecrement} 
                                            onChange={e => updateRules('minDecrement', Number(e.target.value))}
                                            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Settings2 size={16}/> 供应商可见性</h4>
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" defaultChecked />
                                    <span className="text-sm text-slate-700">显示当前排名</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" defaultChecked />
                                    <span className="text-sm text-slate-700">显示当前最低价</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                                    <span className="text-sm text-slate-700">显示竞争对手名称 (通常不勾选)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={() => updateStep(2)} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50">上一步</button>
                    <button onClick={() => updateStep(4)} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 shadow-lg flex items-center gap-2">
                        保存配置并发布 <Zap size={16} className="text-yellow-400" />
                    </button>
                </div>
            </div>
        </div>
    );
  };

  const renderAuctionStage = () => {
    // Format Seconds to MM:SS
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate chart data from bid history (reversed for chart chronological order)
    const chartData = [...bidHistory].reverse().map((b, i) => ({
        index: i + 1,
        price: b.price,
        supplier: b.supplier,
        time: b.time
    }));

    // Calculate Rank
    const rankings = selectedProject?.invitedSuppliers?.map(s => {
        const latestBid = bidHistory.find(b => b.supplier === s.name);
        return {
            name: s.name,
            color: s.color,
            price: latestBid ? latestBid.price : undefined,
            hasBid: !!latestBid
        };
    }).sort((a, b) => {
        // Sort: Has Bid -> Low Price -> Name
        if (a.hasBid && !b.hasBid) return -1;
        if (!a.hasBid && b.hasBid) return 1;
        if (a.hasBid && b.hasBid) return (a.price || 0) - (b.price || 0);
        return 0;
    }) || [];

    const startPrice = selectedProject?.rules?.startPrice || 0;
    const reservePrice = selectedProject?.rules?.reservePrice || 0;

    return (
      <div className="space-y-6 animate-in zoom-in-95 duration-500">
         {/* Live Auction Header */}
         <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8">
            {/* Background Animation */}
            <div className={`absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 ${auctionStatus === 'active' ? 'animate-pulse' : ''}`}></div>
            
            <div className="relative z-10 flex items-center gap-6 w-full md:w-auto">
                <div className={`w-24 h-24 rounded-3xl flex flex-col items-center justify-center border-4 shadow-xl backdrop-blur-sm ${
                    auctionStatus === 'active' ? 'border-green-500 bg-green-500/10 text-green-400' :
                    auctionStatus === 'paused' ? 'border-amber-500 bg-amber-500/10 text-amber-400' :
                    'border-slate-600 bg-slate-800 text-slate-400'
                }`}>
                    <Clock size={32} className={`mb-1 ${auctionStatus === 'active' ? 'animate-spin-slow' : ''}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Status</span>
                </div>
                <div>
                    <h2 className="text-3xl font-black tracking-tight leading-tight">{selectedProject?.title}</h2>
                    <div className="flex items-center gap-3 mt-3">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 ${
                            auctionStatus === 'active' ? 'bg-green-500 text-slate-900 animate-pulse' :
                            auctionStatus === 'paused' ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300'
                        }`}>
                            <Activity size={14} />
                            {auctionStatus === 'active' ? 'LIVE BIDDING' : auctionStatus === 'paused' ? 'PAUSED' : auctionStatus === 'ready' ? 'READY' : 'FINISHED'}
                        </span>
                        <span className="text-slate-400 text-sm font-medium border-l border-white/20 pl-3">ID: {selectedProject?.id}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-8 relative z-10 w-full md:w-auto justify-between md:justify-end bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Time Remaining</p>
                    <p className={`text-5xl font-mono font-black tabular-nums tracking-tight ${timeLeft < 60 && auctionStatus === 'active' ? 'text-red-500' : 'text-white'}`}>
                        {formatTime(timeLeft)}
                    </p>
                </div>
                <div className="w-px h-16 bg-white/10"></div>
                <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Current Lowest</p>
                    <p className="text-5xl font-black text-green-400 tracking-tight flex items-start">
                        <span className="text-2xl mt-2 mr-1">¥</span>
                        {currentLowestBid > 0 ? currentLowestBid.toLocaleString() : '---'}
                    </p>
                </div>
            </div>
         </div>

         {/* Controls Bar */}
         <div className="flex justify-center -mt-10 relative z-20">
            <div className="flex bg-white/90 backdrop-blur-md p-1.5 rounded-2xl border border-white/50 shadow-lg gap-2">
                <button 
                    onClick={toggleAuction}
                    disabled={auctionStatus === 'ended'}
                    className={`px-8 py-3 rounded-xl font-black text-sm transition-all flex items-center gap-2 shadow-sm ${
                        auctionStatus === 'active' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 
                        'bg-slate-900 text-white hover:bg-slate-800'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {auctionStatus === 'active' ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                    {auctionStatus === 'active' ? '暂停竞价' : auctionStatus === 'ready' ? '开始竞价' : '继续竞价'}
                </button>
                <div className="w-px bg-slate-200 my-2"></div>
                <button 
                    onClick={stopAuction}
                    disabled={auctionStatus === 'ended'}
                    className="px-8 py-3 rounded-xl text-red-600 font-black text-sm hover:bg-red-50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Square size={18} fill="currentColor" /> 结束竞价
                </button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            {/* Left: Live Feed */}
            <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-black text-slate-900 flex items-center gap-2 text-lg">
                        <Zap size={20} className="text-yellow-500 fill-yellow-500" /> 实时出价流
                    </h3>
                    <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg">{bidHistory.length} 记录</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                    {bidHistory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Activity size={48} className="mb-4 opacity-10" />
                            <p className="text-sm font-medium">等待出价...</p>
                        </div>
                    ) : (
                        bidHistory.map((bid, i) => (
                            <div key={bid.id} className={`p-4 rounded-2xl border flex justify-between items-center animate-in slide-in-from-left-4 duration-300 transition-all ${
                                i === 0 ? 'bg-white border-green-200 shadow-md ring-1 ring-green-100 scale-[1.02]' : 'bg-white border-slate-100 hover:border-slate-200'
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${i === 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {bid.supplier.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold text-sm ${i === 0 ? 'text-slate-900' : 'text-slate-600'}`}>{bid.supplier}</span>
                                            {i === 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">New</span>}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-0.5 font-mono">{bid.time}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-mono font-black text-lg ${i === 0 ? 'text-green-600' : 'text-slate-700'}`}>¥{bid.price.toLocaleString()}</p>
                                    <p className="text-[10px] font-bold text-slate-400 flex items-center justify-end gap-0.5">
                                        <TrendingDown size={10} className="text-green-500" /> {Math.abs(bid.delta).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Middle: Rank & Chart */}
            <div className="lg:col-span-2 flex flex-col gap-6">
                {/* Ranking Board */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 overflow-hidden flex flex-col flex-1">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-slate-900 flex items-center gap-2 text-lg">
                            <Trophy size={20} className="text-blue-600" /> 实时竞价排行榜
                        </h3>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                            <div className="w-2 h-2 rounded-full bg-slate-200"></div> 未出价
                            <div className="w-2 h-2 rounded-full bg-green-500 ml-2"></div> 当前领先
                        </div>
                    </div>
                    
                    <div className="flex-1 space-y-5 overflow-y-auto pr-2">
                        {rankings.map((rank, i) => {
                            // Calculate simple progress bar based on start price. Lower is better (more filled towards left or custom viz)
                            // Let's do: Width % = (StartPrice - CurrentPrice) / (StartPrice - ReservePrice) * 100
                            // But visually, maybe just mark the lowest price distinctly.
                            
                            const isLeading = i === 0 && rank.hasBid;
                            const priceDiff = startPrice - (rank.price || startPrice);
                            const maxDiff = startPrice - reservePrice;
                            const progress = rank.hasBid ? Math.min((priceDiff / maxDiff) * 100, 100) : 0;

                            return (
                                <div key={i} className={`relative p-3 rounded-xl transition-all ${isLeading ? 'bg-blue-50/50 border border-blue-100' : ''}`}>
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                                            i === 0 ? 'bg-yellow-400 text-white shadow-md' :
                                            i === 1 ? 'bg-slate-200 text-slate-600' :
                                            i === 2 ? 'bg-orange-200 text-orange-700' : 'bg-slate-50 text-slate-400'
                                        }`}>
                                            {i + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className={`font-bold ${isLeading ? 'text-blue-700' : 'text-slate-700'}`}>{rank.name}</span>
                                                <span className={`font-mono font-bold ${rank.hasBid ? (isLeading ? 'text-green-600 text-base' : 'text-slate-900') : 'text-slate-400'}`}>
                                                    {rank.hasBid ? `¥${rank.price?.toLocaleString()}` : '等待出价...'}
                                                </span>
                                            </div>
                                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex items-center">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-700 ease-out ${isLeading ? 'bg-green-500' : 'bg-blue-400'}`}
                                                    style={{ width: `${Math.max(progress, 5)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        {isLeading && (
                                            <div className="absolute right-0 top-0 -mt-2 -mr-2 bg-yellow-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-bounce">
                                                领先
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Mini Chart */}
                <div className="h-64 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col">
                    <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2 text-sm">
                        <BarChart3 size={16} className="text-slate-400" /> 价格趋势图
                    </h3>
                    <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="time" hide />
                                <YAxis domain={['auto', 'auto']} hide />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                    formatter={(value: number) => [`¥${value.toLocaleString()}`, 'Price']}
                                />
                                <Area type="stepAfter" dataKey="price" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" animationDuration={300} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
         </div>
      </div>
    );
  };

  const renderDecisionStage = () => (
      <div className="bg-white p-12 text-center rounded-[2.5rem] border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">竞价已结束</h2>
          <p className="text-slate-500 mb-8">最终成交供应商为 <strong className="text-slate-900">{bidHistory[0]?.supplier || '无'}</strong>，成交价 <strong className="text-green-600">¥{currentLowestBid.toLocaleString()}</strong></p>
          <button onClick={() => setSelectedProject(null)} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all">
              返回项目列表
          </button>
      </div>
  );

  // Main Render Logic
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
                <h1 className="text-xl font-black text-slate-900">{selectedProject.title || '新竞价立项'}</h1>
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
            {biddingSteps.map((s, idx) => {
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
                  {idx < biddingSteps.length - 1 && (
                    <div className={`h-0.5 w-16 mx-2 -mt-6 transition-all duration-1000 ${isPast ? 'bg-green-200' : 'bg-slate-100'}`}></div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Stage Switcher */}
        <div className="min-h-[600px]">
            {(selectedProject.currentStep === BiddingStep.SETUP) && renderCreateStage()}
            {(selectedProject.currentStep === BiddingStep.QUALIFICATION) && renderQualificationStage()}
            {(selectedProject.currentStep === BiddingStep.PRE_BID) && renderRuleSettingsStage()}
            {(selectedProject.currentStep === BiddingStep.AUCTION) && renderAuctionStage()}
            {(selectedProject.currentStep === BiddingStep.DECISION) && renderDecisionStage()}
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">竞价采购</h1>
          <p className="text-sm text-slate-500 mt-1">公开招标与在线竞价管理</p>
        </div>
        <button 
          onClick={() => setSelectedProject(newProject)} 
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-2xl hover:bg-slate-800 transition-all font-bold shadow-xl shadow-slate-900/10"
        >
          <Plus size={20} /> 发起竞价立项
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
                    const currentStepLabel = biddingSteps.find(s => s.step === p.currentStep)?.label;
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
                          <p>暂无正在进行中的竞价项目</p>
                       </td>
                    </tr>
                 )}
              </tbody>
           </table>
      </div>
    </div>
  );
};

export default BiddingPurchase;
