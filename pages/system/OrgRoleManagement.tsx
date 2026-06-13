
import React, { useState, useEffect } from 'react';
import { 
  Network, ShieldCheck, Search, Filter, MoreHorizontal, 
  FolderTree, User, Mail, Phone, MapPin, Briefcase, 
  UserCog, UserMinus, Building, Edit3, Save, Eye, Key, Shield,
  Plus, Trash2, ChevronRight, ChevronDown, CheckSquare, Square,
  Check, Lock, Globe, Layout, Layers, Database, MoreVertical,
  Calendar, Users, Download, UploadCloud
} from 'lucide-react';

interface OrgRoleManagementProps {
  initialTab?: string; // 'org' | 'permission'
}

// --- Types ---

// Organization Types
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

// Permission Types
export type DataScope = 'all' | 'dept_tree' | 'dept' | 'self';

export interface PermissionNode {
  id: string;
  label: string;
  type: 'module' | 'page' | 'action';
  children?: PermissionNode[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  dataScope: DataScope;
  permissions: string[]; // List of permission IDs
}

// --- Mock Data ---

const initialDepts: DeptNode[] = [
  { 
    id: 'd1', name: '智采云集团总部', expanded: true, count: 120, manager: '张总', description: '集团核心管理决策中心',
    children: [
      { id: 'd2', name: '研发中心', count: 45, expanded: true, manager: '李技术', description: '负责SaaS平台核心功能迭代与技术架构升级', children: [
         { id: 'd2-1', name: '前端平台组', count: 12, manager: '王前端' },
         { id: 'd2-2', name: '后端服务组', count: 18, manager: '赵后端' },
         { id: 'd2-3', name: 'AI 算法组', count: 8, manager: '钱算法' },
         { id: 'd2-4', name: '测试运维组', count: 7, manager: '孙运维' },
      ]},
      { id: 'd3', name: '采购部', count: 25, manager: '张建国', description: '统筹全集团物资寻源、采购执行与供应商管理', children: [] },
      { id: 'd4', name: '财务部', count: 12, manager: '周财务', children: [] },
      { id: 'd5', name: '行政部', count: 8, manager: '吴行政', children: [] },
      { id: 'd6', name: '市场营销部', count: 30, manager: '郑市场', children: [] },
    ]
  }
];

const mockMembers: Member[] = [
  { id: 'u1', name: '张建国', roleId: 'r2', deptId: 'd3', jobNo: 'ZC001', phone: '13800138000', email: 'zhang.jg@zhicai.com', position: '采购总监', status: 'active', joinDate: '2019-03-15' },
  { id: 'u2', name: '李晓明', roleId: 'r3', deptId: 'd3', jobNo: 'ZC005', phone: '13912345678', email: 'li.xm@zhicai.com', position: '高级采购经理', status: 'active', joinDate: '2020-06-20' },
  { id: 'u3', name: '王大力', roleId: 'r3', deptId: 'd3', jobNo: 'ZC012', phone: '13766668888', email: 'wang.dl@zhicai.com', position: '采购专员', status: 'active', joinDate: '2021-02-10' },
  { id: 'u4', name: '赵敏', roleId: 'r3', deptId: 'd2-1', jobNo: 'ZC015', phone: '15011112222', email: 'zhao.min@zhicai.com', position: '供应商管理', status: 'active', joinDate: '2021-08-05' },
  { id: 'u5', name: '孙悟空', roleId: 'r5', deptId: 'd4', jobNo: 'ZC099', phone: '18800009999', email: 'sun.wk@zhicai.com', position: '审计实习生', status: 'inactive', joinDate: '2023-01-01' },
];

// System Permission Tree Definition
const systemPermissions: PermissionNode[] = [
  {
    id: 'srm', label: '供应商管理 (SRM)', type: 'module',
    children: [
      { id: 'srm.list', label: '供应商列表', type: 'page', children: [
        { id: 'srm.list.view', label: '查看', type: 'action' },
        { id: 'srm.list.add', label: '新增', type: 'action' },
        { id: 'srm.list.edit', label: '编辑', type: 'action' },
        { id: 'srm.list.delete', label: '删除', type: 'action' },
      ]},
      { id: 'srm.audit', label: '准入审批', type: 'page', children: [
        { id: 'srm.audit.view', label: '查看', type: 'action' },
        { id: 'srm.audit.approve', label: '审批', type: 'action' },
      ]}
    ]
  },
  {
    id: 'procure', label: '采购执行', type: 'module',
    children: [
      { id: 'procure.inquiry', label: '询比价', type: 'page', children: [
        { id: 'procure.inquiry.view', label: '查看', type: 'action' },
        { id: 'procure.inquiry.create', label: '发起询价', type: 'action' },
        { id: 'procure.inquiry.award', label: '定标', type: 'action' },
      ]},
      { id: 'procure.order', label: '采购订单', type: 'page', children: [
        { id: 'procure.order.view', label: '查看', type: 'action' },
        { id: 'procure.order.create', label: '下达订单', type: 'action' },
      ]}
    ]
  },
  {
    id: 'system', label: '系统设置', type: 'module',
    children: [
      { id: 'system.org', label: '组织架构', type: 'page', children: [{ id: 'system.org.manage', label: '管理', type: 'action' }] },
      { id: 'system.role', label: '角色权限', type: 'page', children: [{ id: 'system.role.manage', label: '管理', type: 'action' }] },
    ]
  }
];

const initialRoles: Role[] = [
    { id: 'r1', name: '超级管理员', description: '拥有系统所有权限，不可删除', isSystem: true, dataScope: 'all', permissions: ['all'] },
    { id: 'r2', name: '采购总监', description: '负责全公司采购业务审批与管理', isSystem: false, dataScope: 'all', permissions: ['srm.list.view', 'srm.list.edit', 'srm.audit.view', 'srm.audit.approve', 'procure.inquiry.view', 'procure.inquiry.create', 'procure.inquiry.award'] },
    { id: 'r3', name: '采购专员', description: '负责日常采购执行', isSystem: false, dataScope: 'self', permissions: ['srm.list.view', 'procure.inquiry.view', 'procure.inquiry.create'] },
    { id: 'r4', name: '财务经理', description: '负责付款与发票审核', isSystem: false, dataScope: 'dept', permissions: ['procure.order.view'] },
    { id: 'r5', name: '审计专员', description: '只读查看所有业务数据', isSystem: false, dataScope: 'all', permissions: ['srm.list.view', 'procure.inquiry.view', 'procure.order.view'] },
];

const OrgRoleManagement: React.FC<OrgRoleManagementProps> = ({ initialTab = 'org' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Org State
  const [depts, setDepts] = useState<DeptNode[]>(initialDepts);
  const [members, setMembers] = useState<Member[]>(mockMembers);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('d3'); 
  const [memberSearch, setMemberSearch] = useState('');
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

  // Role State
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('r2');
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);

  // Sync prop changes to state
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Helper: Find dept details
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

  const currentRole = roles.find(r => r.id === selectedRoleId) || roles[0];
  const currentDept = findDept(depts, selectedDeptId);

  // Helper: Recursive Dept Tree Render
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

  // --- Components: Organization Management ---
  const renderOrgManagement = () => {
    const filteredMembers = members.filter(m => {
        // Simple search logic
        const inDept = m.deptId === selectedDeptId; 
        const matchesSearch = m.name.includes(memberSearch) || m.jobNo.includes(memberSearch);
        return inDept && matchesSearch;
    });

    return (
      <div className="flex h-[calc(100vh-140px)] gap-6 animate-in fade-in duration-300">
         {/* Left: Dept Tree */}
         <div className="w-80 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                     <Network size={18} className="text-blue-600"/> 组织架构
                  </h3>
                  <button className="p-1.5 hover:bg-white rounded-lg text-slate-500 transition-colors border border-transparent hover:border-slate-200 shadow-sm">
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
                        <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors">
                           编辑部门
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
                     <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-800 shadow-lg transition-all">
                        <Plus size={16} /> 添加成员
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
                           <th className="px-6 py-4">系统角色</th>
                           <th className="px-6 py-4">联系方式</th>
                           <th className="px-6 py-4 text-center">状态</th>
                           <th className="px-6 py-4 text-center">操作</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {filteredMembers.map((m) => {
                           const roleName = roles.find(r => r.id === m.roleId)?.name || '未分配';
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
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100">
                                       <Shield size={12} /> {roleName}
                                    </span>
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
                                       <button className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit3 size={16}/></button>
                                       <button className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16}/></button>
                                       <button className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"><MoreVertical size={16}/></button>
                                    </div>
                                 </td>
                              </tr>
                           );
                        })}
                        {filteredMembers.length === 0 && (
                           <tr>
                              <td colSpan={7} className="py-20 text-center text-slate-400">
                                 <UserCog size={48} className="mx-auto mb-4 opacity-20" />
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

  // --- Components: Permission Management ---
  
  const renderPermissionTree = (nodes: PermissionNode[], role: Role, level = 0) => {
     return nodes.map(node => {
        const isChecked = role.permissions.includes('all') || role.permissions.includes(node.id);
        
        return (
           <div key={node.id} className="mb-1">
              <div 
                 className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors ${isChecked ? 'bg-blue-50/50' : ''}`}
                 style={{ paddingLeft: `${level * 20 + 12}px` }}
              >
                 <button 
                    onClick={() => {
                        // Toggle permission mock logic
                        const newPerms = isChecked 
                           ? role.permissions.filter(p => p !== node.id && p !== 'all')
                           : [...role.permissions, node.id];
                        const updatedRoles = roles.map(r => r.id === role.id ? { ...r, permissions: newPerms } : r);
                        setRoles(updatedRoles);
                    }}
                    className={`text-slate-400 hover:text-blue-600 ${isChecked ? 'text-blue-600' : ''}`}
                 >
                    {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                 </button>
                 <span className={`text-sm ${node.type === 'module' ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                    {node.label}
                 </span>
                 {node.type === 'action' && <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded">按钮</span>}
                 {node.type === 'page' && <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded">菜单</span>}
              </div>
              {node.children && renderPermissionTree(node.children, role, level + 1)}
           </div>
        );
     });
  };

  const renderPermissionManagement = () => {
    // Find members with current role
    const linkedMembers = members.filter(m => m.roleId === selectedRoleId);

    return (
      <div className="flex h-[calc(100vh-140px)] gap-6 animate-in fade-in duration-300">
         {/* Left: Role List */}
         <div className="w-80 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
               <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-blue-600"/> 角色列表
               </h3>
               <button className="p-1.5 hover:bg-white rounded-lg text-slate-500 transition-colors border border-transparent hover:border-slate-200 shadow-sm">
                  <Plus size={16} />
               </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
               {roles.map(role => (
                  <div 
                     key={role.id}
                     onClick={() => setSelectedRoleId(role.id)}
                     className={`p-4 rounded-xl cursor-pointer border transition-all ${
                        selectedRoleId === role.id 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-[1.02]' 
                        : 'bg-white text-slate-600 border-transparent hover:bg-slate-50'
                     }`}
                  >
                     <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-sm">{role.name}</span>
                        {role.isSystem && <Lock size={14} className="opacity-50" />}
                     </div>
                     <p className={`text-xs leading-relaxed ${selectedRoleId === role.id ? 'text-blue-100' : 'text-slate-400'}`}>
                        {role.description}
                     </p>
                  </div>
               ))}
            </div>
         </div>

         {/* Right: Permission Config */}
         <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex justify-between items-start">
               <div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">{currentRole.name}</h2>
                  <p className="text-slate-500 text-sm">{currentRole.description}</p>
               </div>
               <div className="flex gap-3">
                  <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-white transition-all">重置</button>
                  <button className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg transition-all flex items-center gap-2">
                     <Save size={16} /> 保存配置
                  </button>
               </div>
            </div>

            <div className="flex-1 overflow-hidden flex">
               {/* Middle: Functional Perms */}
               <div className="flex-1 border-r border-slate-100 flex flex-col">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                     <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2"><Layout size={16}/> 功能权限配置</h4>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                     {renderPermissionTree(systemPermissions, currentRole)}
                  </div>
               </div>

               {/* Right Side: Data Scope & Members */}
               <div className="w-80 flex flex-col bg-slate-50/30">
                  {/* Data Scope Section */}
                  <div className="p-6 border-b border-slate-100">
                     <h4 className="font-bold text-slate-700 text-sm mb-4 flex items-center gap-2"><Database size={16}/> 数据权限范围</h4>
                     <div className="space-y-3">
                        {[
                           { id: 'all', label: '全部数据权限', desc: '可查看所有部门数据' },
                           { id: 'dept_tree', label: '本部门及下级', desc: '可查看所属部门及下级部门' },
                           { id: 'dept', label: '仅本部门', desc: '仅可查看所属部门数据' },
                           { id: 'self', label: '仅本人', desc: '只能查看自己创建的数据' },
                        ].map((scope) => (
                           <label key={scope.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-blue-400 transition-all">
                              <div className="mt-0.5">
                                 <input 
                                    type="radio" 
                                    name="dataScope" 
                                    checked={currentRole.dataScope === scope.id} 
                                    onChange={() => {
                                       const updatedRoles = roles.map(r => r.id === currentRole.id ? { ...r, dataScope: scope.id as DataScope } : r);
                                       setRoles(updatedRoles);
                                    }}
                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500" 
                                 />
                              </div>
                              <div>
                                 <span className="block text-sm font-bold text-slate-700">{scope.label}</span>
                                 <span className="block text-xs text-slate-400 mt-0.5">{scope.desc}</span>
                              </div>
                           </label>
                        ))}
                     </div>
                  </div>

                  {/* Linked Members Section */}
                  <div className="flex-1 p-6 overflow-hidden flex flex-col">
                     <h4 className="font-bold text-slate-700 text-sm mb-4 flex items-center gap-2">
                        <User size={16}/> 关联成员 ({linkedMembers.length})
                     </h4>
                     <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {linkedMembers.map(m => (
                           <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 hover:border-blue-300 transition-colors">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                 {m.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-sm font-bold text-slate-700 truncate">{m.name}</p>
                                 <p className="text-xs text-slate-400 truncate">{findDept(depts, m.deptId)?.name}</p>
                              </div>
                           </div>
                        ))}
                        {linkedMembers.length === 0 && (
                           <div className="text-center py-10 text-slate-400 text-xs">暂无关联成员</div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    );
  };

  return activeTab === 'permission' ? renderPermissionManagement() : renderOrgManagement();
};

export default OrgRoleManagement;
