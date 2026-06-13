
import React, { useState, useEffect } from 'react';
import { Download, Share2, Sparkles } from 'lucide-react';
import ProcurementOverview from './analytics/ProcurementOverview';
import PriceIndicators from './analytics/PriceIndicators';
import SpendAnalysis from './analytics/SpendAnalysis';

interface AnalyticsProps {
  initialTab?: string;
}

const Analytics: React.FC<AnalyticsProps> = ({ initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const getTitle = () => {
    switch (activeTab) {
      case 'overview': return '采购业务概览';
      case 'price': return '关键价格指标';
      case 'spend': return '采购支出分析';
      default: return '决策分析中心';
    }
  };

  const getSubtitle = () => {
    switch (activeTab) {
      case 'overview': return '全集团采购核心 KPI 监控与供应商排名';
      case 'price': return '核心物资市场价格对标与异动预警';
      case 'spend': return '多维度支出结构分析与降本洞察';
      default: return '基于全域采购业务数据的深度洞察';
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'price': return <PriceIndicators />;
      case 'spend': return <SpendAnalysis />;
      case 'overview':
      default: return <ProcurementOverview />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header (No Tabs) */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">{getTitle()}</h1>
          <p className="text-sm text-slate-500 mt-1">{getSubtitle()}</p>
        </div>
        
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
            <Download size={18} />
            <span className="hidden md:inline">导出报表</span>
          </button>
          <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800">
            <Share2 size={18} />
            <span className="hidden md:inline">分享看板</span>
          </button>
        </div>
      </div>

      {/* AI Insight Banner */}
      <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="flex gap-4 items-center">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">AI 采购助手洞察</h3>
            <p className="text-xs text-slate-600 mt-0.5">检测到 IT 类目下服务器内存采购成本较去年同期下降 14.3%，建议 IT 部适当增加备货量。</p>
          </div>
        </div>
        <button className="px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg text-xs font-bold hover:shadow-sm transition-all">
           生成决策报告
        </button>
      </div>

      {/* Content Area */}
      {renderContent()}
    </div>
  );
};

export default Analytics;
