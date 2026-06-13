
import React, { useState } from 'react';
import { 
  ShieldCheck, UploadCloud, Plus, FileText, Calendar, AlertTriangle, CheckCircle2, 
  XCircle, MoreVertical, Eye, Download, Trash2, X, RefreshCcw, Maximize2
} from 'lucide-react';

interface Certificate {
  id: string;
  name: string;
  type: string;
  number: string;
  issueDate: string;
  expiryDate: string;
  status: 'valid' | 'expiring' | 'expired';
  file: string;
}

const SupplierQualification: React.FC = () => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewCert, setPreviewCert] = useState<Certificate | null>(null);
  
  const [certificates, setCertificates] = useState<Certificate[]>([
    {
      id: 'CERT-001',
      name: '营业执照 (三证合一)',
      type: '基础资质',
      number: '91320594MA1X7Y8Z0L',
      issueDate: '2010-05-18',
      expiryDate: '长期',
      status: 'valid',
      file: '营业执照_副本.pdf'
    },
    {
      id: 'CERT-002',
      name: 'ISO9001 质量管理体系认证',
      type: '体系认证',
      number: 'CNAS12345678',
      issueDate: '2021-06-01',
      expiryDate: '2024-06-01',
      status: 'valid',
      file: 'ISO9001_CN.pdf'
    },
    {
      id: 'CERT-003',
      name: 'ISO14001 环境管理体系认证',
      type: '体系认证',
      number: 'CNAS87654321',
      issueDate: '2020-11-15',
      expiryDate: '2023-11-15',
      status: 'expiring',
      file: 'ISO14001_CN.pdf'
    },
    {
      id: 'CERT-004',
      name: '高新技术企业证书',
      type: '荣誉资质',
      number: 'GR202032001234',
      issueDate: '2020-01-01',
      expiryDate: '2023-01-01',
      status: 'expired',
      file: '高企证书.jpg'
    }
  ]);

  const [newCert, setNewCert] = useState<Partial<Certificate>>({ type: '基础资质' });

  const handleUpload = () => {
    if(!newCert.name || !newCert.number) return;
    const cert: Certificate = {
        id: `CERT-${Date.now()}`,
        name: newCert.name,
        type: newCert.type || '基础资质',
        number: newCert.number,
        issueDate: newCert.issueDate || '',
        expiryDate: newCert.expiryDate || '',
        status: 'valid', // Mock logic
        file: 'new_cert.pdf'
    };
    setCertificates([...certificates, cert]);
    setIsUploadModalOpen(false);
    setNewCert({ type: '基础资质' });
  };

  const handleRenew = (oldCert: Certificate) => {
      setNewCert({
          name: oldCert.name,
          type: oldCert.type,
          number: oldCert.number
      });
      setIsUploadModalOpen(true);
  };

  const deleteCert = (id: string) => {
      if(confirm('确定删除该证书吗？')) {
          setCertificates(certificates.filter(c => c.id !== id));
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 relative">
      {/* Upload/Renew Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                 <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <UploadCloud size={24} className="text-blue-600"/> 上传/更新资质
                 </h3>
                 <button onClick={() => setIsUploadModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                    <X size={24} />
                 </button>
              </div>
              <div className="p-8 space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">证书名称 <span className="text-red-500">*</span></label>
                    <input 
                       type="text" 
                       value={newCert.name}
                       onChange={e => setNewCert({...newCert, name: e.target.value})}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                       placeholder="如：ISO9001 证书"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">资质类型</label>
                    <select 
                       value={newCert.type}
                       onChange={e => setNewCert({...newCert, type: e.target.value})}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                       <option>基础资质</option>
                       <option>体系认证</option>
                       <option>行业许可</option>
                       <option>荣誉资质</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">证书编号 <span className="text-red-500">*</span></label>
                    <input 
                       type="text" 
                       value={newCert.number}
                       onChange={e => setNewCert({...newCert, number: e.target.value})}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono" 
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">发证日期</label>
                       <input 
                          type="date" 
                          value={newCert.issueDate}
                          onChange={e => setNewCert({...newCert, issueDate: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">有效期至</label>
                       <input 
                          type="date" 
                          value={newCert.expiryDate}
                          onChange={e => setNewCert({...newCert, expiryDate: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                       />
                    </div>
                 </div>
                 <div className="pt-2">
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
                        <UploadCloud size={24} className="mb-2" />
                        <span className="text-xs font-bold">点击上传证书扫描件</span>
                        <span className="text-[10px] text-slate-400 mt-1">支持 PDF, JPG (Max 5MB)</span>
                    </div>
                 </div>
              </div>
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                 <button onClick={() => setIsUploadModalOpen(false)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50">取消</button>
                 <button onClick={handleUpload} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 shadow-lg">提交</button>
              </div>
           </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewCert && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm">
              <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                  <div className="flex justify-between items-center p-6 border-b border-slate-100">
                      <h3 className="text-lg font-black text-slate-900">证书详情</h3>
                      <button onClick={() => setPreviewCert(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                          <X size={24} />
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm mb-6">
                          <div className="aspect-[3/4] bg-slate-100 rounded-xl flex items-center justify-center text-slate-300 relative overflow-hidden group">
                              <FileText size={64} />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <button className="bg-white text-slate-900 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:scale-105 transition-transform">
                                      <Maximize2 size={16} /> 查看大图
                                  </button>
                              </div>
                          </div>
                      </div>
                      
                      <div className="space-y-6">
                          <div>
                              <h4 className="font-bold text-slate-900 text-xl mb-1">{previewCert.name}</h4>
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                previewCert.status === 'valid' ? 'bg-green-100 text-green-700' :
                                previewCert.status === 'expiring' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {previewCert.status === 'valid' ? '有效' : previewCert.status === 'expiring' ? '即将过期' : '已过期'}
                              </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="p-4 bg-white rounded-xl border border-slate-200">
                                  <p className="text-xs text-slate-400 font-bold uppercase mb-1">资质类型</p>
                                  <p className="font-bold text-slate-900">{previewCert.type}</p>
                              </div>
                              <div className="p-4 bg-white rounded-xl border border-slate-200">
                                  <p className="text-xs text-slate-400 font-bold uppercase mb-1">证书编号</p>
                                  <p className="font-mono font-bold text-slate-900 truncate" title={previewCert.number}>{previewCert.number}</p>
                              </div>
                              <div className="p-4 bg-white rounded-xl border border-slate-200">
                                  <p className="text-xs text-slate-400 font-bold uppercase mb-1">发证日期</p>
                                  <p className="font-bold text-slate-900">{previewCert.issueDate}</p>
                              </div>
                              <div className="p-4 bg-white rounded-xl border border-slate-200">
                                  <p className="text-xs text-slate-400 font-bold uppercase mb-1">有效期至</p>
                                  <p className={`font-bold ${previewCert.status !== 'valid' ? 'text-red-500' : 'text-slate-900'}`}>{previewCert.expiryDate}</p>
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="p-6 border-t border-slate-100 flex gap-3">
                      <button className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-2">
                          <Download size={18} /> 下载原件
                      </button>
                      {previewCert.status !== 'valid' && (
                          <button 
                            onClick={() => { setPreviewCert(null); handleRenew(previewCert); }} 
                            className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 flex items-center justify-center gap-2"
                          >
                              <RefreshCcw size={18} /> 申请换证
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}

      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-orange-600" size={24} />
            资质认证管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">上传并维护企业各类经营资质证书</p>
        </div>
        <button 
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-800 shadow-lg transition-all"
        >
           <Plus size={18} /> 上传证书
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {certificates.map((cert) => (
            <div key={cert.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-orange-300 transition-all group">
               <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        cert.status === 'valid' ? 'bg-green-100 text-green-600' :
                        cert.status === 'expiring' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                     }`}>
                        <FileText size={24} />
                     </div>
                     <div>
                        <h3 className="font-bold text-slate-900 text-lg">{cert.name}</h3>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{cert.number}</p>
                     </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                     cert.status === 'valid' ? 'bg-green-50 text-green-700' :
                     cert.status === 'expiring' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                  }`}>
                     {cert.status === 'valid' ? '有效' : cert.status === 'expiring' ? '即将过期' : '已过期'}
                  </span>
               </div>
               
               <div className="bg-slate-50 rounded-2xl p-4 grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                     <p className="text-xs font-bold text-slate-400 uppercase mb-1">资质类型</p>
                     <p className="font-medium text-slate-700">{cert.type}</p>
                  </div>
                  <div>
                     <p className="text-xs font-bold text-slate-400 uppercase mb-1">附件</p>
                     <p className="font-medium text-blue-600 underline cursor-pointer truncate" onClick={() => setPreviewCert(cert)}>{cert.file}</p>
                  </div>
                  <div>
                     <p className="text-xs font-bold text-slate-400 uppercase mb-1">发证日期</p>
                     <p className="font-medium text-slate-700 flex items-center gap-1"><Calendar size={12}/> {cert.issueDate}</p>
                  </div>
                  <div>
                     <p className="text-xs font-bold text-slate-400 uppercase mb-1">有效期至</p>
                     <p className={`font-medium flex items-center gap-1 ${cert.status !== 'valid' ? 'text-red-600' : 'text-slate-700'}`}>
                        <Calendar size={12}/> {cert.expiryDate}
                     </p>
                  </div>
               </div>

               {cert.status === 'expiring' && (
                  <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl mb-4">
                     <div className="flex items-center gap-2 text-xs text-amber-700 font-bold">
                        <AlertTriangle size={14} /> 证书即将过期
                     </div>
                     <button onClick={() => handleRenew(cert)} className="text-xs font-bold bg-amber-200 text-amber-800 px-2 py-1 rounded hover:bg-amber-300 transition-colors">
                        立即续期
                     </button>
                  </div>
               )}

               <div className="flex gap-2">
                  <button 
                    onClick={() => setPreviewCert(cert)}
                    className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2"
                  >
                     <Eye size={16} /> 查看
                  </button>
                  <button className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2">
                     <Download size={16} /> 下载
                  </button>
                  <button onClick={() => deleteCert(cert.id)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all">
                     <Trash2 size={16} />
                  </button>
               </div>
            </div>
         ))}
      </div>
    </div>
  );
};

export default SupplierQualification;
