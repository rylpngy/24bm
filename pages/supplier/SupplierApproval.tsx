
import React, { useState } from 'react';
import { 
  ChevronLeft, CheckCircle2, XCircle, FileText, ArrowRight, History, 
  BrainCircuit, ScanLine, AlertTriangle, CheckSquare, Search, FileDiff,
  UserCheck, TrendingUp, ShieldCheck, Clock
} from 'lucide-react';
import { Loader2 } from 'lucide-react';

const SupplierApproval: React.FC = () => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isAiAuditing, setIsAiAuditing] = useState(false);

  const approvalTasks = [
    { id: 'AP-2023102801', type: '供应商入驻', supplier: '浙江明辉机电有限公司', submitter: '外部提交', date: '2023-10-28', status: '待初审', risk: '低', riskReason: '资质齐全' },
    { id: 'AP-2023102903', type: '信息变更', supplier: '杭州大和电子', submitter: '供应商发起', date: '2023-10-29', status: 'AI预警', risk: '中', riskReason: '收款账户变更' },
    { id: 'AP-2023103002', type: '违规申斥', supplier: '上海宏博贸易', submitter: '质检部-张工', date: '2023-10-30', status: '待裁决', risk: '高', riskReason: '连续质量不达标' },
    { id: 'AP-2023103105', type: '供应商入驻', supplier: '南京科创智能科技有限公司', submitter: '外部提交', date: '2023-10-31', status: '已通过', risk: '低', riskReason: '' },
    { id: 'AP-2023110101', type: '黑名单申诉', supplier: '无锡恒润科技', submitter: '采购部-王经理', date: '2023-11-01', status: '合规复核', risk: '高', riskReason: '历史行贿记录筛查' },
  ];

  const handleRunAiAudit = () => {
     setIsAiAuditing(true);
     setTimeout(() => setIsAiAuditing(false), 2000);
  };

  const renderApprovalDetail = () => {
    const task = approvalTasks.find(t => t.id === selectedTaskId);
    if (!task) return null;

    let aiChecks = [];
    let aiScore = 90;
    let aiConclusion = "建议通过";

    if (task.type === '供应商入驻') {
        aiChecks = [
            { name: '工商信息一致性核验', status: 'pass', detail: '企业名称、法人与国家信用公示系统一致' },
            { name: '经营异常名录扫描', status: 'pass', detail: '未发现列入经营异常名录记录' },
            { name: '法律诉讼风险', status: 'warning', detail: '发现 1 条历史合同纠纷（已结案）' },
            { name: '资质证书真实性', status: 'pass', detail: 'ISO9001 证书编号核验有效' },
        ];
        aiScore = 88;
        aiConclusion = "资质合规，建议通过";
    } else if (task.type === '信息变更') {
        aiChecks = [
            { name: '变更频率分析', status: 'pass', detail: '近一年首次变更关键信息' },
            { name: '收款账户一致性', status: 'warning', detail: '新账户开户行地区与注册地不一致' },
            { name: '关联交易风险', status: 'pass', detail: '未发现关联方利益输送嫌疑' },
        ];
        aiScore = 75;
        aiConclusion = "账户归属地存疑，建议复核";
    } else { // 违规/申诉
        aiChecks = [
            { name: '申诉证据链完整性', status: 'fail', detail: '缺少关键物流签收凭证' },
            { name: '历史履约评价', status: 'pass', detail: '过往 12 个月绩效考核均为 A/B' },
            { name: '违规事实复核', status: 'warning', detail: '质检报告显示存在批次性质量问题' },
        ];
        aiScore = 60;
        aiConclusion = "证据不足，建议驳回";
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedTaskId(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-black text-slate-900">{task.type}审批</h2>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] border font-bold ${
                                task.status === '待初审' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                                {task.status}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">单号: {task.id} · 提交人: {task.submitter} · {task.date}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="px-6 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl text-sm hover:bg-red-100 border border-red-100 flex items-center gap-2">
                        <XCircle size={18} /> 驳回申请
                    </button>
                    <button className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2">
                        <CheckCircle2 size={18} /> 通过审批
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Business Details */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                            <FileText className="text-blue-600" size={20} /> 业务详情
                        </h3>
                        
                        {task.type === '供应商入驻' && (
                            <div className="space-y-6">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <h4 className="font-bold text-slate-900 mb-4">基本工商信息</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div><span className="text-slate-500 block text-xs mb-1">企业名称</span><span className="font-medium">{task.supplier}</span></div>
                                        <div><span className="text-slate-500 block text-xs mb-1">统一社会信用代码</span><span className="font-medium font-mono">91330100MA2ABCDE12</span></div>
                                        <div><span className="text-slate-500 block text-xs mb-1">注册资本</span><span className="font-medium">5000 万人民币</span></div>
                                        <div><span className="text-slate-500 block text-xs mb-1">成立日期</span><span className="font-medium">2018-05-20</span></div>
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <h4 className="font-bold text-slate-900 mb-4">上传附件</h4>
                                    <div className="flex gap-4">
                                        {['营业执照.pdf', '开户许可证.jpg', 'ISO9001证书.pdf'].map((file, i) => (
                                            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-blue-600 cursor-pointer hover:border-blue-400">
                                                <FileText size={16} /> {file}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {task.type === '信息变更' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">变更项</p>
                                        <p className="font-bold text-slate-900">收款银行账户</p>
                                    </div>
                                    <ArrowRight className="text-slate-300" />
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">变更原因</p>
                                        <p className="font-bold text-slate-900">企业合并重组，账户主体变更</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="p-4 bg-red-50 rounded-2xl border border-red-100 relative">
                                        <div className="absolute top-3 right-3 text-xs font-black text-red-400 uppercase">变更前</div>
                                        <p className="text-xs text-slate-500 mb-1">银行账号</p>
                                        <p className="font-mono font-bold text-slate-700 text-lg mb-2">6222 **** **** 8888</p>
                                        <p className="text-xs text-slate-500 mb-1">开户行</p>
                                        <p className="font-medium text-slate-700">中国工商银行杭州分行</p>
                                    </div>
                                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100 relative">
                                        <div className="absolute top-3 right-3 text-xs font-black text-green-500 uppercase">变更后</div>
                                        <p className="text-xs text-slate-500 mb-1">银行账号</p>
                                        <p className="font-mono font-bold text-slate-900 text-lg mb-2">6222 **** **** 9999</p>
                                        <p className="text-xs text-slate-500 mb-1">开户行</p>
                                        <p className="font-medium text-slate-900">招商银行上海徐汇支行</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {task.type !== '供应商入驻' && task.type !== '信息变更' && (
                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                                <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                                <p className="font-bold text-slate-500">该业务类型的详情视图正在生成中...</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                            <History className="text-blue-600" size={20} /> 审批流转日志
                        </h3>
                        <div className="space-y-6 pl-4 border-l-2 border-slate-100">
                             {[
                                { action: '提交申请', user: task.submitter, time: '2023-10-28 09:30', comment: '资料已备齐' },
                                { action: '系统预审', user: 'AI Assistant', time: '2023-10-28 09:31', comment: '自动通过格式校验' },
                                { action: '待您处理', user: '当前节点', time: '现在', comment: '等待人工复核' }
                             ].map((log, i) => (
                                <div key={i} className="relative">
                                   <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${i === 2 ? 'bg-blue-600' : 'bg-green-500'}`}></div>
                                   <p className="text-sm font-bold text-slate-900">{log.action}</p>
                                   <p className="text-xs text-slate-500 mt-0.5">{log.user} · {log.time}</p>
                                   <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg inline-block">{log.comment}</p>
                                </div>
                             ))}
                        </div>
                    </div>
                </div>

                {/* Right: AI Audit Panel */}
                <div className="col-span-1 space-y-6">
                    <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                            <ScanLine size={120} />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                                    <BrainCircuit size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg">AI 智能审计</h3>
                                    <p className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Intelligent Audit</p>
                                </div>
                            </div>
                            
                            {!isAiAuditing ? (
                                <div className="animate-in fade-in duration-500">
                                    <div className="flex justify-between items-end border-b border-white/10 pb-4 mb-4">
                                        <span className="text-sm font-bold text-slate-300">合规评分</span>
                                        <span className={`text-3xl font-black ${aiScore >= 80 ? 'text-green-400' : aiScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                                            {aiScore}
                                        </span>
                                    </div>
                                    
                                    <div className="space-y-3 mb-6">
                                        {aiChecks.map((check, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                                                {check.status === 'pass' && <CheckCircle2 size={16} className="text-green-400 mt-0.5 shrink-0" />}
                                                {check.status === 'warning' && <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />}
                                                {check.status === 'fail' && <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />}
                                                <div>
                                                    <p className="text-xs font-bold text-white">{check.name}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{check.detail}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div className={`p-4 rounded-xl border ${aiScore >= 80 ? 'bg-green-500/20 border-green-500/30' : 'bg-amber-500/20 border-amber-500/30'} mb-4`}>
                                        <p className="text-[10px] font-bold uppercase mb-1 opacity-70">AI 综合结论</p>
                                        <p className="text-sm font-bold text-white">{aiConclusion}</p>
                                    </div>

                                    <button onClick={handleRunAiAudit} className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-xs transition-colors border border-white/10">
                                        重新运行审计
                                    </button>
                                </div>
                            ) : (
                                <div className="py-20 text-center">
                                    <Loader2 size={48} className="animate-spin mx-auto text-blue-400 mb-4" />
                                    <p className="text-sm font-bold text-white">AI 正在交叉验证数据...</p>
                                    <p className="text-xs text-slate-400 mt-2">连接工商数据库 / 征信系统 / 历史档案</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                            <CheckSquare className="text-blue-600" size={16} /> 辅助工具
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all text-center group">
                                <FileDiff size={20} className="mx-auto text-slate-400 group-hover:text-blue-600 mb-2" />
                                <span className="text-xs font-bold text-slate-600">文档比对</span>
                            </button>
                            <button className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all text-center group">
                                <Search size={20} className="mx-auto text-slate-400 group-hover:text-blue-600 mb-2" />
                                <span className="text-xs font-bold text-slate-600">关联查询</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  if (selectedTaskId) {
    return renderApprovalDetail();
  }

  return (
      <div className="space-y-6 animate-in fade-in duration-300">
         <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div>
               <h1 className="text-xl font-black text-slate-900">智能审批中心</h1>
               <p className="text-sm text-slate-500 mt-1">集中处理供应商入驻、资料变更、风险申斥及考核申诉等全流程审批业务</p>
            </div>
            <div className="flex gap-3">
               <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                  <Clock size={18} /> 审批历史
               </button>
               <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200">
                  <CheckCircle2 size={18} /> 批量通过
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
               <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><UserCheck size={24} /></div>
               <div>
                  <p className="text-sm text-slate-500 font-bold">待办审批</p>
                  <p className="text-2xl font-black text-slate-900">5 <span className="text-xs font-normal text-slate-400">个任务</span></p>
               </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
               <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center"><AlertTriangle size={24} /></div>
               <div>
                  <p className="text-sm text-slate-500 font-bold">AI 风险预警</p>
                  <p className="text-2xl font-black text-slate-900">3 <span className="text-xs font-normal text-slate-400">个高风险</span></p>
               </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
               <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center"><TrendingUp size={24} /></div>
               <div>
                  <p className="text-sm text-slate-500 font-bold">本周处理效率</p>
                  <p className="text-2xl font-black text-slate-900">Avg 4h <span className="text-xs font-normal text-slate-400">/ 单</span></p>
               </div>
            </div>
         </div>

         <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex gap-4">
                   <select className="bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg px-3 py-2 outline-none">
                      <option>所有业务类型</option>
                      <option>供应商入驻</option>
                      <option>信息变更</option>
                      <option>违规申斥</option>
                   </select>
                   <select className="bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg px-3 py-2 outline-none">
                      <option>所有状态</option>
                      <option>待初审</option>
                      <option>AI预警</option>
                   </select>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" placeholder="搜索申请单号或供应商" className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none w-64" />
                </div>
             </div>
             <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-left">
                   <tr>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase w-16 text-center whitespace-nowrap">序号</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase">申请单号</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase">业务类型</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase">关联供应商</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase">AI 风险评估</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase">提交时间</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">当前状态</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {approvalTasks.map((task, i) => (
                      <tr key={task.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => setSelectedTaskId(task.id)}>
                         <td className="px-6 py-4 text-center font-bold text-slate-400 whitespace-nowrap">
                            {i + 1}
                         </td>
                         <td className="px-6 py-4">
                            <div className="font-mono font-bold text-slate-900">{task.id}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{task.submitter}</div>
                         </td>
                         <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                               task.type === '供应商入驻' ? 'bg-blue-50 text-blue-700' :
                               task.type === '信息变更' ? 'bg-purple-50 text-purple-700' :
                               'bg-red-50 text-red-700'
                            }`}>
                               {task.type}
                            </span>
                         </td>
                         <td className="px-6 py-4 font-bold text-slate-700">
                            {task.supplier}
                         </td>
                         <td className="px-6 py-4">
                            <div className={`flex items-center gap-1.5 text-xs font-bold ${
                               task.risk === '高' ? 'text-red-600' : 
                               task.risk === '中' ? 'text-amber-600' : 'text-green-600'
                            }`}>
                               {task.risk === '高' && <AlertTriangle size={14} />}
                               {task.risk === '中' && <AlertTriangle size={14} />}
                               {task.risk === '低' && <ShieldCheck size={14} />}
                               <span>{task.risk}风险</span>
                            </div>
                            {task.riskReason && <p className="text-[10px] text-slate-400 mt-1">{task.riskReason}</p>}
                         </td>
                         <td className="px-6 py-4 text-slate-500 font-medium">
                            {task.date}
                         </td>
                         <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                               task.status === '待初审' || task.status === '待裁决' ? 'bg-blue-100 text-blue-700' :
                               task.status === '已通过' ? 'bg-green-100 text-green-700' :
                               'bg-amber-100 text-amber-700'
                            }`}>
                               {task.status}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-center">
                            <button className="text-blue-600 font-bold hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors text-xs">
                               审批
                            </button>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
         </div>
      </div>
  );
};

export default SupplierApproval;
