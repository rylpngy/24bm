
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, ShoppingCart, FileText, BarChart3, Settings,
  Bell, Search, UserCircle, ChevronDown, ChevronRight, Sparkles, 
  Gavel, ShieldCheck, ClipboardCheck, Store, MessageSquareQuote, Zap,
  Wallet, FolderKanban, FileInput, FileCog, Archive, Database, Network,
  Truck, Receipt, TrendingUp, PieChart, LogOut, Globe, Workflow,
  Package, Boxes, Repeat, ListChecks
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon?: any;
  badge?: number;
}

interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  userRole: 'purchaser' | 'supplier';
  onSwitchRole: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, onLogout, userRole, onSwitchRole }) => {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // --- Purchaser Menu (智采云) ---
  const purchaserMenuGroups: MenuGroup[] = [
    {
      id: 'general',
      label: '基础工作台',
      items: [
        { id: 'dashboard', label: '控制面板', icon: LayoutDashboard },
      ]
    },
    {
      id: 'srm',
      label: '供应商关系 (SRM)',
      items: [
        { id: 'suppliers/sourcing', label: '智能寻源', icon: Sparkles },
        { id: 'suppliers/list', label: '供应商库', icon: Users },
        { id: 'suppliers/approval', label: '智能审批', icon: ClipboardCheck, badge: 5 },
        { id: 'suppliers/finance', label: '费用管理', icon: Wallet },
      ]
    },
    {
      id: 'project',
      label: '项目管理 (PM)',
      items: [
        { id: 'projects/needs', label: '采购需求', icon: FileInput, badge: 5 },
        { id: 'projects/plan', label: '采购方案', icon: FileCog },
        { id: 'projects/archive', label: '项目档案', icon: Archive },
      ]
    },
    {
      id: 'procure',
      label: '采购中心',
      items: [
        { id: 'procurement/inquiry', label: '询比采购', icon: MessageSquareQuote },
        { id: 'procurement/bidding', label: '竞价采购', icon: Gavel },
        { id: 'procurement/mall', label: 'B2B 商城', icon: Store },
      ]
    },
    {
      id: 'collaboration',
      label: '采购协同',
      items: [
        { id: 'collaboration/contracts', label: '合同管理', icon: FileText },
        { id: 'collaboration/orders', label: '订单管理', icon: Truck },
        { id: 'collaboration/finance', label: '财务管理', icon: Receipt },
      ]
    },
    {
      id: 'analytics',
      label: '智能决策',
      items: [
        { id: 'analytics/overview', label: '采购概览', icon: PieChart },
        { id: 'analytics/price', label: '价格指标', icon: TrendingUp },
        { id: 'analytics/spend', label: '支出分析', icon: BarChart3 },
      ]
    },
    {
      id: 'system',
      label: '系统管理',
      items: [
        { id: 'system/org', label: '组织架构', icon: Network },
        { id: 'system/permission', label: '角色权限', icon: ShieldCheck },
        { id: 'system/workflow', label: '流程设置', icon: Workflow },
        { id: 'system/material', label: '物料主数据', icon: Database },
      ]
    }
  ];

  // --- Supplier Menu (慧销云) ---
  const supplierMenuGroups: MenuGroup[] = [
    {
      id: 'general',
      label: '销售工作台',
      items: [
        { id: 'dashboard', label: '生意概览', icon: LayoutDashboard },
      ]
    },
    {
      id: 'sales',
      label: '商机与销售',
      items: [
        { id: 'supplier/business-hall', label: '商机大厅', icon: Globe },
        { id: 'supplier/bids', label: '我的投标', icon: Gavel, badge: 2 },
        { id: 'supplier/quotes', label: '询价回复', icon: MessageSquareQuote },
        { id: 'supplier/products', label: '商品管理', icon: Boxes },
      ]
    },
    {
      id: 'fulfillment',
      label: '交付与履约',
      items: [
        { id: 'supplier/orders', label: '销售订单', icon: Package, badge: 12 },
        { id: 'supplier/delivery', label: '发货管理', icon: Truck },
        { id: 'supplier/contracts', label: '销售合同', icon: FileText },
      ]
    },
    {
      id: 'finance',
      label: '资金结算',
      items: [
        { id: 'supplier/settlement', label: '对账单', icon: Receipt },
        { id: 'supplier/invoice', label: '发票管理', icon: TicketIcon },
        { id: 'supplier/receivable', label: '应收账款', icon: Wallet },
      ]
    },
    {
      id: 'profile',
      label: '企业设置',
      items: [
        { id: 'supplier/info', label: '企业档案', icon: Building2Icon },
        { id: 'supplier/qualification', label: '资质认证', icon: FileBadgeIcon },
        { id: 'supplier/users', label: '员工管理', icon: Users },
      ]
    }
  ];

  const currentMenuGroups = userRole === 'purchaser' ? purchaserMenuGroups : supplierMenuGroups;

  const isTabActive = (tabId: string) => {
    if (activeTab === tabId) return true;
    if (activeTab.split('/')[0] === tabId.split('/')[0] && tabId.includes('/')) return activeTab === tabId;
    return false;
  };

  // Initialize expanded groups based on role and active tab
  useEffect(() => {
    const activeGroup = currentMenuGroups.find(group => group.items.some(item => isTabActive(item.id)));
    
    let initialGroups: string[] = [];
    if (userRole === 'purchaser') {
      initialGroups = ['srm', 'project', 'procure', 'collaboration', 'system', 'analytics'];
    } else {
      initialGroups = ['sales', 'finance', 'profile'];
    }

    if (activeGroup && !initialGroups.includes(activeGroup.id)) {
      initialGroups.push(activeGroup.id);
    }
    
    setExpandedGroups(prev => {
      const newGroups = new Set([...prev, ...initialGroups]);
      if (activeGroup) newGroups.add(activeGroup.id);
      return Array.from(newGroups);
    });
  }, [userRole, activeTab]);

  const brandName = userRole === 'purchaser' ? '智采云' : '慧销云';
  const brandSub = userRole === 'purchaser' ? 'Smart Procurement' : 'Vendor Portal';
  const brandColor = userRole === 'purchaser' ? 'bg-blue-600' : 'bg-orange-600'; // Differentiate by color

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-2xl z-20 transition-all duration-300">
        <div className="p-6 flex items-center gap-3">
          <div className={`w-10 h-10 ${brandColor} rounded-xl flex items-center justify-center font-bold text-xl shadow-lg shadow-black/20 transition-colors duration-300`}>
            {userRole === 'purchaser' ? '智' : '慧'}
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight leading-none">{brandName}</span>
            <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${userRole === 'purchaser' ? 'text-blue-400' : 'text-orange-400'}`}>
              {brandSub}
            </span>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto px-3 space-y-6 pb-6">
          {currentMenuGroups.map((group) => (
            <div key={group.id} className="space-y-1">
              <button 
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
              >
                {group.label}
                {expandedGroups.includes(group.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              
              {expandedGroups.includes(group.id) && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isTabActive(item.id);
                    const activeBg = userRole === 'purchaser' ? 'bg-blue-600' : 'bg-orange-600';
                    const badgeBg = userRole === 'purchaser' ? 'bg-blue-600' : 'bg-orange-600';

                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${
                          isActive 
                            ? `${activeBg} text-white shadow-lg` 
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'} />
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${isActive ? 'bg-white ' + (userRole === 'purchaser' ? 'text-blue-600' : 'text-orange-600') : 'bg-red-600 text-white'}`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800 transition-all cursor-pointer group">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-slate-700 overflow-hidden">
                <img src={userRole === 'purchaser' ? "https://picsum.photos/seed/manager/100" : "https://picsum.photos/seed/vendor/100"} alt="Avatar" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-slate-900 rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-bold truncate">{userRole === 'purchaser' ? '张经理' : '王总'}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">
                {userRole === 'purchaser' ? '采购部总监' : '销售总监'}
              </p>
            </div>
            <button onClick={onLogout} title="退出登录">
               <LogOut size={16} className="text-slate-500 group-hover:text-red-400 transition-colors" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4 w-96">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder={userRole === 'purchaser' ? "搜索寻源、订单、合同、供应商..." : "搜索订单、商品、客户..."}
                className="w-full bg-slate-50 border border-slate-200 rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Role Switcher Button */}
            <button 
              onClick={onSwitchRole} 
              className={`flex items-center gap-2 text-xs font-bold transition-all px-4 py-2 rounded-full border shadow-sm ${
                userRole === 'purchaser' 
                  ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' 
                  : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'
              }`}
              title="切换工作台角色"
            >
              <Repeat size={14} />
              <span>切换至{userRole === 'purchaser' ? '慧销云 (供应商)' : '智采云 (采购方)'}</span>
            </button>

            <button 
              onClick={onLogout} 
              className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors bg-slate-50 hover:bg-blue-50 px-3 py-1.5 rounded-full"
              title="前往供应商门户首页"
            >
              <Globe size={16} />
              <span>门户首页</span>
            </button>

            <div className="h-6 w-px bg-slate-200"></div>

            <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 rounded-full text-blue-700 text-xs font-bold">
              <Sparkles size={14} />
              AI 助手在线
            </div>
            <button className="relative text-slate-600 hover:text-blue-600 transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white font-bold">4</span>
            </button>
            <div className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-all">
              <span className="text-sm font-medium text-slate-600">简体中文</span>
              <ChevronDown size={14} className="text-slate-400" />
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto bg-[#f8fafc]">
          <div className="max-w-7xl mx-auto p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

// Icons for the supplier menu (Mocking imports since not all are in lucide-react standard set in prompt context, mapping to close ones)
const TicketIcon = ({size, className}: any) => <Receipt size={size} className={className} />;
const Building2Icon = ({size, className}: any) => <Store size={size} className={className} />;
const FileBadgeIcon = ({size, className}: any) => <ShieldCheck size={size} className={className} />;

export default Layout;
