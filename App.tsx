
import React, { useState } from 'react';
import Layout from './components/Layout';
import Portal from './pages/Portal';
import AuthPage from './pages/Auth';
import Dashboard from './pages/Dashboard';
import SupplierManagement from './pages/SupplierManagement';
import ProcurementExecution from './pages/ProcurementExecution';
import ProcurementCollaboration from './pages/ProcurementCollaboration';
import Analytics from './pages/Analytics';
import ProjectManagement from './pages/ProjectManagement';
import SystemManagement from './pages/SystemManagement';

// Supplier Pages (HuiXiaoYun)
import SupplierDashboard from './pages/supplier-backend/SupplierDashboard';
import SupplierBids from './pages/supplier-backend/SupplierBids';
import SupplierQuotes from './pages/supplier-backend/SupplierQuotes';
import SupplierOrders from './pages/supplier-backend/SupplierOrders';
import SupplierDelivery from './pages/supplier-backend/SupplierDelivery';
import SupplierSettlement from './pages/supplier-backend/SupplierSettlement';
import SupplierProducts from './pages/supplier-backend/SupplierProducts';
import SupplierContracts from './pages/supplier-backend/SupplierContracts';
import SupplierInfo from './pages/supplier-backend/SupplierInfo';
import SupplierQualification from './pages/supplier-backend/SupplierQualification';
import SupplierUsers from './pages/supplier-backend/SupplierUsers';
import SupplierBusinessHall from './pages/supplier-backend/SupplierBusinessHall';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentView, setCurrentView] = useState<'portal' | 'login' | 'register' | 'system'>('portal');
  const [userRole, setUserRole] = useState<'purchaser' | 'supplier'>('purchaser');

  const handleLoginSuccess = () => {
    setCurrentView('system');
  };

  const handleNavigate = (view: 'portal' | 'login' | 'register' | 'system') => {
    setCurrentView(view);
  };

  const handleLogout = () => {
    setCurrentView('portal');
    setActiveTab('dashboard'); 
    setUserRole('purchaser'); // Reset role on logout
  };

  const handleSwitchRole = () => {
    const newRole = userRole === 'purchaser' ? 'supplier' : 'purchaser';
    setUserRole(newRole);
    setActiveTab('dashboard'); // Reset tab when switching contexts
  };

  const renderSystemContent = () => {
    // --- SUPPLIER BACKEND ROUTES (慧销云) ---
    if (userRole === 'supplier') {
      switch (activeTab) {
        case 'dashboard':
          return <SupplierDashboard onNavigate={setActiveTab} />;
        case 'supplier/business-hall':
          return <SupplierBusinessHall />;
        case 'supplier/bids':
          return <SupplierBids />;
        case 'supplier/quotes':
          return <SupplierQuotes />;
        case 'supplier/products':
          return <SupplierProducts />;
        case 'supplier/orders':
          return <SupplierOrders />;
        case 'supplier/delivery':
          return <SupplierDelivery />;
        case 'supplier/contracts':
          return <SupplierContracts />;
        case 'supplier/info':
          return <SupplierInfo />;
        case 'supplier/qualification':
          return <SupplierQualification />;
        case 'supplier/users':
          return <SupplierUsers />;
        case 'supplier/settlement':
        case 'supplier/invoice':
        case 'supplier/receivable':
          return <SupplierSettlement initialTab={activeTab.split('/')[1]} />;
        default:
          return (
            <div className="flex flex-col items-center justify-center py-40 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-orange-400">🚧</span>
              </div>
              <p className="text-lg font-bold text-slate-900">慧销云功能建设中</p>
              <p className="text-sm mt-1">该模块 (Path: {activeTab}) 正在开发...</p>
            </div>
          );
      }
    }

    // --- PURCHASER BACKEND ROUTES (智采云) ---
    
    if (activeTab.startsWith('suppliers')) {
      const subTab = activeTab.split('/')[1] || 'list';
      return <SupplierManagement initialTab={subTab} />;
    }

    if (activeTab.startsWith('projects')) {
      const subTab = activeTab.split('/')[1] || 'needs';
      return <ProjectManagement initialTab={subTab} />;
    }

    if (activeTab.startsWith('procurement')) {
      const subTab = activeTab.split('/')[1] || 'inquiry';
      return <ProcurementExecution initialTab={subTab} />;
    }

    if (activeTab.startsWith('collaboration')) {
      const subTab = activeTab.split('/')[1] || 'contracts';
      return <ProcurementCollaboration initialTab={subTab} />;
    }

    if (activeTab.startsWith('analytics')) {
      const subTab = activeTab.split('/')[1] || 'overview';
      return <Analytics initialTab={subTab} />;
    }

    if (activeTab.startsWith('system')) {
      const subTab = activeTab.split('/')[1] || 'org';
      return <SystemManagement initialTab={subTab} />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center py-40 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl font-bold">?</span>
            </div>
            <p className="text-lg font-bold text-slate-900">功能模块正在升级中</p>
            <p className="text-sm mt-1">该页面 (Path: {activeTab}) 正在进行前端工程化适配...</p>
          </div>
        );
    }
  };

  if (currentView === 'portal') {
    return <Portal onLogin={() => handleNavigate('login')} onNavigate={handleNavigate} />;
  }

  if (currentView === 'login' || currentView === 'register') {
    return <AuthPage view={currentView} onLoginSuccess={handleLoginSuccess} onNavigate={handleNavigate} />;
  }

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onLogout={handleLogout}
      userRole={userRole}
      onSwitchRole={handleSwitchRole}
    >
      {renderSystemContent()}
    </Layout>
  );
};

export default App;
