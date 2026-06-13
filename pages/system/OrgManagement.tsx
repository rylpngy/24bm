
import React, { useState } from 'react';
import { 
  Network, Search, Filter, Plus, Building, Calendar, Users, User, Phone, Mail, Edit3, Trash2, MoreVertical, UploadCloud, ChevronDown, X, Save, Briefcase, ChevronRight, FolderPlus, UserPlus
} from 'lucide-react';

// --- Types ---
export interface DeptNode {
  id: string;
  name: string;
  count?: number;
  manager?: string;
  description?: string;
  expanded?: boolean;
  children?: DeptNode[];
}

export interface Member {
  id: string;
  name: string;
  avatar?: string;
  roleId: string; // Linked to Role
  deptId: string;
  jobNo: string;
  phone: string;
  email: string;
  position: string;
  status: 'active' | 'inactive';
  joinDate: string;
}

const initialDepts: DeptNode[] = [
  { 
    id: 'd1', name: '智采云集团总部', expanded: true, count: 120, manager: '张总', description: '集团核心管理决策中心，负责制定集团战略发展规划。',
    children: [
      { id: 'd2', name: '研发中心', count: 45, expanded: true, manager: '李技术', description: '负责SaaS平台核心功能迭代与技术架构升级', children: [
         { id: 'd2-1', name: '前端平台组', count: 12, manager: '王前端' },
         { id: 'd2-2', name: '后端服务组', count: 18, manager: '赵后端' },
         { id: 'd2-3', name: 'AI 算法组', count: 8, manager: '钱算法' },
         { id: 'd2-4', name: '测试运维组', count: 7, manager: '孙运维' },
      ]},
      { id: 'd3', name: '采购部', count: 25, manager: '张建国', description: '统筹全集团物资寻源、采购执行与供应商管理', children: [] },
      { id: 'd4', name: '财务部', count: 12, manager: '周财务', description: '负责集团财务核算、资金管理及税务筹划。', children: [] },
      { id: 'd5', name: '行政部', count: 8, manager: '吴行政', description: '负责公司行政后勤保障及资产管理。', children: [] },
      { id: 'd6', name: '市场营销部', count: 30, manager: '郑市场', description: '负责品牌推广及市场拓展业务。', children: [] },
    ]
  }
];

const mockMembers: Member[] = [
  { id: 'u1', name: '张建国', roleId: 'r2', deptId: 'd3', jobNo: 'ZC001', phone: '13800138000', email: 'zhang.jg@zhicai.com', position: '采购总监', status: 'active', joinDate: '2019-03-15' },
  { id: 'u2', name: '李晓明', roleId: 'r3', deptId: 'd3', jobNo: 'ZC005', phone: '13912345678', email: 'li.xm@zhicai.com', position: '高级采购经理', status: 'active', joinDate: '2020-06-20' },
  { id: 'u3', name: '王大力', roleId: 'r3', deptId: 'd3', jobNo: 'ZC012', phone: '13766668888', email: 'wang.dl@zhicai.com', position: '采购专员', status: 'active', joinDate: '2021-02-10' },
  { id: 'u4', name: '赵敏', roleId: 'r3', deptId: 'd2-1', jobNo: 'ZC015', phone: '15011112222', email: 'zhao.min@zhicai.com', position: '前端工程师', status: 'active', joinDate: '2021-08-05' },
  { id: 'u5', name: '孙悟空', roleId: 'r5', deptId: 'd4', jobNo: 'ZC099', phone: '18800009999', email: 'sun.wk@zhicai.com', position: '审计实习生', status: 'inactive', joinDate: '2023-01-01' },
];

