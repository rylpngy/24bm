
import React, { useState, useEffect } from 'react';
import { 
  Search, ArrowRight, UserCircle, LogIn, ChevronRight, 
  Megaphone, FileText, ShieldCheck, Users, Globe, 
  Building2, Phone, Mail, MapPin, Award, BarChart3,
  CheckCircle2, Clock, Database, Zap, LayoutGrid, Trophy,
  Cpu, Truck, Wrench, Filter, Download, ChevronLeft,
  HelpCircle, BookOpen, AlertCircle, CheckSquare, FileCheck,
  ShoppingBag, Star, Store, Monitor, Gift, Settings2, Lock,
  Gavel, Menu, Book, Wallet, PieChart, TrendingUp
} from 'lucide-react';

interface PortalProps {
  onLogin: () => void;
  onNavigate?: (page: 'portal' | 'login' | 'register' | 'system') => void;
}

// --- Mock Data ---
const MOCK_NOTICES = [
  { id: 'N001', mode: 'bidding', tag: '公开招标', type: '货物', title: '集团2024年度核心机房服务器集群扩容项目招标公告', date: '2023-11-02', region: '上海', budget: '500万', status: '报名中', dept: '信息技术部' },
  { id: 'N002', mode: 'inquiry', tag: '询价采购', type: '服务', title: 'Q4季度行政办公用品及耗材集中采购询价函', date: '2023-11-01', region: '北京', budget: '80万', status: '进行中', dept: '行政部' },
  { id: 'N003', mode: 'bidding', tag: '中标公示', type: '工程', title: '生产基地自动化流水线改造项目中标结果公示', date: '2023-10-30', region: '江苏', budget: '1200万', status: '已公示', dept: '生产技术部' },
  { id: 'N004', mode: 'bidding', tag: '供应商招募', type: '服务', title: '关于征集2024年度物流运输服务合作伙伴的公告', date: '2023-10-28', region: '全国', budget: '公开', status: '长期', dept: '供应链管理部' },
  { id: 'N005', mode: 'bidding', tag: '变更公告', type: '工程', title: '三号车间安防监控系统采购项目延期开标通知', date: '2023-10-25', region: '浙江', budget: '-', status: '公告', dept: '安环部' },
  { id: 'N006', mode: 'bidding', tag: '竞价公告', type: '货物', title: '废旧钢材及边角料年度回收处置竞价交易', date: '2023-10-24', region: '广东', budget: '竞价', status: '报名结束', dept: '资产管理部' },
  { id: 'N007', mode: 'inquiry', tag: '单一来源', type: '服务', title: 'SAP ERP系统年度维保服务单一来源采购公示', date: '2023-10-22', region: '上海', budget: '200万', status: '公示中', dept: '信息技术部' },
  { id: 'N008', mode: 'inquiry', tag: '询价采购', type: '货物', title: '员工食堂端午节礼盒（粽子/咸蛋）专项采购', date: '2023-10-20', region: '全国', budget: '50万', status: '已截标', dept: '人力资源部' },
];

const MOCK_BUYERS = [
  { name: '中国建筑', industry: '建筑工程', logo: 'CS' },
  { name: '吉利控股', industry: '汽车制造', logo: 'GL' },
  { name: '美的集团', industry: '家电制造', logo: 'MD' },
  { name: '万科集团', industry: '房地产', logo: 'VK' },
  { name: '三一重工', industry: '机械制造', logo: 'SY' },
  { name: '立讯精密', industry: '电子制造', logo: 'LX' },
];

const MOCK_SUPPLIERS = [
  { name: '震坤行工业超市', cat: 'MRO工业品', level: '战略级', logo: 'ZK' },
  { name: '京东企业购', cat: '综合物资', level: '战略级', logo: 'JD' },
  { name: '施耐德电气', cat: '电气设备', level: '核心级', logo: 'SE' },
  { name: '顺丰速运', cat: '物流服务', level: '核心级', logo: 'SF' },
  { name: '晨光科力普', cat: '办公用品', level: '优选级', logo: 'MG' },
  { name: '宝钢股份', cat: '原材料', level: '战略级', logo: 'BS' },
];

