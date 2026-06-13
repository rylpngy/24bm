
import React, { useState } from 'react';
import { 
  ChevronLeft, FileCheck, Paperclip, FileText, Download, Landmark, Archive
} from 'lucide-react';

interface ArchivedProject {
  id: string;
  title: string;
  dept: string;
  manager: string;
  finishDate: string;
  totalAmount: number;
  supplier: string;
  description: string;
  method: string;
  items: { name: string; spec: string; qty: number; unit: string; price: number; total: number }[];
  attachments: { name: string; size: string; type: string; date: string }[];
}

const ProjectArchives: React.FC = () => {
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [archivedProjects] = useState<ArchivedProject[]>([
    {
      id: 'ARC-2023-001',
      title: '2023年上半年服务器集群扩容项目',
      dept: '技术部',
      manager: '赵铁柱',
      finishDate: '2023-06-15',
      totalAmount: 1250000,
      supplier: '浪潮电子信息产业股份有限公司',
      description: '为应对Q3季度业务流量高峰，需对核心机房服务器集群进行紧急扩容，要求包含3年原厂上门质保服务。',
      method: '公开招标',
      items: [
        { name: '高性能计算节点服务器', spec: '2*Xeon Gold 6248, 512G RAM', qty: 10, unit: '台', price: 85000, total: 850000 },
        { name: '分布式存储服务器', spec: '200TB RAW Capacity', qty: 2, unit: '台', price: 200000, total: 400000 }
      ],
      attachments: [
        { name: '中标通知书.pdf', size: '1.2 MB', type: 'PDF', date: '2023-05-20' },
        { name: '最终验收报告.pdf', size: '3.5 MB', type: 'PDF', date: '2023-06-15' },
        { name: '设备采购合同(正本).pdf', size: '5.8 MB', type: 'PDF', date: '2023-05-25' }
      ]
    },
    {
      id: 'ARC-2023-005',
      title: '生产基地原材料（聚丙烯颗粒）年度框架协议',
      dept: '生产部',
      manager: '钱多多',
      finishDate: '2023-01-10',
      totalAmount: 5800000,
      supplier: '中国石油化工股份有限公司',
      description: '2023年度主要生产原材料年度集采，采取框架协议模式，按月度订单实报实销，锁定年度基准价格优惠。',
      method: '邀请招标',
      items: [
        { name: '聚丙烯颗粒 (PP)', spec: 'T30S 工业级', qty: 800, unit: '吨', price: 7250, total: 5800000 }
      ],
      attachments: [
        { name: '年度框架合作协议.pdf', size: '2.1 MB', type: 'PDF', date: '2023-01-08' },
        { name: '供应商资质审核表.jpg', size: '0.8 MB', type: 'JPG', date: '2022-12-25' }
      ]
    },
    {
      id: 'ARC-2023-012',
      title: '端午节员工福利礼盒采购',
      dept: '人力资源部',
      manager: '孙小美',
      finishDate: '2023-06-01',
      totalAmount: 120000,
      supplier: '五芳斋实业股份有限公司',
      description: '全员端午节福利发放，需包含粽子、咸鸭蛋礼盒，要求礼盒定制公司Logo，配送至全国各分公司。',
      method: '商城直采',
      items: [
        { name: '端午定制礼盒A款', spec: '10粽+6蛋', qty: 600, unit: '盒', price: 200, total: 120000 }
      ],
      attachments: [
        { name: '采购订单确认函.pdf', size: '0.5 MB', type: 'PDF', date: '2023-05-10' },
        { name: '发货签收单汇总.xlsx', size: '1.2 MB', type: 'EXCEL', date: '2023-06-01' },
        { name: '增值税专用发票.pdf', size: '0.3 MB', type: 'PDF', date: '2023-06-02' }
      ]
    }
  ]);

  const renderArchiveDetail = () => {
    const archive = archivedProjects.find(a => a.id === selectedArchiveId);
    if (!archive) return null;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
           <button onClick={() => setSelectedArchiveId(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
              <ChevronLeft size={24} />
           </button>
           <div>
              <h2 className="text-2xl font-black text-slate-900">{archive.title}</h2>
              <p className="text-sm text-slate-500 mt-1">项目归档编号: {archive.id} · 归档日期: {archive.finishDate}</p>
           </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
           <div className="col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                 <h3 className="font-bold text-slate-900 flex items-center gap-2"><FileCheck className="text-blue-600"/> 项目验收总结</h3>
                 <div className="p-4 bg-slate-50 rounded-2xl text-sm text-slate-700 leading-relaxed">
                    {archive.description}
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border border-slate-100 rounded-2xl">
                       <p className="text-xs font-bold text-slate-400 uppercase mb-1">成交供应商</p>
                       <p className="font-bold text-slate-900">{archive.supplier}</p>
                    </div>
                    <div className="p-4 border border-slate-100 rounded-2xl">
                       <p className="text-xs font-bold text-slate-400 uppercase mb-1">实际成交总额</p>
                       <p className="font-bold text-slate-900 font-mono">¥{archive.totalAmount.toLocaleString()}</p>
                    </div>
                 </div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2"><Paperclip className="text-blue-600"/> 归档附件</h3>
                 <div className="space-y-3">
                    {archive.attachments.map((file, i) => (
                       <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-300 transition-colors group cursor-pointer">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-slate-500 shadow-sm">
                                {file.type === 'PDF' ? <FileText size={20} className="text-red-500" /> : <FileText size={20} className="text-blue-500" />}
                             </div>
                             <div>
                                <p className="font-bold text-slate-900 text-sm">{file.name}</p>
                                <p className="text-xs text-slate-400">{file.size} · {file.date}</p>
                             </div>
                          </div>
                          <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100">
                             <Download size={20} />
                          </button>
                       </div>
                    ))}
                 </div>
              </div>
           </div>

           <div className="col-span-1">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2"><Landmark className="text-blue-600"/> 采购清单快照</h3>
                 <div className="space-y-4">
                    {archive.items.map((item, i) => (
                       <div key={i} className="pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                          <p className="font-bold text-slate-900 text-sm mb-1">{item.name}</p>
                          <p className="text-xs text-slate-500 mb-2">{item.spec}</p>
                          <div className="flex justify-between items-center text-xs">
                             <span className="font-medium text-slate-600">x {item.qty} {item.unit}</span>
                             <span className="font-bold text-slate-900">¥{item.total.toLocaleString()}</span>
                          </div>
                       </div>
                    ))}
                 </div>
                 <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase">合计</span>
                    <span className="font-black text-slate-900 text-lg">¥{archive.totalAmount.toLocaleString()}</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  if (selectedArchiveId) return renderArchiveDetail();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
       <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
             <h2 className="text-xl font-black text-slate-900">项目档案室</h2>
             <p className="text-sm text-slate-500 mt-1">已完结采购项目的全生命周期电子档案归档</p>
          </div>
          <div className="flex gap-2">
             <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50">年度报表</button>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {archivedProjects.map(p => (
             <div key={p.id} onClick={() => setSelectedArchiveId(p.id)} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-4">
                   <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Archive size={24} />
                   </div>
                   <span className="px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold uppercase rounded">已归档</span>
                </div>
                <h3 className="font-bold text-slate-900 mb-2 line-clamp-2 h-12">{p.title}</h3>
                <div className="text-xs text-slate-500 space-y-1 mb-4">
                   <p>归档日期: {p.finishDate}</p>
                   <p>项目经理: {p.manager}</p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                   <span className="text-xs font-bold text-slate-400 uppercase">{p.dept}</span>
                   <span className="text-sm font-black text-slate-900">¥{p.totalAmount.toLocaleString()}</span>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};

export default ProjectArchives;