const OrgManagement: React.FC = () => {
  const [depts, setDepts] = useState<DeptNode[]>(initialDepts);
  const [members, setMembers] = useState<Member[]>(mockMembers);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('d3'); 
  const [memberSearch, setMemberSearch] = useState('');
  
  // Member Modal State
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberEditMode, setMemberEditMode] = useState(false);
  const [currentMemberForm, setCurrentMemberForm] = useState<Partial<Member>>({
    name: '', jobNo: '', phone: '', email: '', position: '', status: 'active', roleId: 'r3'
  });

  // Dept Modal State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptEditMode, setDeptEditMode] = useState(false); // true for edit, false for add sub-dept
  const [currentDeptForm, setCurrentDeptForm] = useState<{ id?: string, name: string, manager: string, description: string }>({
    name: '', manager: '', description: ''
  });

  // --- Helper Functions ---

  const findDept = (nodes: DeptNode[], id: string): DeptNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findDept(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const currentDept = findDept(depts, selectedDeptId);

  // --- Dept Operations ---

  const handleOpenAddDept = () => {
    setDeptEditMode(false);
    setCurrentDeptForm({ name: '', manager: '', description: '' });
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDept = () => {
    if (!currentDept) return;
    setDeptEditMode(true);
    setCurrentDeptForm({
      id: currentDept.id,
      name: currentDept.name,
      manager: currentDept.manager || '',
      description: currentDept.description || ''
    });
    setIsDeptModalOpen(true);
  };

  const handleSaveDept = () => {
    if (!currentDeptForm.name) {
      alert("请输入部门名称");
      return;
    }

    if (deptEditMode && currentDeptForm.id) {
      // Edit Dept Logic
      const updateRecursive = (nodes: DeptNode[]): DeptNode[] => {
        return nodes.map(node => {
          if (node.id === currentDeptForm.id) {
            return { ...node, name: currentDeptForm.name, manager: currentDeptForm.manager, description: currentDeptForm.description };
          }
          if (node.children) {
            return { ...node, children: updateRecursive(node.children) };
          }
          return node;
        });
      };
      setDepts(updateRecursive(depts));
    } else {
      // Add Sub-Dept Logic
      const newDept: DeptNode = {
        id: `d-${Date.now()}`,
        name: currentDeptForm.name,
        manager: currentDeptForm.manager,
        description: currentDeptForm.description,
        count: 0,
        expanded: true,
        children: []
      };
      
      const addRecursive = (nodes: DeptNode[]): DeptNode[] => {
        return nodes.map(node => {
          if (node.id === selectedDeptId) {
            return { ...node, children: [...(node.children || []), newDept], expanded: true };
          }
          if (node.children) {
            return { ...node, children: addRecursive(node.children) };
          }
          return node;
        });
      };
      setDepts(addRecursive(depts));
    }
    setIsDeptModalOpen(false);
  };

  const handleDeleteDept = () => {
    if (!currentDept) return;
    if (confirm(`确定要删除部门 "${currentDept.name}" 吗？此操作不可恢复。`)) {
      // Cannot delete root for simplicity in this demo, or handle carefully
      if (currentDept.id === 'd1') {
        alert("无法删除根部门");
        return;
      }
      
      const deleteRecursive = (nodes: DeptNode[]): DeptNode[] => {
        return nodes.filter(node => node.id !== currentDept.id).map(node => {
          if (node.children) {
            return { ...node, children: deleteRecursive(node.children) };
          }
          return node;
        });
      };
      setDepts(deleteRecursive(depts));
      setSelectedDeptId('d1'); // Reset to root
    }
  };

  // --- Member Operations ---

  const handleOpenAddMember = () => {
    setMemberEditMode(false);
    setCurrentMemberForm({
      name: '', jobNo: '', phone: '', email: '', position: '', status: 'active', roleId: 'r3'
    });
    setIsMemberModalOpen(true);
  };

  const handleOpenEditMember = (member: Member) => {
    setMemberEditMode(true);
    setCurrentMemberForm({ ...member });
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = () => {
    if (!currentMemberForm.name || !currentMemberForm.jobNo) {
      alert("请填写必填项");
      return;
    }

    if (memberEditMode && currentMemberForm.id) {
      // Edit
      setMembers(members.map(m => m.id === currentMemberForm.id ? { ...m, ...currentMemberForm } as Member : m));
    } else {
      // Add
      const newMember: Member = {
        id: `u-${Date.now()}`,
        name: currentMemberForm.name || '',
        roleId: currentMemberForm.roleId || 'r3',
        deptId: selectedDeptId,
        jobNo: currentMemberForm.jobNo || '',
        phone: currentMemberForm.phone || '',
        email: currentMemberForm.email || '',
        position: currentMemberForm.position || '员工',
        status: currentMemberForm.status as 'active' | 'inactive',
        joinDate: new Date().toISOString().split('T')[0]
      };
      setMembers([...members, newMember]);
    }
    setIsMemberModalOpen(false);
  };

  const handleDeleteMember = (id: string) => {
    if(confirm('确认删除该成员吗？')) {
      setMembers(members.filter(m => m.id !== id));
    }
  };

  // --- Renderers ---

  const renderDeptTree = (nodes: DeptNode[], level = 0) => {
    return nodes.map(node => (
      <div key={node.id}>
        <div 
          onClick={() => setSelectedDeptId(node.id)}
          className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm font-medium transition-all mb-1 ${
            selectedDeptId === node.id 
            ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
            : 'text-slate-600 hover:bg-slate-100'
          }`}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {node.children && node.children.length > 0 ? (
               <ChevronDown size={14} className={selectedDeptId === node.id ? 'text-blue-200' : 'text-slate-400'} />
            ) : (
               <div className="w-3.5 h-3.5 shrink-0"></div>
            )}
            <span className="truncate">{node.name}</span>
          </div>
          {node.count !== undefined && (
             <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                selectedDeptId === node.id 
                ? 'bg-white/20 text-white' 
                : 'bg-slate-100 text-slate-400 group-hover:bg-white'
             }`}>
                {node.count}
             </span>
          )}
        </div>
        {node.children && (
          <div>
            {renderDeptTree(node.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const filteredMembers = members.filter(m => {
        const inDept = m.deptId === selectedDeptId; 
        const matchesSearch = m.name.includes(memberSearch) || m.jobNo.includes(memberSearch);
        return inDept && matchesSearch;
  });

  return (
      <div className="flex h-[calc(100vh-140px)] gap-6 animate-in fade-in duration-300 relative">
         
         {/* --- Member Modal --- */}
         {isMemberModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
               <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center p-6 border-b border-slate-100">
                     <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <User size={24} className="text-blue-600"/> {memberEditMode ? '编辑成员' : '添加新成员'}
                     </h3>
                     <button onClick={() => setIsMemberModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                        <X size={24} />
                     </button>
                  </div>
                  
                  <div className="p-8 space-y-6">
                     <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-700 mb-6">
                        <Building size={20} />
                        <span className="font-bold">所属部门：{memberEditMode ? findDept(depts, currentMemberForm.deptId || '')?.name : currentDept?.name}</span>
                     </div>

                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                           <label className="block text-xs font-bold text-slate-500 uppercase">姓名 <span className="text-red-500">*</span></label>
                           <input 
                              type="text" 
                              value={currentMemberForm.name}
                              onChange={(e) => setCurrentMemberForm({...currentMemberForm, name: e.target.value})}
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                              placeholder="请输入姓名"
                           />
                        </div>
                        <div className="space-y-1.5">
                           <label className="block text-xs font-bold text-slate-500 uppercase">工号 <span className="text-red-500">*</span></label>
                           <input 
                              type="text" 
                              value={currentMemberForm.jobNo}
                              onChange={(e) => setCurrentMemberForm({...currentMemberForm, jobNo: e.target.value})}
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                              placeholder="例如：ZC888"
                           />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                           <label className="block text-xs font-bold text-slate-500 uppercase">职位</label>
                           <div className="relative">
                              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <input 
                                 type="text" 
                                 value={currentMemberForm.position}
                                 onChange={(e) => setCurrentMemberForm({...currentMemberForm, position: e.target.value})}
                                 className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                 placeholder="例如：采购专员"
                              />
                           </div>
                        </div>
                        <div className="space-y-1.5">
                           <label className="block text-xs font-bold text-slate-500 uppercase">在职状态</label>
                           <select 
                              value={currentMemberForm.status}
                              onChange={(e) => setCurrentMemberForm({...currentMemberForm, status: e.target.value as any})}
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                           >
                              <option value="active">在职</option>
                              <option value="inactive">离职</option>
                           </select>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                           <label className="block text-xs font-bold text-slate-500 uppercase">手机号</label>
                           <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <input 
                                 type="text" 
                                 value={currentMemberForm.phone}
                                 onChange={(e) => setCurrentMemberForm({...currentMemberForm, phone: e.target.value})}
                                 className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                                 placeholder="13800000000"
                              />
                           </div>
                        </div>
                        <div className="space-y-1.5">
                           <label className="block text-xs font-bold text-slate-500 uppercase">电子邮箱</label>
                           <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <input 
                                 type="email" 
                                 value={currentMemberForm.email}
                                 onChange={(e) => setCurrentMemberForm({...currentMemberForm, email: e.target.value})}
                                 className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                                 placeholder="name@company.com"
                              />
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                     <button 
                        onClick={() => setIsMemberModalOpen(false)}
                        className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
                     >
                        取消
                     </button>
                     <button 
                        onClick={handleSaveMember}
                        className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 shadow-lg flex items-center gap-2"
                     >
                        <Save size={16} /> 确认保存
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* --- Department Modal --- */}
         {isDeptModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
               <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center p-6 border-b border-slate-100">
                     <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <Building size={24} className="text-blue-600"/> {deptEditMode ? '编辑部门' : '添加下级部门'}
                     </h3>
                     <button onClick={() => setIsDeptModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                        <X size={24} />
                     </button>
                  </div>
                  
                  <div className="p-8 space-y-6">
                     <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 uppercase">部门名称 <span className="text-red-500">*</span></label>
                        <input 
                           type="text" 
                           value={currentDeptForm.name}
                           onChange={(e) => setCurrentDeptForm({...currentDeptForm, name: e.target.value})}
                           className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                           placeholder="请输入部门名称"
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 uppercase">负责人</label>
                        <input 
                           type="text" 
                           value={currentDeptForm.manager}
                           onChange={(e) => setCurrentDeptForm({...currentDeptForm, manager: e.target.value})}
                           className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                           placeholder="请输入负责人姓名"
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 uppercase">部门职责</label>
                        <textarea 
                           value={currentDeptForm.description}
                           onChange={(e) => setCurrentDeptForm({...currentDeptForm, description: e.target.value})}
                           className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all h-24 resize-none"
                           placeholder="部门主要职责描述..."
                        />
                     </div>
                  </div>

                  <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                     <button 
                        onClick={() => setIsDeptModalOpen(false)}
                        className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
                     >
                        取消
                     </button>
                     <button 
                        onClick={handleSaveDept}
                        className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 shadow-lg flex items-center gap-2"
                     >
                        <Save size={16} /> 保存
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* Left: Dept Tree */}
         <div className="w-80 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                     <Network size={18} className="text-blue-600"/> 组织架构
                  </h3>
                  <button 
                    onClick={() => {
                        // Special case: Adding root logic could go here, for now strictly inside active dept
                        // For demo, just focus on existing tree operations
                        alert("请选择部门后添加子部门");
                    }}
                    className="p-1.5 hover:bg-white rounded-lg text-slate-500 transition-colors border border-transparent hover:border-slate-200 shadow-sm"
                  >
                     <Plus size={16} />
                  </button>
               </div>
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="搜索部门..." 
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
               {renderDeptTree(depts)}
            </div>
         </div>

         {/* Right: Dept Details & Member List */}
         <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            
            {/* Dept Header Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 shrink-0 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                  <Building size={120} />
               </div>
               <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                           {currentDept?.name}
                           <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                              ID: {currentDept?.id}
                           </span>
                        </h2>
                        <p className="text-slate-500 text-sm mt-2 max-w-2xl">{currentDept?.description || '暂无部门描述'}</p>
                     </div>
                     <div className="flex gap-2">
                        <button 
                            onClick={handleOpenAddDept}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2"
                        >
                           <FolderPlus size={16} /> 添加子部门
                        </button>
                        <button 
                            onClick={handleOpenEditDept}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2"
                        >
                           <Edit3 size={16} /> 编辑
                        </button>
                        <button 
                            onClick={handleDeleteDept}
                            className="px-4 py-2 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2"
                        >
                           <Trash2 size={16} /> 删除
                        </button>
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-8 mt-6 pt-6 border-t border-slate-100">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                           <User size={20} />
                        </div>
                        <div>
                           <p className="text-xs text-slate-400 font-bold uppercase">负责人</p>
                           <p className="text-sm font-bold text-slate-900">{currentDept?.manager || '未设置'}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                           <Users size={20} />
                        </div>
                        <div>
                           <p className="text-xs text-slate-400 font-bold uppercase">成员数</p>
                           <p className="text-sm font-bold text-slate-900">{filteredMembers.length} 人</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                           <Calendar size={20} />
                        </div>
                        <div>
                           <p className="text-xs text-slate-400 font-bold uppercase">成立时间</p>
                           <p className="text-sm font-bold text-slate-900">2018-05-20</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Member List Panel */}
            <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
               <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="搜索成员姓名、工号..." 
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64 transition-all" 
                        />
                     </div>
                     <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-all">
                        <Filter size={18} />
                     </button>
                  </div>
                  <div className="flex gap-3">
                     <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                        <UploadCloud size={16} /> 导入
                     </button>
                     <button 
                        onClick={handleOpenAddMember}
                        className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-800 shadow-lg transition-all"
                     >
                        <UserPlus size={16} /> 添加成员
                     </button>
                  </div>
               </div>

               <div className="flex-1 overflow-auto">
                  <table className="w-full text-sm text-left">
                     <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 sticky top-0 z-10">
                        <tr>
                           <th className="px-6 py-4 w-12 text-center"><input type="checkbox" className="rounded text-blue-600" /></th>
                           <th className="px-6 py-4">姓名 / 工号</th>
                           <th className="px-6 py-4">职位</th>
                           <th className="px-6 py-4">联系方式</th>
                           <th className="px-6 py-4 text-center">状态</th>
                           <th className="px-6 py-4 text-center">操作</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {filteredMembers.map((m) => {
                           return (
                              <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                                 <td className="px-6 py-4 text-center"><input type="checkbox" className="rounded text-blue-600" /></td>
                                 <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                       <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                                          {m.name.charAt(0)}
                                       </div>
                                       <div>
                                          <p className="font-bold text-slate-900">{m.name}</p>
                                          <p className="text-xs text-slate-400 font-mono">{m.jobNo}</p>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4 text-slate-700 font-medium">
                                    {m.position}
                                 </td>
                                 <td className="px-6 py-4">
                                    <p className="text-slate-700 text-xs font-medium flex items-center gap-2 mb-0.5"><Phone size={12} className="text-slate-400"/> {m.phone}</p>
                                    <p className="text-slate-500 text-xs flex items-center gap-2"><Mail size={12} className="text-slate-400"/> {m.email}</p>
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                                       m.status === 'active' 
                                       ? 'bg-green-50 text-green-700 border-green-100' 
                                       : 'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}>
                                       {m.status === 'active' ? '在职' : '离职'}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                       <button 
                                          onClick={() => handleOpenEditMember(m)}
                                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                       >
                                          <Edit3 size={16}/>
                                       </button>
                                       <button 
                                          onClick={() => handleDeleteMember(m.id)}
                                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                       >
                                          <Trash2 size={16}/>
                                       </button>
                                    </div>
                                 </td>
                              </tr>
                           );
                        })}
                        {filteredMembers.length === 0 && (
                           <tr>
                              <td colSpan={6} className="py-20 text-center text-slate-400">
                                 <Users size={48} className="mx-auto mb-4 opacity-20" />
                                 <p className="text-sm font-medium">该部门暂无成员数据</p>
                                 <p className="text-xs mt-1">请点击右上方按钮添加成员</p>
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
               
               {/* Pagination Footer */}
               <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs text-slate-500">
                  <span>共 {filteredMembers.length} 条记录</span>
                  <div className="flex gap-2">
                     <button className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-50" disabled>上一页</button>
                     <button className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-50" disabled>下一页</button>
                  </div>
               </div>
            </div>
         </div>
      </div>
  );
};

export default OrgManagement;
