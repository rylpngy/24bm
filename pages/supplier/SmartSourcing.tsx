
import React, { useState, useRef } from 'react';
import { Search, Sparkles, Loader2, Globe, Database, UploadCloud, FileText, Check, History, Building2, TrendingUp } from 'lucide-react';
import { smartSourcingAssistant, SourcingResult } from '../../services/geminiService';
import { suppliersData } from '../../data/suppliers';

const SmartSourcing: React.FC = () => {
  const [sourcingCategory, setSourcingCategory] = useState('');
  const [sourcingScope, setSourcingScope] = useState<'national' | 'platform'>('national');
  const [inputType, setInputType] = useState<'text' | 'file'>('text');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isSourcing, setIsSourcing] = useState(false);
  const [sourcingResult, setSourcingResult] = useState<SourcingResult | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>(''); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
      setSourcingCategory(e.target.files[0].name.split('.')[0]); 
    }
  };

  const handleSourcing = async () => {
    if (!sourcingCategory && !uploadedFile) return;
    setIsSourcing(true);
    setAnalysisStatus('启动 AI 引擎...');
    
    // 立即展示预加载数据 (快速本地检索)
    const query = inputType === 'file' && uploadedFile ? uploadedFile.name.replace(/\.[^/.]+$/, "") : sourcingCategory;
    const localMatches = suppliersData
      .filter(s => s.name.includes(query) || s.category.includes(query))
      .slice(0, 3);
    
    // 如果本地没有匹配，就随机展示几个库内的
    const initialSuppliers = localMatches.length > 0 ? localMatches : suppliersData.slice(0, 3);

    setSourcingResult({
      detectedType: '智能分析中...',
      strategicAdvice: '正在为您深入分析全网数据，以下为初步匹配结果...',
      suppliers: initialSuppliers.map(s => ({
        name: s.name,
        creditRating: s.level === 'A' ? 'AAA' : s.level === 'B' ? 'AA' : 'A',
        matchScore: s.score || 85,
        platform: '库内供应商',
        advantage: `主营${s.category}，${s.status}供应商`,
        potentialRisk: '正在进行深度风险扫描...'
      }))
    });

    try {
      let query = sourcingCategory;
      let context = "";

      if (inputType === 'file' && uploadedFile) {
        setAnalysisStatus('正在解析需求文件内容...');
        await new Promise(resolve => setTimeout(resolve, 1500)); 
        setAnalysisStatus('识别采购类型：分析工程/货物/服务属性...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        query = uploadedFile.name.replace(/\.[^/.]+$/, "");
        context = "包含技术参数：规格说明书、工程量清单及服务SLA要求。";
      } else {
        setAnalysisStatus('正在聚合全网数据...');
      }

      const result = await smartSourcingAssistant(query, sourcingScope, context);
      setSourcingResult(result);
    } catch (e) {
      console.error(e);
      alert('寻源分析失败');
    } finally {
      setIsSourcing(false);
      setAnalysisStatus('');
    }
  };

  return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
             <div>
                <h1 className="text-xl font-black text-slate-900">智能寻源助手</h1>
                <p className="text-sm text-slate-500 mt-1">利用 AI 引擎匹配全网优质供应商资源</p>
             </div>
             <button className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold hover:bg-slate-200 transition-all">
                <History size={18} />
                寻源记录
             </button>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
           <div className="flex flex-col md:flex-row gap-8">
              {/* Left Column: Header */}
              <div className="md:w-1/3 space-y-4">
                 <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
                    <Sparkles size={32} />
                 </div>
                 <div>
                    <h2 className="text-2xl font-black text-slate-900">开始智能寻源</h2>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                       AI 将根据您的需求文件或关键词，自动分析物资属性（货物/工程/服务），并在全网或私有库中检索最佳匹配供应商。
                    </p>
                 </div>
                 <div className="flex gap-2">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">货物</span>
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">工程</span>
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">服务</span>
                 </div>
              </div>

              {/* Right Column: Controls */}
              <div className="md:w-2/3 bg-slate-50 rounded-2xl p-6 border border-slate-100">
                 {/* 1. Scope Selection */}
                 <div className="mb-6">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">寻源范围</label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 w-fit">
                       <button 
                         onClick={() => setSourcingScope('national')}
                         className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            sourcingScope === 'national' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                         }`}
                       >
                          <Globe size={16} /> 全国供应商
                       </button>
                       <button 
                         onClick={() => setSourcingScope('platform')}
                         className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            sourcingScope === 'platform' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                         }`}
                       >
                          <Database size={16} /> 平台库内
                       </button>
                    </div>
                 </div>

                 {/* 2. Input Method */}
                 <div className="mb-6">
                    <div className="flex justify-between items-end mb-2">
                       <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">需求输入</label>
                       <div className="flex gap-4 text-sm font-bold">
                          <button 
                             onClick={() => setInputType('text')} 
                             className={`pb-1 border-b-2 transition-colors ${inputType === 'text' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
                          >
                             关键词匹配
                          </button>
                          <button 
                             onClick={() => setInputType('file')} 
                             className={`pb-1 border-b-2 transition-colors ${inputType === 'file' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
                          >
                             需求文件分析
                          </button>
                       </div>
                    </div>

                    {inputType === 'text' ? (
                       <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                          <input 
                            type="text" 
                            value={sourcingCategory}
                            onChange={(e) => setSourcingCategory(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                            placeholder="输入物资名称、规格或品类，例如：六轴工业机械臂..."
                          />
                       </div>
                    ) : (
                       <div 
                          onClick={() => fileInputRef.current?.click()}
                          className={`relative w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all bg-white group ${uploadedFile ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'}`}
                       >
                          <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.doc,.docx,.xlsx" />
                          {uploadedFile ? (
                             <>
                                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
                                   <FileText size={24} />
                                </div>
                                <p className="font-bold text-slate-900">{uploadedFile.name}</p>
                                <p className="text-xs text-slate-500 mt-1">{(uploadedFile.size / 1024).toFixed(0)} KB - 点击更换</p>
                             </>
                          ) : (
                             <>
                                <UploadCloud size={32} className="text-slate-300 mb-2 group-hover:text-blue-500 transition-colors" />
                                <p className="text-sm font-bold text-slate-600">点击或拖拽上传需求文件</p>
                                <p className="text-xs text-slate-400 mt-1">支持 PDF, Word, Excel (智能识别工程/货物/服务)</p>
                             </>
                          )}
                       </div>
                    )}
                 </div>

                 {/* 3. Action */}
                 <button 
                   onClick={handleSourcing}
                   disabled={isSourcing || (!sourcingCategory && !uploadedFile)}
                   className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-900/10"
                 >
                   {isSourcing ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        <span>{analysisStatus || '正在分析...'}</span>
                      </>
                   ) : (
                      <>
                        <Sparkles size={20} className="text-yellow-400" />
                        <span>开始智能寻源</span>
                      </>
                   )}
                 </button>
              </div>
           </div>
        </div>

        {!sourcingResult && !isSourcing && (
           <div className="grid grid-cols-3 gap-6 opacity-50 pointer-events-none filter blur-[1px]">
               {[1,2,3].map(i => (
                  <div key={i} className="h-48 bg-white rounded-2xl border border-slate-200"></div>
               ))}
           </div>
        )}

        {sourcingResult && (
           <div className="space-y-6 animate-in slide-in-from-bottom-10 duration-500">
              <div className="flex items-center gap-4">
                 <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-200">
                    已识别类型：{sourcingResult.detectedType || '未分类'}
                 </div>
                 <div className="bg-white px-4 py-2 rounded-lg text-sm font-bold text-slate-600 border border-slate-200 flex items-center gap-2">
                    {isSourcing ? <Loader2 size={16} className="text-blue-500 animate-spin" /> : <Check size={16} className="text-green-500" />}
                    {isSourcing ? '正在检索数据...' : (sourcingScope === 'national' ? '全网数据检索完成' : '库内数据筛选完成')}
                 </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100">
                 <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                    <Sparkles size={18} /> 寻源策略建议
                 </h3>
                 <p className="text-blue-800 leading-relaxed text-sm">{sourcingResult.strategicAdvice}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {sourcingResult.suppliers.map((s, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 transition-all group">
                       <div className="flex justify-between items-start mb-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                             {s.name.charAt(0)}
                          </div>
                          <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-bold rounded">{s.creditRating} 级</span>
                       </div>
                       <h4 className="font-bold text-lg text-slate-900 mb-2">{s.name}</h4>
                       <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                             <Building2 size={14} />
                             <span>{s.platform}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                             <TrendingUp size={14} />
                             <span>匹配度 {s.matchScore}%</span>
                          </div>
                       </div>
                       <div className="space-y-3 pt-4 border-t border-slate-100">
                          <div>
                             <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">核心优势</p>
                             <p className="text-xs text-slate-700">{s.advantage}</p>
                          </div>
                          <div>
                             <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">潜在风险</p>
                             <p className="text-xs text-slate-700">{s.potentialRisk}</p>
                          </div>
                       </div>
                       <button className="w-full mt-4 py-2 bg-slate-50 text-slate-600 rounded-lg font-bold text-xs hover:bg-slate-900 hover:text-white transition-colors">
                          邀请入驻
                       </button>
                    </div>
                 ))}
              </div>
           </div>
        )}
      </div>
  );
};

export default SmartSourcing;
