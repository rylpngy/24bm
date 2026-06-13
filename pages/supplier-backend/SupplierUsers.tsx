
import React, { useState } from 'react';
import { 
  Users, UserPlus, Search, Filter, MoreHorizontal, User, Mail, Phone, 
  Shield, CheckCircle2, XCircle, Edit3, Trash2, Lock, X, Save, Clock, Key
} from 'lucide-react';

interface SupplierUser {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  status: 'active' | 'disabled';
  lastLogin: string;
}

const SupplierUsers: React.FC = () => {
  const [users, setUsers] = useState<SupplierUser[]>([
    { id: 'u1', name: '张建国', role: '管理员', phone: '13900001111', email: 'zhang.jg@suzhoujk.com', status: 'active', lastLogin: '2023-11-02 09:30' },
    { id: 'u2', name: '李销售', role: '销售经理', phone: '13800002222', email: 'sales@suzhoujk.com', status: 'active', lastLogin: '2023-11-01 14:20' },
    { id: 'u3', name: '王财务', role: '财务专员', phone: '15000003333', email: 'finance@suzhoujk.com', status: 'active', lastLogin: '2023-10-30 16:45' },
    { id: 'u4', name: '赵客服', role: '客服专员', phone: '18000004444', email: 'service@suzhoujk.com', status: 'disabled', lastLogin: '2023-09-15 10:00' },
  ]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SupplierUser | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [userForm, setUserForm] = useState<Partial<SupplierUser>>({ role: '销售经理', status: 'active' });

  const openAddModal = () => {
      setEditMode(false);
      setUserForm({ role: '销售经理', status: 'active' });
      setIsModalOpen(true);
  };

  const openEditModal = (user: SupplierUser) => {
      setEditMode(true);
      setUserForm({ ...user });
      setIsModalOpen(true);
  };

  const handleSaveUser = () => {
    if (!userForm.name || !userForm.phone) return;
    
    if (editMode && userForm.id) {
        // Edit
        setUsers(users.map(u => u.id === userForm.id ? { ...u, ...userForm } as SupplierUser : u));
    } else {
        // Add
        const user: SupplierUser = {
            id: `u${Date.now()}`,
            name: userForm.name!,
            role: userForm.role || '普通员工',
            phone: userForm.phone!,
            email: userForm.email || '',
            status: userForm.status as 'active' | 'disabled' || 'active',
            lastLogin: '-'
        };
        setUsers([...users, user]);
    }
    setIsModalOpen(false);
  };

  const toggleStatus = (id: string) => {
      setUsers(users.map(u => u.id === id ? { ...u, status: u.status === 'active' ? 'disabled' : 'active' } : u));
  };

  const deleteUser = (id: string) => {
      if(confirm('确定删除该员工账号吗？')) {
          setUsers(users.filter(u => u.id !== id));
          if (selectedUser?.id === id) setSelectedUser(null);
      }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 animate-in fade-in slide-in-from-right-4 duration-300 relative">
      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                 <h3 className="text-xl font-black text-slate-900">{editMode ? '编辑员工信息' : '添加新员工'}</h3>
                 <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                    <X size={24} />
                 </button>
              </div>
              <div className="p-6 space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">姓名 <span className="text-red-500">*</span></label>
                    <input 
                       type="text" 
                       value={userForm.name || ''}
                       onChange={e => setUserForm({...userForm, name: e.target.value})}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500" 
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">手机号 (登录账号) <span className="text-red-500">*</span></label>
                    <input 
                       type="text" 
                       value={userForm.phone || ''}
                       onChange={e => setUserForm({...userForm, phone: e.target.value})}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500" 
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">电子邮箱</label>
                    <input 
                       type="email" 
                       value={userForm.email || ''}
                       onChange={e => setUserForm({...userForm, email: e.target.value})}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500" 
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">角色权限</label>
                    <select 
                       value={userForm.role}
                       onChange={e => setUserForm({...userForm, role: e.target.value})}
                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                    >
                       <option>管理员</option>
                       <option>销售经理</option>
                       <option>财务专员</option>
                       <option>客服专员</option>
                       <option>普通员工</option>
                    </select>
                 </div>
              </div>
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                 <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50">取消</button>
                 <button onClick={handleSaveUser} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 shadow-lg flex items-center gap-2">
                    <Save size={16} /> 保存
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Main List */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm shrink-0">
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Users className="text-orange-600" size={24} />
                员工管理
              </h1>
              <p className="text-sm text-slate-500 mt-1">管理企业内部子账号及角色权限分配</p>
            </div>
            <button 
              onClick={openAddModal}
              className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-800 shadow-lg transition-all"
            >
              <UserPlus size={18} /> 添加员工
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white text-slate-900 shadow-sm">全部员工</button>
                  <button className="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-500 hover:bg-white transition-all">管理员</button>
                  <button className="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-500 hover:bg-white transition-all">销售</button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" placeholder="搜索姓名或手机号..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none w-64 focus:ring-2 focus:ring-orange-500 transition-all" />
                </div>
            </div>
            <div className="overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-left sticky top-0 z-10">
                  <tr>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase">姓名</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase">角色</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase">联系方式</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase">账号状态</th>
                      <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u, i) => (
                      <tr 
                        key={u.id} 
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedUser?.id === u.id ? 'bg-orange-50/50' : ''}`}
                        onClick={() => setSelectedUser(u)}
                      >
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                                  {u.name.charAt(0)}
                              </div>
                              <span className="font-bold text-slate-900">{u.name}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <Shield size={14} className="text-blue-600" />
                              <span className="font-medium text-slate-700">{u.role}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <p className="flex items-center gap-2 text-slate-600 mb-0.5"><Phone size={12} className="text-slate-400"/> {u.phone}</p>
                            <p className="flex items-center gap-2 text-slate-500 text-xs"><Mail size={12} className="text-slate-400"/> {u.email}</p>
                        </td>
                        <td className="px-6 py-4">
                            <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full w-fit ${
                              u.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {u.status === 'active' ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                              {u.status === 'active' ? '正常' : '已停用'}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); openEditModal(u); }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" 
                                title="编辑"
                              >
                                  <Edit3 size={16} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteUser(u.id); }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                                title="删除"
                              >
                                  <Trash2 size={16} />
                              </button>
                            </div>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      </div>

      {/* Details Side Drawer */}
      <div className={`w-80 bg-white border-l border-slate-200 shadow-xl flex flex-col transition-all duration-300 ${selectedUser ? 'translate-x-0' : 'translate-x-full absolute right-0 top-0 bottom-0'}`}>
          {selectedUser ? (
              <>
                <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                    <div className="flex flex-col items-center w-full">
                        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center font-black text-2xl text-slate-400 mb-4">
                            {selectedUser.name.charAt(0)}
                        </div>
                        <h2 className="text-xl font-black text-slate-900">{selectedUser.name}</h2>
                        <span className="text-xs text-slate-500 mt-1">{selectedUser.role}</span>
                        <div className="flex gap-2 mt-4 w-full">
                            <button 
                                onClick={() => openEditModal(selectedUser)}
                                className="flex-1 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
                            >
                                编辑资料
                            </button>
                            <button 
                                onClick={() => toggleStatus(selectedUser.id)}
                                className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200"
                            >
                                {selectedUser.status === 'active' ? '停用账号' : '启用账号'}
                            </button>
                        </div>
                    </div>
                    <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">账号信息</h4>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">工号</span>
                                    <span className="font-medium text-slate-900">SUP-{selectedUser.id.toUpperCase()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">手机</span>
                                    <span className="font-medium text-slate-900">{selectedUser.phone}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">邮箱</span>
                                    <span className="font-medium text-slate-900">{selectedUser.email}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">最后登录</span>
                                    <span className="font-medium text-slate-900">{selectedUser.lastLogin}</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                <Key size={12} /> 权限范围
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded border border-blue-100">报价管理</span>
                                <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded border border-blue-100">订单处理</span>
                                <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded border border-blue-100">发货操作</span>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                <Clock size={12} /> 近期动态
                            </h4>
                            <div className="pl-4 border-l-2 border-slate-100 space-y-4">
                                {[1,2,3].map(i => (
                                    <div key={i} className="relative">
                                        <div className="absolute -left-[21px] top-1 w-3 h-3 bg-slate-200 rounded-full border-2 border-white"></div>
                                        <p className="text-xs text-slate-900 font-bold">处理订单 PO-2023110{i}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">2023-11-0{i} 14:30</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
              </>
          ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
                  <User size={48} className="mb-4 opacity-20" />
                  <p className="text-sm">点击左侧列表查看员工详情</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default SupplierUsers;