// --- Documentation Data ---
const DOC_CONTENT = {
  purchaser: {
    title: "智采云 - 采购人端操作手册",
    desc: "企业采购全流程数字化管理指南",
    sections: [
      {
        id: "p-1",
        title: "1. 产品概述",
        content: (
          <div className="space-y-4">
            <p className="leading-relaxed text-slate-600">
              <strong>智采云</strong> 是面向中大型民营企业的数字化采购管理平台。系统覆盖从需求管理、寻源招标、合同履约到对账付款的采购全生命周期（Source-to-Pay），旨在通过AI技术实现降本增效、合规风控与数据决策。
            </p>
          </div>
        )
      },
      {
        id: "p-2",
        title: "2. 核心功能模块",
        subsections: [
          {
            title: "2.1 控制面板 (Dashboard)",
            content: (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900 bg-slate-50 p-2 rounded-lg inline-block">功能定位：管理者的驾驶舱，全局监控采购业务健康度。</p>
                <ul className="list-none space-y-2 text-slate-600 text-sm mt-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-100 text-blue-700 p-1 rounded"><BarChart3 size={14} /></span>
                    <div><strong>关键指标 (KPIs)</strong>：实时展示年度累计支出、活跃供应商数量、进行中项目数及累计节约成本金额。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-purple-100 text-purple-700 p-1 rounded"><TrendingUp size={14} /></span>
                    <div><strong>趋势分析</strong>：可视化图表展示近6个月的采购支出趋势，对比预算与实际支出，识别异常波动。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-green-100 text-green-700 p-1 rounded"><Zap size={14} /></span>
                    <div><strong>快捷入口</strong>：提供发起立项、智能寻源、订单跟踪、数据分析等高频功能的一键直达入口。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-red-100 text-red-700 p-1 rounded"><AlertCircle size={14} /></span>
                    <div><strong>待办与预警</strong>：聚合展示待处理的审批任务（如供应商入驻、合同签署）及风险预警（如供应商资质过期、合同临期）。</div>
                  </li>
                </ul>
              </div>
            )
          },
          {
            title: "2.2 供应商管理 (SRM)",
            content: (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900 bg-slate-50 p-2 rounded-lg inline-block">功能定位：建立全生命周期的供应商管理体系。</p>
                <ul className="list-none space-y-2 text-slate-600 text-sm mt-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-indigo-100 text-indigo-700 p-1 rounded"><Globe size={14} /></span>
                    <div><strong>智能寻源</strong>：利用 AI 助手基于自然语言描述或需求文件，分析物资类别（货物/工程/服务），支持全网寻源（对接工商大数据）与库内寻源。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-100 text-blue-700 p-1 rounded"><Database size={14} /></span>
                    <div><strong>供应商库</strong>：分级管理供应商档案（注册/潜在/合格/淘汰），建立包含基本信息、资质证书、供货记录的360°绩效画像。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-orange-100 text-orange-700 p-1 rounded"><ShieldCheck size={14} /></span>
                    <div><strong>智能审批</strong>：处理供应商入驻、信息变更及违规申斥流程。<strong>AI 智能审计</strong>功能自动核验工商一致性、经营异常名录及法律诉讼风险，输出合规评分。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-green-100 text-green-700 p-1 rounded"><Wallet size={14} /></span>
                    <div><strong>费用管理</strong>：管理供应商年费、投标保证金的缴纳记录、退还状态及催缴通知。</div>
                  </li>
                </ul>
              </div>
            )
          },
          {
            title: "2.3 项目管理 (PM)",
            content: (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900 bg-slate-50 p-2 rounded-lg inline-block">功能定位：采购需求的收集与立项策划。</p>
                <ul className="list-none space-y-2 text-slate-600 text-sm mt-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-cyan-100 text-cyan-700 p-1 rounded"><FileText size={14} /></span>
                    <div><strong>采购需求</strong>：汇总各部门（HR、IT、生产等）提交的原始需求单。<strong>智能合并</strong>功能可自动分析同类物资，建议打包采购以发挥规模效应。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-teal-100 text-teal-700 p-1 rounded"><Settings2 size={14} /></span>
                    <div><strong>采购方案</strong>：制定详细采购计划（预算、物资明细、采购方式）。内置 <strong>AI 风险雷达</strong>，扫描方案合规性（如拆单规避招标、单一来源理由不足）。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-slate-100 text-slate-700 p-1 rounded"><CheckSquare size={14} /></span>
                    <div><strong>项目档案</strong>：对已完结项目进行全套电子档案归档，支持按时间、部门、项目类型快速检索与调阅。</div>
                  </li>
                </ul>
              </div>
            )
          },
          {
            title: "2.4 采购执行",
            content: (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900 bg-slate-50 p-2 rounded-lg inline-block">功能定位：多种采购模式的线上实施。</p>
                <ul className="list-none space-y-2 text-slate-600 text-sm mt-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-100 text-blue-700 p-1 rounded"><Megaphone size={14} /></span>
                    <div><strong>询比采购 (RFQ)</strong>：支持创建询价单、邀请指定供应商、多轮在线比价。AI 辅助生成决标分析报告（包含TCO总成本分析、商务条款对比）。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-purple-100 text-purple-700 p-1 rounded"><Gavel size={14} /></span>
                    <div><strong>竞价采购 (Bidding)</strong>：适用于标准品的公开招标或即时反向竞价，支持资格预审、保证金管理及实时竞价大厅功能。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-orange-100 text-orange-700 p-1 rounded"><Store size={14} /></span>
                    <div><strong>企业商城 (Mall)</strong>：聚合京东企业购、震坤行等 B2B 电商资源，为长尾物资提供类似 C 端购物体验的协议价直采服务。</div>
                  </li>
                </ul>
              </div>
            )
          },
          {
            title: "2.5 采购协同",
            content: (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900 bg-slate-50 p-2 rounded-lg inline-block">功能定位：交易履约过程的双方协作。</p>
                <ul className="list-none space-y-2 text-slate-600 text-sm mt-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-red-100 text-red-700 p-1 rounded"><FileCheck size={14} /></span>
                    <div><strong>合同管理</strong>：支持电子合同的在线起草、法务审核、供应商签署及归档，具备全链路寻源追溯功能。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-yellow-100 text-yellow-700 p-1 rounded"><Truck size={14} /></span>
                    <div><strong>订单管理 (PO)</strong>：采购订单下达、状态跟踪（待确认/生产中/已发货）、物流轨迹查询及收货验收。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-green-100 text-green-700 p-1 rounded"><Cpu size={14} /></span>
                    <div><strong>财务管理</strong>：实现<strong>三单匹配</strong>（采购订单、入库单、发票）自动校验，管理发票录入与验真，发起付款申请流程。</div>
                  </li>
                </ul>
              </div>
            )
          },
          {
            title: "2.6 系统管理与数据",
            content: (
              <div className="space-y-3">
                <ul className="list-none space-y-2 text-slate-600 text-sm mt-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-slate-200 text-slate-700 p-1 rounded"><PieChart size={14} /></span>
                    <div><strong>数据分析</strong>：提供多维度支出分析报表（按部门/品类/时间），监控物资价格异动，生成供应商绩效排名。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-slate-200 text-slate-700 p-1 rounded"><Settings2 size={14} /></span>
                    <div><strong>基础设置</strong>：配置企业组织架构（部门/人员）、角色权限、审批工作流及物料主数据管理。</div>
                  </li>
                </ul>
              </div>
            )
          }
        ]
      }
    ]
  },
  supplier: {
    title: "慧销云 - 供应商端操作手册",
    desc: "供应商协同工作台使用指南",
    sections: [
      {
        id: "s-1",
        title: "1. 产品概述",
        content: (
          <p className="leading-relaxed text-slate-600">
            <strong>慧销云</strong> 是连接供应商与采购商的数字化桥梁。供应商通过该平台可以获取一手商机、高效响应报价、管理销售订单与合同，并实时掌握回款进度，实现与核心企业的无缝对接。
          </p>
        )
      },
      {
        id: "s-2",
        title: "2. 核心功能模块",
        subsections: [
          {
            title: "2.1 生意概览 (Dashboard)",
            content: (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900 bg-slate-50 p-2 rounded-lg inline-block">功能定位：销售工作台，聚焦商机与任务。</p>
                <ul className="list-none space-y-2 text-slate-600 text-sm mt-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-orange-100 text-orange-700 p-1 rounded"><BarChart3 size={14} /></span>
                    <div><strong>销售漏斗</strong>：可视化展示本月销售额、近期投标中标率、待处理订单数等核心经营数据。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-red-100 text-red-700 p-1 rounded"><Clock size={14} /></span>
                    <div><strong>待办事项</strong>：按优先级展示需立即处理的任务，如报价截止提醒、订单发货要求、资质即将过期预警。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-100 text-blue-700 p-1 rounded"><TrendingUp size={14} /></span>
                    <div><strong>销售趋势</strong>：基于历史数据的销售业绩增长曲线图表，辅助经营决策。</div>
                  </li>
                </ul>
              </div>
            )
          },
          {
            title: "2.2 商机大厅",
            content: (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900 bg-slate-50 p-2 rounded-lg inline-block">功能定位：获取新业务的流量入口。</p>
                <ul className="list-none space-y-2 text-slate-600 text-sm mt-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-purple-100 text-purple-700 p-1 rounded"><Search size={14} /></span>
                    <div><strong>商机发现</strong>：聚合平台发布的公开招标公告与询价邀请，覆盖多种物资品类。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-100 text-blue-700 p-1 rounded"><Filter size={14} /></span>
                    <div><strong>智能筛选</strong>：支持按地区、品类、采购模式（招标/询价）快速筛选匹配的商机。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-green-100 text-green-700 p-1 rounded"><CheckCircle2 size={14} /></span>
                    <div><strong>参与响应</strong>：查看项目详情（采购清单、资质要求）及流程时间轴，一键报名参与或进行报价。</div>
                  </li>
                </ul>
              </div>
            )
          },
          {
            title: "2.3 销售与报价",
            content: (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900 bg-slate-50 p-2 rounded-lg inline-block">功能定位：参与竞标与报价全流程。</p>
                <ul className="list-none space-y-2 text-slate-600 text-sm mt-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-indigo-100 text-indigo-700 p-1 rounded"><Gavel size={14} /></span>
                    <div><strong>我的投标</strong>：管理所有参与的投标项目，实时跟踪状态（投标中/评标/中标/未中标），查看开标结果与评分。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-orange-100 text-orange-700 p-1 rounded"><Cpu size={14} /></span>
                    <div><strong>询价回复</strong>：在线填写报价单，支持设置阶梯价、税率、承诺交期及备注说明。系统自动计算含税总额，支持上传正式盖章报价文件。</div>
                  </li>
                </ul>
              </div>
            )
          },
          {
            title: "2.4 交付与履约",
            content: (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900 bg-slate-50 p-2 rounded-lg inline-block">功能定位：订单处理与物流发货。</p>
                <ul className="list-none space-y-2 text-slate-600 text-sm mt-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-100 text-blue-700 p-1 rounded"><ShoppingBag size={14} /></span>
                    <div><strong>销售订单</strong>：查看客户下达的采购订单（PO）详情，进行接单确认。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-yellow-100 text-yellow-700 p-1 rounded"><Truck size={14} /></span>
                    <div><strong>发货管理</strong>：填写物流信息（承运商、单号），支持批量发货操作，在线打印电子面单与送货单，实时跟踪物流轨迹。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-red-100 text-red-700 p-1 rounded"><FileText size={14} /></span>
                    <div><strong>销售合同</strong>：在线预览合同草稿，完成电子签章签署，查看已归档合同。</div>
                  </li>
                </ul>
              </div>
            )
          },
          {
            title: "2.5 资金与结算",
            content: (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900 bg-slate-50 p-2 rounded-lg inline-block">功能定位：对账与回款管理。</p>
                <ul className="list-none space-y-2 text-slate-600 text-sm mt-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-emerald-100 text-emerald-700 p-1 rounded"><CheckSquare size={14} /></span>
                    <div><strong>对账单</strong>：在线确认客户发起的月度/季度对账单，处理账务异议。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-cyan-100 text-cyan-700 p-1 rounded"><FileText size={14} /></span>
                    <div><strong>发票管理</strong>：查看待开票金额，上传发票信息及电子扫描件，跟踪发票认证状态。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-green-100 text-green-700 p-1 rounded"><Wallet size={14} /></span>
                    <div><strong>应收账款</strong>：监控每笔款项的应付日期与回款进度，查看催款记录与资金流水详情。</div>
                  </li>
                </ul>
              </div>
            )
          },
          {
            title: "2.6 企业中心",
            content: (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900 bg-slate-50 p-2 rounded-lg inline-block">功能定位：维护企业信用画像。</p>
                <ul className="list-none space-y-2 text-slate-600 text-sm mt-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-slate-200 text-slate-700 p-1 rounded"><Building2 size={14} /></span>
                    <div><strong>企业档案</strong>：维护工商信息、联系方式、银行账户（支持变更申请与审核流程）。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-slate-200 text-slate-700 p-1 rounded"><Award size={14} /></span>
                    <div><strong>资质认证</strong>：上传/更新营业执照、ISO 证书、行业许可证。系统自动提醒即将过期的证书。</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-slate-200 text-slate-700 p-1 rounded"><Users size={14} /></span>
                    <div><strong>员工管理</strong>：管理企业内部子账号（销售、财务、客服等）及权限分配。</div>
                  </li>
                </ul>
              </div>
            )
          }
        ]
      }
    ]
  }
};

