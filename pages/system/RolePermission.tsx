
import React, { useState } from 'react';
import { 
  ShieldCheck, Plus, Lock, Save, Layout, Database, CheckSquare, Square, User
} from 'lucide-react';
import { DeptNode } from './OrgManagement';

// Reusing minimal data for role permission to simulate self-contained module
const initialDepts: DeptNode[] = [
  { 
    id: 'd1', name: '智采云集团总部', expanded: true, count: 120, manager: '张总', description: '集团核心管理决策中心',
    children: [
      { id: 'd2', name: '研发中心', count: 45, expanded: true, manager: '李技术', description: '负责SaaS平台核心功能迭代与技术架构升级', children: [
         { id: 'd2-1', name: '前端平台组', count: 12, manager: '王前端' },
      ]},
      { id: 'd3', name: '采购部', count: 25, manager: '张建国', description: '统筹全集团物资寻源、采购执行与供应商管理', children: [] },
    ]
  }
];

const mockMembers = [
  { id: 'u1', name: '张建国', roleId: 'r2', deptId: 'd3' },
  { id: 'u2', name: '李晓明', roleId: 'r3', deptId: 'd3' },
  { id: 'u3', name: '王大力', roleId: 'r3', deptId: 'd3' },
];

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

const RolePermission: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('r2');
  
  const currentRole = roles.find(r => r.id === selectedRoleId) || roles[0];
  const linkedMembers = mockMembers.filter(m => m.roleId === selectedRoleId);

  const findDeptName = (nodes: DeptNode[], id: string): string => {
    for (const node of nodes) {
      if (node.id === id) return node.name;
      if (node.children) {
        const found = findDeptName(node.children, id);
        if (found) return found;
      }
    }
    return '';
  };

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
                                 <p className="text-xs text-slate-400 truncate">{findDeptName(initialDepts, m.deptId)}</p>
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

export default RolePermission;
