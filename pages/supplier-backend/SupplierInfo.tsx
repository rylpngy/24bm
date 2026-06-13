
import React, { useState } from 'react';
import { 
  Building2, MapPin, Phone, Mail, Globe, Save, Edit3, 
  CreditCard, FileText, CheckCircle2, ShieldCheck, AlertCircle,
  History, X, Copy, Clock, ArrowRight
} from 'lucide-react';

interface ChangeLog {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  operator: string;
  date: string;
  status: 'approved' | 'pending' | 'rejected';
}

interface EditModalProps { 
  title: string; 
  onClose: () => void; 
  onSave: () => void;
  children: React.ReactNode; 
}

const EditModal: React.FC<EditModalProps> = ({ title, onClose, onSave, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-900">{title}</h3>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                  <X size={24} />
              </button>
          </div>
          <div className="p-8 overflow-y-auto">
              {children}
          </div>
          <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button onClick={onClose} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50">取消</button>
              <button onClick={onSave} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 shadow-lg">保存更改</button>
          </div>
      </div>
  </div>
);

const SupplierInfo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info');
  const [editSection, setEditSection] = useState<'basic' | 'contact' | 'finance' | null>(null);
  
  const [formData, setFormData] = useState({
    name: '苏州精控机械有限公司',
    shortName: '精控机械',
    creditCode: '91320594MA1X7Y8Z0L',
    legalPerson: '张建国',
    regCapital: '5000万人民币',
    estDate: '2010-05-18',
    type: '有限责任公司(自然人投资或控股)',
    industry: '通用设备制造业',
    address: '江苏省苏州市工业园区星湖街328号',
    contactPerson: '张经理',
    contactPhone: '13900001111',
    email: 'contact@suzhoujk.com',
    website: 'www.suzhoujk.com',
    description: '苏州精控机械有限公司是一家专注于精密机械零部件加工与制造的高新技术企业，拥有先进的CNC加工中心及检测设备，长期为航空航天、医疗器械及自动化行业提供优质配套服务。',
    bankName: '中国工商银行苏州工业园区支行',
    bankAccount: '1102020309000012345',
    bankHolder: '苏州精控机械有限公司'
  });

  const [changeLogs] = useState<ChangeLog[]>([
    { id: 'LOG-001', field: '联系电话', oldValue: '13800008888', newValue: '13900001111', operator: '张建国', date: '2023-10-15 14:30', status: 'approved' },
    { id: 'LOG-002', field: '银行账号', oldValue: '6222****8888', newValue: '1102****2345', operator: '王财务', date: '2023-09-01 09:00', status: 'approved' },
    { id: 'LOG-003', field: '经营地址', oldValue: '苏州工业园区苏华路1号', newValue: '苏州工业园区星湖街328号', operator: '张建国', date: '2023-05-20 10:15', status: 'approved' },
  ]);

  const handleSave = () => {
    setEditSection(null);
    // In a real app, API call to update profile would go here.
    alert('信息更新请求已提交，部分关键信息需审核后生效。');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Edit Modals */}
      {editSection === 'basic' && (
          <EditModal title="编辑工商基础信息" onClose={() => setEditSection(null)} onSave={handleSave}>
              <div className="space-y-4">
                  <div className="p-4 bg-blue-50 text-blue-700 text-xs rounded-xl border border-blue-100 flex items-start gap-2">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <p>企业名称、统一社会信用代码等关键信息变更需提交相关证明文件进行人工审核，审核期间将无法参与新的投标活动。</p>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">企业简称</label>
                      <input 
                          type="text" 
                          value={formData.shortName}
                          onChange={e => setFormData({...formData, shortName: e.target.value})}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">企业介绍</label>
                      <textarea 
                          value={formData.description}
                          onChange={e => setFormData({...formData, description: e.target.value})}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none"
                      ></textarea>
                  </div>
              </div>
          </EditModal>
      )}

      {editSection === 'contact' && (
          <EditModal title="编辑联系信息" onClose={() => setEditSection(null)} onSave={handleSave}>
              <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">经营地址</label>
                      <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">业务联系人</label>
                      <input type="text" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">联系电话</label>
                      <input type="text" value={formData.contactPhone} onChange={e => setFormData({...formData, contactPhone: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">电子邮箱</label>
                      <input type="text" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">企业网址</label>
                      <input type="text" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
              </div>
          </EditModal>
      )}

      {editSection === 'finance' && (
          <EditModal title="变更收款账户" onClose={() => setEditSection(null)} onSave={handleSave}>
              <div className="space-y-4">
                  <div className="p-4 bg-amber-50 text-amber-700 text-xs rounded-xl border border-amber-100 flex items-start gap-2">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <p>变更收款账户将触发小额打款验证，验证通过后方可生效。请确保账户信息真实有效。</p>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">开户银行</label>
                      <input type="text" value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">银行账号</label>
                      <input type="text" value={formData.bankAccount} onChange={e => setFormData({...formData, bankAccount: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">开户名称</label>
                      <input type="text" value={formData.bankHolder} disabled className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl outline-none text-slate-500 cursor-not-allowed" title="需与企业名称一致" />
                  </div>
                  <div className="pt-4">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">上传开户许可证 / 印鉴卡</label>
                      <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 hover:bg-slate-50 cursor-pointer">
                          <p>点击上传图片或 PDF</p>
                      </div>
                  </div>
              </div>
          </EditModal>
      )}

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Building2 className="text-orange-600" size={24} />
            企业档案
          </h1>
          <p className="text-sm text-slate-500 mt-1">管理企业工商信息、联系方式及对外展示资料</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'info' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
                基本信息
            </button>
            <button 
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
                变更记录
            </button>
        </div>
      </div>

      {activeTab === 'info' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Basic Info */}
            <div className="lg:col-span-2 space-y-6">
                {/* Basic Info Card */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                        <Building2 size={120} />
                    </div>
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <FileText className="text-blue-600" size={20} /> 工商基础信息
                        </h3>
                        <button onClick={() => setEditSection('basic')} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                            <Edit3 size={14} /> 编辑
                        </button>
                    </div>
                
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">企业全称</label>
                            <p className="text-lg font-black text-slate-900 flex items-center gap-2">
                                {formData.name}
                                <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] rounded border border-green-200 uppercase font-bold flex items-center gap-1">
                                <CheckCircle2 size={10} /> 已认证
                                </span>
                            </p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">统一社会信用代码</label>
                            <p className="font-mono font-bold text-slate-700">{formData.creditCode}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">法定代表人</label>
                            <p className="font-bold text-slate-700">{formData.legalPerson}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">注册资本</label>
                            <p className="font-medium text-slate-700">{formData.regCapital}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">成立日期</label>
                            <p className="font-medium text-slate-700">{formData.estDate}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">企业类型</label>
                            <p className="font-medium text-slate-700">{formData.type}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">所属行业</label>
                            <p className="font-medium text-slate-700">{formData.industry}</p>
                        </div>
                    </div>
                
                    <div className="mt-6 pt-6 border-t border-slate-100 flex gap-2 text-xs text-slate-400">
                        <ShieldCheck size={14} className="text-green-500" />
                        <span>以上信息已通过国家企业信用信息公示系统核验</span>
                    </div>
                </div>

                {/* Profile & Description */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Globe className="text-blue-600" size={20} /> 企业简介与展示
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">企业简称</label>
                            <p className="font-bold text-slate-900">{formData.shortName}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">企业介绍</label>
                            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                                {formData.description}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Contact & Bank */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Phone className="text-blue-600" size={20} /> 联系信息
                        </h3>
                        <button onClick={() => setEditSection('contact')} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors">编辑</button>
                    </div>
                    
                    <div className="space-y-4 text-sm">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">经营地址</label>
                            <div className="flex items-start gap-2 text-slate-700">
                                <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                                {formData.address}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">业务联系人</label>
                            <p className="font-medium text-slate-900">{formData.contactPerson}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">联系电话</label>
                            <p className="font-medium text-slate-900 font-mono">{formData.contactPhone}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">电子邮箱</label>
                            <p className="font-medium text-slate-900">{formData.email}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">企业网址</label>
                            <a href={`http://${formData.website}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{formData.website}</a>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none transition-transform group-hover:scale-110"><CreditCard size={80} /></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <CreditCard size={20} className="text-blue-400"/> 收款账户
                            </h3>
                            <button onClick={() => setEditSection('finance')} className="text-xs font-bold text-blue-300 hover:text-white transition-colors">变更</button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">开户名称</p>
                                <p className="font-medium">{formData.bankHolder}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">开户银行</p>
                                <p className="font-medium">{formData.bankName}</p>
                            </div>
                            <div className="pt-2 border-t border-white/10">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">银行账号</p>
                                <div className="flex items-center gap-2">
                                    <p className="font-mono text-xl font-bold tracking-wider text-blue-300">{formData.bankAccount}</p>
                                    <button className="text-slate-500 hover:text-white" title="复制"><Copy size={14}/></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center gap-2">
                <History className="text-blue-600" size={20} />
                <h3 className="font-bold text-slate-900">信息变更日志</h3>
            </div>
            <div className="divide-y divide-slate-100">
                {changeLogs.map((log) => (
                    <div key={log.id} className="p-6 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                        <div className="mt-1">
                            {log.status === 'approved' && <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><CheckCircle2 size={16} /></div>}
                            {log.status === 'pending' && <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center"><Clock size={16} /></div>}
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between mb-1">
                                <p className="font-bold text-slate-900">变更项：{log.field}</p>
                                <span className="text-xs text-slate-400">{log.date}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm mb-2">
                                <span className="line-through text-slate-400">{log.oldValue}</span>
                                <ArrowRight size={14} className="text-slate-300" />
                                <span className="font-bold text-blue-600">{log.newValue}</span>
                            </div>
                            <p className="text-xs text-slate-500">操作人：{log.operator}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default SupplierInfo;