// --- Sub-Components ---

const HomeView: React.FC<{ onNavigate: (page: string, id?: string) => void, onAuthAction: (action: 'login' | 'register') => void }> = ({ onNavigate, onAuthAction }) => (
  <>
    {/* Hero Section */}
    <header className="relative overflow-hidden bg-slate-900 text-white pt-24 pb-32">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center opacity-10"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent"></div>
        
        <div className="relative max-w-7xl mx-auto px-6 text-center z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-8 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
            <ShieldCheck size={14} /> 连接 10万+ 采购商与 500万+ 供应商
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            数据驱动的<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">智慧供应链生态</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            智采云大平台，汇聚千亿级采购需求。
            <br className="hidden md:block"/>让寻源更智能，让交易更透明，让决策更科学。
          </p>
          
          <div className="max-w-3xl mx-auto bg-white/5 p-2 rounded-2xl backdrop-blur-md border border-white/10 flex animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 shadow-2xl">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="请输入采购品目、项目名称或供应商关键词..." 
                className="w-full bg-transparent border-none text-white placeholder-slate-400 pl-12 pr-4 py-4 outline-none font-medium"
              />
            </div>
            <button 
              onClick={() => onNavigate('business')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shrink-0"
            >
              搜商机
            </button>
          </div>
          
          <div className="mt-8 flex justify-center gap-8 text-xs font-bold text-slate-500 animate-in fade-in duration-1000 delay-500">
             <span>热门搜索：</span>
             <button className="hover:text-blue-400 transition-colors">服务器设备</button>
             <button className="hover:text-blue-400 transition-colors">办公家具</button>
             <button className="hover:text-blue-400 transition-colors">物流运输</button>
             <button className="hover:text-blue-400 transition-colors">绿化工程</button>
             <button className="hover:text-blue-400 transition-colors">SaaS软件</button>
          </div>
        </div>
    </header>

    {/* Platform Introduction (New Section) */}
    <section className="py-20 bg-white relative z-20 -mt-10 rounded-t-[3rem]">
         <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
               <h2 className="text-3xl font-black text-slate-900 mb-4">智采云平台生态</h2>
               <p className="text-slate-500 max-w-2xl mx-auto">打破企业围墙，构建开放、协同、共赢的产业互联网基础设施</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
               <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 text-center">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                     <Building2 size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">对于采购商</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                     一站式数字化采购工作台。聚合海量优质供应商资源，实现阳光采购，显著降低采购成本，提升供应链韧性。
                  </p>
               </div>
               <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 text-center">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                     <Store size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">对于供应商</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                     无限商机流量入口。公平参与大型企业招标竞价，降低获客成本，通过履约积累信用资产，获得供应链金融支持。
                  </p>
               </div>
               <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 text-center">
                  <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                     <Cpu size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">智能大数据</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                     全产业链数据赋能。提供价格指数、风险预警、行业报告等数据服务，助力企业洞察市场趋势，科学决策。
                  </p>
               </div>
            </div>
         </div>
    </section>

    {/* Buyers Showcase (New Section) */}
    <section className="py-20 bg-slate-50">
       <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
             <div>
                <h2 className="text-3xl font-black text-slate-900 mb-2 flex items-center gap-3">
                   <Building2 className="text-blue-600" size={32} /> 入驻采购业主
                </h2>
                <p className="text-slate-500">世界 500 强及行业龙头企业都在使用智采云</p>
             </div>
             <button onClick={() => onAuthAction('register')} className="text-blue-600 font-bold flex items-center gap-2 hover:underline">
                我是采购商，立即入驻 <ArrowRight size={16} />
             </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
             {MOCK_BUYERS.map((b, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 text-center hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group">
                   <div className="w-14 h-14 mx-auto bg-gradient-to-br from-slate-700 to-slate-900 text-white rounded-xl flex items-center justify-center font-black text-lg mb-4 shadow-md group-hover:scale-110 transition-transform">
                      {b.logo}
                   </div>
                   <p className="font-bold text-slate-900 truncate">{b.name}</p>
                   <p className="text-xs text-slate-400 mt-1">{b.industry}</p>
                </div>
             ))}
          </div>
       </div>
    </section>

    {/* Business Hall Snippet (Updated) */}
    <section className="py-20 bg-white">
         <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
               <div>
                  <h2 className="text-3xl font-black text-slate-900 mb-2 flex items-center gap-3">
                     <Megaphone className="text-blue-600" size={32} /> 最新商机
                  </h2>
                  <p className="text-slate-500">实时更新全国各行业采购需求与中标公示</p>
               </div>
               <button onClick={() => onNavigate('business')} className="text-blue-600 font-bold flex items-center gap-2 hover:underline">
                  进入商机大厅 <ArrowRight size={16} />
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {MOCK_NOTICES.slice(0, 6).map((n, i) => (
                  <div key={i} onClick={() => onNavigate('detail', n.id)} className="bg-white border border-slate-200 p-6 rounded-2xl hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group flex flex-col h-full">
                     <div className="flex items-center gap-2 mb-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                           n.mode === 'bidding' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                           'bg-blue-50 text-blue-600 border-blue-100'
                        }`}>
                           {n.mode === 'bidding' ? '招标竞价' : '询价采购'}
                        </span>
                        <span className="text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-100 rounded">{n.type}</span>
                     </div>
                     <h4 className="font-bold text-slate-900 mb-4 line-clamp-2 flex-1 group-hover:text-blue-600 transition-colors">{n.title}</h4>
                     <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-50">
                        <span className="flex items-center gap-1 font-bold text-slate-700"><Building2 size={12}/> {n.dept}</span>
                        <span className="flex items-center gap-1"><Clock size={12}/> {n.date}</span>
                     </div>
                  </div>
               ))}
            </div>
         </div>
    </section>

    {/* Supplier Showcase */}
    <section className="py-20 bg-slate-50">
       <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
             <div>
                <h2 className="text-3xl font-black text-slate-900 mb-2 flex items-center gap-3">
                   <Store className="text-blue-600" size={32} /> 优质供应商
                </h2>
                <p className="text-slate-500">平台认证的行业标杆供应商展示</p>
             </div>
             <button onClick={() => onAuthAction('register')} className="text-blue-600 font-bold flex items-center gap-2 hover:underline">
                我是供应商，申请入驻 <ArrowRight size={16} />
             </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
             {MOCK_SUPPLIERS.map((s, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 text-center hover:shadow-md transition-all cursor-pointer">
                   <div className="w-12 h-12 mx-auto bg-slate-900 text-white rounded-full flex items-center justify-center font-black text-xs mb-3">
                      {s.logo}
                   </div>
                   <p className="font-bold text-sm text-slate-900 truncate">{s.name}</p>
                   <p className="text-xs text-slate-400 mt-1">{s.cat}</p>
                </div>
             ))}
          </div>
          
          <div className="mt-12 bg-blue-600 rounded-3xl p-10 text-white text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
             <h3 className="text-3xl font-black mb-4 relative z-10">加入智采云大平台</h3>
             <p className="mb-8 text-blue-100 max-w-xl mx-auto relative z-10">
                无论是寻找优质货源，还是拓展销售渠道，智采云都是您值得信赖的合作伙伴。
             </p>
             <button onClick={() => onAuthAction('register')} className="bg-white text-blue-600 px-8 py-3 rounded-xl font-bold hover:bg-blue-50 transition-all relative z-10">
                立即免费注册
             </button>
          </div>
       </div>
    </section>
  </>
);

// --- Documentation Viewer (New) ---
const DocumentationView: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'purchaser' | 'supplier'>('purchaser');
  const [activeSectionId, setActiveSectionId] = useState('p-1');

  const content = DOC_CONTENT[activeTab];

  const handleTabChange = (tab: 'purchaser' | 'supplier') => {
    setActiveTab(tab);
    setActiveSectionId(tab === 'purchaser' ? 'p-1' : 's-1');
    window.scrollTo(0, 0);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSectionId(id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
           <div>
              <div className="flex items-center gap-3 mb-2">
                 <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <BookOpen size={20} />
                 </div>
                 <h1 className="text-2xl font-black text-slate-900">产品帮助文档</h1>
              </div>
              <p className="text-slate-500">智采云平台操作手册与功能指南</p>
           </div>
           
           <div className="flex bg-slate-100 p-1.5 rounded-xl">
              <button 
                onClick={() => handleTabChange('purchaser')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'purchaser' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Building2 size={16} /> 智采云 (采购方)
              </button>
              <button 
                onClick={() => handleTabChange('supplier')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'supplier' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Store size={16} /> 慧销云 (供应商)
              </button>
           </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
           {/* Sidebar Table of Contents */}
           <div className="lg:w-72 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                 <Menu size={16} className="text-slate-400" /> 目录导航
              </h3>
              <div className="space-y-1">
                 {content.sections.map((section: any) => (
                    <div key={section.id}>
                       <button 
                          onClick={() => scrollToSection(section.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-colors truncate ${
                             activeSectionId === section.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                       >
                          {section.title}
                       </button>
                       {section.subsections && (
                          <div className="pl-4 mt-1 space-y-1 border-l-2 border-slate-100 ml-3">
                             {section.subsections.map((sub: any, idx: number) => (
                                <button 
                                   key={idx}
                                   className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors truncate"
                                >
                                   {sub.title.split(' ')[0]}
                                </button>
                             ))}
                          </div>
                       )}
                    </div>
                 ))}
              </div>
              <div className="mt-8 pt-6 border-t border-slate-100">
                 <button className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                    <Download size={14} /> 下载 PDF 手册
                 </button>
              </div>
           </div>

           {/* Main Content Area */}
           <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm">
                 <div className="border-b border-slate-100 pb-8 mb-8">
                    <h2 className="text-3xl font-black text-slate-900 mb-4">{content.title}</h2>
                    <p className="text-lg text-slate-500">{content.desc}</p>
                 </div>

                 <div className="prose prose-slate max-w-none">
                    {content.sections.map((section: any) => (
                       <div key={section.id} id={section.id} className="scroll-mt-32 mb-12 last:mb-0">
                          <h3 className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-100 flex items-center gap-2">
                             <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
                             {section.title}
                          </h3>
                          
                          {section.content && <div className="text-slate-600 leading-8 mb-6">{section.content}</div>}

                          {section.subsections && (
                             <div className="grid grid-cols-1 gap-6 mt-6">
                                {section.subsections.map((sub: any, idx: number) => (
                                   <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 hover:border-blue-200 transition-colors shadow-sm">
                                      <h4 className="font-bold text-slate-900 mb-3 text-lg flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                        {sub.title}
                                      </h4>
                                      <div className="text-slate-600 text-sm leading-relaxed pl-3.5">{sub.content}</div>
                                   </div>
                                ))}
                             </div>
                          )}
                       </div>
                    ))}
                 </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
                 <p className="text-blue-800 font-bold mb-2">未找到您需要的答案？</p>
                 <p className="text-blue-600 text-sm mb-4">我们的客服团队 7x24 小时为您提供支持</p>
                 <button className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-md">
                    联系在线客服
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

// ... BusinessHallView, MallPreviewView, NoticeDetailView, RegisterView ...
// (Keeping existing components but ensuring DocumentationView is used in Portal)

const BusinessHallView: React.FC<{ onNavigate: (page: string, id?: string) => void }> = ({ onNavigate }) => {
  // ... (Existing implementation)
  const [procurementMode, setProcurementMode] = useState<'all' | 'inquiry' | 'bidding'>('all');
  const [filterType, setFilterType] = useState('全部');
  
  const filteredNotices = MOCK_NOTICES.filter(n => {
     const matchMode = procurementMode === 'all' || n.mode === procurementMode;
     const matchType = filterType === '全部' || n.type === filterType.replace('类', '');
     return matchMode && matchType;
  });

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-20">
       <div className="max-w-7xl mx-auto px-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 mb-8">
             <h1 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <LayoutGrid size={32} className="text-blue-600" /> 商机大厅
             </h1>
             
             {/* Mode Tabs */}
             <div className="flex p-1 bg-slate-100 rounded-xl w-fit mb-6">
                <button 
                   onClick={() => setProcurementMode('all')}
                   className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${procurementMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                   全部商机
                </button>
                <button 
                   onClick={() => setProcurementMode('inquiry')}
                   className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${procurementMode === 'inquiry' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                   <Megaphone size={16} /> 询价采购
                </button>
                <button 
                   onClick={() => setProcurementMode('bidding')}
                   className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${procurementMode === 'bidding' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                   <Gavel size={16} /> 招标竞价
                </button>
             </div>

             <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                   <input 
                     type="text" 
                     placeholder="搜索项目名称、采购编号..." 
                     className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                   />
                </div>
                <button className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all">
                   搜索
                </button>
             </div>
             
             <div className="mt-6 flex flex-wrap gap-2">
                <span className="text-sm font-bold text-slate-400 py-2 mr-2">物资分类:</span>
                {['全部', '货物类', '工程类', '服务类'].map(t => (
                   <button 
                     key={t}
                     onClick={() => setFilterType(t)}
                     className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === t ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                   >
                      {t}
                   </button>
                ))}
             </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="divide-y divide-slate-100">
                {filteredNotices.map((n, i) => (
                   <div key={i} onClick={() => onNavigate('detail', n.id)} className="p-6 flex items-center justify-between hover:bg-blue-50/50 transition-colors cursor-pointer group">
                      <div className="flex-1">
                         <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${
                               n.mode === 'bidding' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                               {n.tag}
                            </span>
                            <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{n.title}</h3>
                         </div>
                         <div className="flex items-center gap-6 text-sm text-slate-500">
                            <span className="flex items-center gap-1"><Building2 size={14} /> {n.dept}</span>
                            <span className="flex items-center gap-1"><MapPin size={14} /> {n.region}</span>
                            <span className="flex items-center gap-1"><Clock size={14} /> 发布于 {n.date}</span>
                         </div>
                      </div>
                      <div className="text-right pl-6">
                         <p className="text-sm text-slate-400 mb-1">预算金额</p>
                         <p className="text-xl font-black text-slate-900">{n.budget}</p>
                      </div>
                      <div className="ml-8">
                         <button className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                            <ArrowRight size={20} />
                         </button>
                      </div>
                   </div>
                ))}
                {filteredNotices.length === 0 && (
                   <div className="p-20 text-center text-slate-400">
                      <Search size={48} className="mx-auto mb-4 opacity-20" />
                      <p>未找到符合条件的商机</p>
                   </div>
                )}
             </div>
             <div className="p-6 border-t border-slate-100 flex justify-center">
                <button className="px-6 py-2 bg-slate-50 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all">加载更多</button>
             </div>
          </div>
       </div>
    </div>
  );
};

const MallPreviewView: React.FC<{ onAuthAction: (action: 'login' | 'register') => void }> = ({ onAuthAction }) => {
   const categories = [
      { name: '办公用品', icon: FileText, count: '1,240+', color: 'text-blue-600', bg: 'bg-blue-50' },
      { name: 'IT 数码', icon: Monitor, count: '850+', color: 'text-purple-600', bg: 'bg-purple-50' },
      { name: 'MRO 工业品', icon: Wrench, count: '5,620+', color: 'text-orange-600', bg: 'bg-orange-50' },
      { name: '员工福利', icon: Gift, count: '320+', color: 'text-pink-600', bg: 'bg-pink-50' },
      { name: '定制加工', icon: Settings2, count: '定制询价', color: 'text-green-600', bg: 'bg-green-50' },
   ];

   const previewProducts = [
      { title: 'Apple MacBook Pro 14英寸 M3芯片 16G+512G 深空灰', img: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&q=80&w=400', supplier: '京东企业购' },
      { title: '得力(deli) A4复印纸 70g 整箱', img: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&q=80&w=400', supplier: '晨光科力普' },
      { title: '赫曼米勒 Aeron 人体工学椅', img: 'https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&q=80&w=400', supplier: '震旦家具' },
      { title: '戴尔 U2723QE 4K显示器', img: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=400', supplier: '京东企业购' },
      { title: '3M 9010CN 防护口罩 N95', img: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?auto=format&fit=crop&q=80&w=400', supplier: '震坤行' },
      { title: '罗技 MX Master 3S 鼠标', img: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&q=80&w=400', supplier: '京东企业购' },
      { title: '华为 MateBook X Pro 2024', img: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&q=80&w=400', supplier: '京东企业购' },
      { title: '绿联 100W 氮化镓充电器', img: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=400', supplier: '晨光科力普' },
   ];

   return (
      <div className="min-h-screen bg-slate-50 pt-24 pb-20">
         <div className="max-w-7xl mx-auto px-6">
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-[3rem] p-12 text-white text-center relative overflow-hidden mb-12 shadow-2xl">
               <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
               <div className="relative z-10">
                  <h1 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">智采云企业商城</h1>
                  <p className="text-lg text-blue-200 max-w-2xl mx-auto mb-10">
                     聚合京东、震坤行等顶级B2B电商平台，为企业提供协议价采购、统一结算、阳光透明的一站式物资采购体验。
                  </p>
                  <button onClick={() => onAuthAction('login')} className="bg-white text-slate-900 px-8 py-3.5 rounded-full font-bold hover:bg-blue-50 transition-all shadow-lg flex items-center gap-2 mx-auto">
                     <Lock size={18} /> 登录查看企业专属价
                  </button>
               </div>
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-6">热门品类</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
               {categories.map((cat, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer group text-center h-40 flex flex-col items-center justify-center">
                     <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 transition-colors ${cat.bg}`}>
                        <cat.icon size={28} className={cat.color} />
                     </div>
                     <h3 className="font-bold text-slate-900">{cat.name}</h3>
                     <p className="text-xs text-slate-400 mt-1 font-medium">{cat.count}</p>
                  </div>
               ))}
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-6">精选商品</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
               {previewProducts.map((p, i) => (
                  <div key={i} className="bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all group flex flex-col relative">
                     <div className="h-56 bg-slate-100 relative overflow-hidden p-6 flex items-center justify-center">
                        <img src={p.img} alt={p.title} className="max-w-full max-h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500" />
                        
                        {/* Blur Overlay for Price */}
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                           <Lock size={32} className="text-white mb-2" />
                           <p className="text-white font-bold text-sm">登录查看价格</p>
                        </div>
                     </div>
                     <div className="p-6">
                        <div className="flex items-center gap-1.5 mb-2">
                           <Store size={14} className="text-blue-500" />
                           <span className="text-xs font-bold text-slate-500">{p.supplier}</span>
                        </div>
                        <h3 className="font-bold text-slate-900 leading-snug mb-4 line-clamp-2">{p.title}</h3>
                        <div className="flex items-center justify-between">
                           <div className="h-6 w-24 bg-slate-100 rounded-full animate-pulse"></div>
                           <button onClick={() => onAuthAction('login')} className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-blue-600 transition-colors">
                              <ArrowRight size={16} />
                           </button>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
   );
};

const NoticeDetailView: React.FC<{ onNavigate: (page: string) => void, onLogin: () => void, noticeId?: string }> = ({ onNavigate, onLogin, noticeId }) => {
  const notice = MOCK_NOTICES.find(n => n.id === noticeId) || MOCK_NOTICES[0];

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-20">
       <div className="max-w-7xl mx-auto px-6">
          <button onClick={() => onNavigate('business')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm mb-6 transition-colors">
             <ChevronLeft size={16} /> 返回大厅
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             {/* Main Content Column */}
             <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden p-8">
                    <div className="flex items-center gap-3 mb-4">
                       <span className={`px-3 py-1 text-white text-xs font-bold rounded-lg ${notice.mode === 'bidding' ? 'bg-purple-600' : 'bg-blue-600'}`}>{notice.tag}</span>
                       <span className="text-slate-500 text-sm font-bold">项目编号：{notice.id}</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-6 leading-tight">{notice.title}</h1>
                    
                    <div className="h-px bg-slate-100 my-6"></div>

                    <div className="text-slate-700 leading-relaxed space-y-8">
                        <div className="space-y-3">
                           <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                              <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span> 1. 采购条件
                           </h3>
                           <p className="text-sm">本采购项目已由上级主管部门批准建设，项目业主为智采云集团，建设资金来自自筹，项目出资比例为100%。项目已具备采购条件，现对该项目进行{notice.mode === 'bidding' ? '公开招标' : '询价采购'}。</p>
                        </div>
                        <div className="space-y-3">
                           <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                              <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span> 2. 项目概况与范围
                           </h3>
                           <p className="text-sm">2.1 项目地点：{notice.region}及甲方指定地点。</p>
                           <p className="text-sm">2.2 采购范围：本次采购内容包括但不限于核心设备的供货、运输、安装调试及售后服务等，具体详见招标文件第五章“供货要求”。</p>
                           <p className="text-sm">2.3 交货期：合同签订后 30 日历天内完成供货及安装调试。</p>
                        </div>
                        <div className="space-y-3">
                           <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                              <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span> 3. 供应商资格要求
                           </h3>
                           <p className="text-sm">3.1 本次采购要求供应商须具备独立法人资格，具有有效的营业执照。</p>
                           <p className="text-sm">3.2 财务要求：近三年无亏损。</p>
                           <p className="text-sm">3.3 业绩要求：近三年内具有类似项目业绩不少于 3 个。</p>
                        </div>
                        
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                           <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm"><FileText size={16} /> 相关附件下载</h4>
                           <div className="space-y-2">
                              <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-400 cursor-pointer transition-colors">
                                 <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-red-50 text-red-500 rounded flex items-center justify-center font-bold text-xs">PDF</div>
                                    <span className="text-sm font-bold text-slate-700">采购文件_技术规格书.pdf</span>
                                 </div>
                                 <Download size={16} className="text-slate-400" />
                              </div>
                           </div>
                        </div>
                    </div>
                </div>
             </div>

             {/* Sidebar Column */}
             <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sticky top-24">
                   <h3 className="font-bold text-slate-900 mb-6">项目关键信息</h3>
                   
                   <div className="space-y-6">
                      <div>
                         <p className="text-xs font-bold text-slate-400 uppercase mb-1">采购单位</p>
                         <div className="flex items-center gap-2 font-bold text-slate-900">
                            <Building2 size={18} className="text-blue-600"/> {notice.dept}
                         </div>
                      </div>
                      <div>
                         <p className="text-xs font-bold text-slate-400 uppercase mb-1">项目预算</p>
                         <div className="flex items-center gap-2 font-black text-2xl text-slate-900">
                            {notice.budget}
                         </div>
                      </div>
                      <div>
                         <p className="text-xs font-bold text-slate-400 uppercase mb-1">项目地点</p>
                         <div className="flex items-center gap-2 font-bold text-slate-900">
                            <MapPin size={18} className="text-slate-400"/> {notice.region}
                         </div>
                      </div>
                      <div>
                         <p className="text-xs font-bold text-slate-400 uppercase mb-1">发布时间</p>
                         <div className="flex items-center gap-2 font-bold text-slate-900">
                            <Clock size={18} className="text-slate-400"/> {notice.date}
                         </div>
                      </div>
                   </div>

                   <div className="h-px bg-slate-100 my-6"></div>

                   <div className="space-y-3">
                      <button onClick={onLogin} className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2">
                         <CheckCircle2 size={18} /> 立即报名
                      </button>
                      <button className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all">
                         电话咨询
                      </button>
                   </div>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

const RegisterView: React.FC<{ onNavigate: (page: string) => void, onLogin: () => void }> = ({ onNavigate, onLogin }) => {
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-20">
       <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
             <h1 className="text-3xl font-black text-slate-900">供应商入驻申请</h1>
             <p className="text-slate-500 mt-2">加入智采云生态，三步完成企业认证</p>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-200">
             {/* Stepper */}
             <div className="flex items-center justify-between mb-10 px-10 relative">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-100 -z-0 mx-20"></div>
                {[1, 2, 3].map(s => (
                   <div key={s} className="relative z-10 flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                         step >= s ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-2 border-slate-200 text-slate-300'
                      }`}>
                         {s}
                      </div>
                      <span className={`text-xs font-bold mt-2 ${step >= s ? 'text-blue-600' : 'text-slate-300'}`}>
                         {s === 1 ? '基本信息' : s === 2 ? '资质认证' : '提交审核'}
                      </span>
                   </div>
                ))}
             </div>

             {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-2">企业名称 <span className="text-red-500">*</span></label>
                         <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="请输入营业执照上的全称" />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-2">统一社会信用代码 <span className="text-red-500">*</span></label>
                         <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="18位信用代码" />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-2">联系人姓名 <span className="text-red-500">*</span></label>
                         <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-2">联系手机 <span className="text-red-500">*</span></label>
                         <input type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                   </div>
                   <button onClick={() => setStep(2)} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all mt-6">
                      下一步：资质认证
                   </button>
                </div>
             )}

             {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                   <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 flex items-start gap-3">
                      <ShieldCheck size={20} className="shrink-0 mt-0.5" />
                      <p>请上传清晰、有效的证件扫描件。支持 JPG, PNG, PDF 格式，单文件不超过 10MB。</p>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-400 hover:bg-slate-50 transition-all">
                         <FileText size={32} className="text-slate-300 mb-2" />
                         <span className="font-bold text-slate-600">上传营业执照</span>
                         <span className="text-xs text-slate-400 mt-1">(必填)</span>
                      </div>
                      <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-400 hover:bg-slate-50 transition-all">
                         <FileText size={32} className="text-slate-300 mb-2" />
                         <span className="font-bold text-slate-600">上传开户许可证</span>
                         <span className="text-xs text-slate-400 mt-1">(必填)</span>
                      </div>
                   </div>

                   <div className="flex gap-4 mt-6">
                      <button onClick={() => setStep(1)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all">上一步</button>
                      <button onClick={() => setStep(3)} className="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">提交申请</button>
                   </div>
                </div>
             )}

             {step === 3 && (
                <div className="text-center py-10 animate-in fade-in zoom-in duration-300">
                   <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 size={40} />
                   </div>
                   <h2 className="text-2xl font-black text-slate-900 mb-2">申请提交成功！</h2>
                   <p className="text-slate-500 max-w-sm mx-auto mb-8">
                      您的入驻申请已提交至平台审核，预计将在 1-3 个工作日内完成。审核结果将通过短信发送至您的联系手机。
                   </p>
                   <button onClick={onLogin} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all">
                      返回登录
                   </button>
                </div>
             )}
          </div>
       </div>
    </div>
  );
};

// --- Main Portal Container ---

const Portal: React.FC<PortalProps> = ({ onLogin, onNavigate: onAppNavigate }) => {
  const [activePage, setActivePage] = useState('home'); // home, business, mall, detail, register, help
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>();

  const handleNavigate = (page: string, id?: string) => {
    setActivePage(page);
    if (id) setSelectedNoticeId(id);
    window.scrollTo(0, 0);
  };

  const handleAuthNavigation = (action: 'login' | 'register') => {
    if (onAppNavigate) {
      onAppNavigate(action);
    } else {
      // Fallback for direct testing if App.tsx isn't updating properly yet
      onLogin(); 
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Universal Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigate('home')}>
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-blue-500/20">智</div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight leading-none text-slate-900">智采云</span>
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-0.5">Smart Procurement</span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-10 text-sm font-bold text-slate-600">
            <button onClick={() => handleNavigate('home')} className={`${activePage === 'home' ? 'text-blue-600' : 'hover:text-blue-600'} transition-colors`}>首页</button>
            <button onClick={() => handleNavigate('business')} className={`${activePage === 'business' || activePage === 'detail' ? 'text-blue-600' : 'hover:text-blue-600'} transition-colors`}>商机大厅</button>
            <button onClick={() => handleNavigate('mall')} className={`${activePage === 'mall' ? 'text-blue-600' : 'hover:text-blue-600'} transition-colors flex items-center gap-1`}><ShoppingBag size={14}/> 采购商城</button>
            <button onClick={() => handleNavigate('register')} className={`${activePage === 'register' ? 'text-blue-600' : 'hover:text-blue-600'} transition-colors`}>供应商入驻</button>
            <button onClick={() => handleNavigate('help')} className={`${activePage === 'help' ? 'text-blue-600' : 'hover:text-blue-600'} transition-colors`}>帮助中心</button>
          </div>

          <div className="flex items-center gap-4">
            <button className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600">
              <Globe size={16} /> CN
            </button>
            <button 
              onClick={() => handleAuthNavigation('login')}
              className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-blue-600 transition-all shadow-lg hover:shadow-blue-500/30"
            >
              <LogIn size={16} /> 登录 / 注册
            </button>
          </div>
        </div>
      </nav>

      {/* View Switcher */}
      <main>
         {activePage === 'home' && <HomeView onNavigate={handleNavigate} onAuthAction={handleAuthNavigation} />}
         {activePage === 'business' && <BusinessHallView onNavigate={handleNavigate} />}
         {activePage === 'mall' && <MallPreviewView onAuthAction={handleAuthNavigation} />}
         {activePage === 'detail' && <NoticeDetailView onNavigate={handleNavigate} onLogin={() => handleAuthNavigation('login')} noticeId={selectedNoticeId} />}
         {activePage === 'register' && <RegisterView onNavigate={handleNavigate} onLogin={() => handleAuthNavigation('login')} />}
         {activePage === 'help' && <DocumentationView onNavigate={handleNavigate} />}
      </main>

      {/* Universal Footer */}
      <footer className="bg-slate-900 text-white border-t border-slate-800 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-6">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
              <div className="col-span-1 md:col-span-1">
                 <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">智</div>
                    <span className="font-black text-xl">智采云平台</span>
                 </div>
                 <p className="text-slate-400 text-sm leading-relaxed">
                    面向未来的企业级智慧采购管理平台，致力于通过技术创新推动供应链数字化转型。
                 </p>
              </div>
              <div>
                 <h4 className="font-bold text-lg mb-6">产品服务</h4>
                 <ul className="space-y-4 text-sm text-slate-400">
                    <li><button onClick={() => handleNavigate('business')} className="hover:text-white transition-colors">商机大厅</button></li>
                    <li><button className="hover:text-white transition-colors">电子招投标</button></li>
                    <li><button onClick={() => handleNavigate('mall')} className="hover:text-white transition-colors">企业采购商城</button></li>
                 </ul>
              </div>
              <div>
                 <h4 className="font-bold text-lg mb-6">帮助支持</h4>
                 <ul className="space-y-4 text-sm text-slate-400">
                    <li><button onClick={() => handleNavigate('register')} className="hover:text-white transition-colors">供应商入驻指南</button></li>
                    <li><button className="hover:text-white transition-colors">采购商操作手册</button></li>
                    <li><button onClick={() => handleNavigate('help')} className="hover:text-white transition-colors">帮助中心</button></li>
                 </ul>
              </div>
              <div>
                 <h4 className="font-bold text-lg mb-6">联系我们</h4>
                 <ul className="space-y-4 text-sm text-slate-400">
                    <li className="flex items-center gap-3"><Phone size={16}/> 400-888-9999</li>
                    <li className="flex items-center gap-3"><Mail size={16}/> support@zhicaiyun.com</li>
                    <li className="flex items-start gap-3"><MapPin size={16} className="mt-1"/> 上海市浦东新区张江高科园区<br/>科苑路88号</li>
                 </ul>
              </div>
           </div>
           
           <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
              <p>© 2023 Zhicai Cloud Inc. All rights reserved.</p>
              <div className="flex gap-6">
                 <button className="hover:text-white">隐私政策</button>
                 <button className="hover:text-white">服务条款</button>
                 <button className="hover:text-white">沪ICP备12345678号</button>
              </div>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default Portal;
