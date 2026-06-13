
import React, { useState } from 'react';
import { 
  Workflow, Plus, ChevronRight, X, Layout, 
  CreditCard, UserPlus, FileText, Plane, Package,
  User, UserCheck, Send, GitBranch, TextCursor, Hash, Calendar as CalendarIcon, List,
  ChevronLeft, ZoomIn, ZoomOut, Maximize, Trash2
} from 'lucide-react';

// --- Types ---
type FormFieldType = 'input' | 'textarea' | 'number' | 'money' | 'date' | 'date_range' | 'select' | 'multi_select' | 'upload' | 'dept_user';

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[]; // For select/radio
  props?: any;
}

type FlowNodeType = 'start' | 'approver' | 'notifier' | 'route' | 'condition' | 'end';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  name?: string;
  content?: string;
  props?: any;
  childNode?: FlowNode | null;
  conditionNodes?: FlowNode[]; // For route nodes
}

export interface WorkflowDef {
  id: string;
  name: string;
  group: string;
  description: string;
  icon: any;
  status: 'active' | 'draft';
  updatedAt: string;
  formFields: FormField[];
  flowData: FlowNode;
}

// --- Mock Data ---
const generateInitialFlow = (): FlowNode => ({
  id: 'root',
  type: 'start',
  name: '发起人',
  content: '所有人',
  childNode: {
    id: 'n1',
    type: 'approver',
    name: '部门主管',
    content: '直接主管',
    childNode: {
      id: 'n2',
      type: 'route',
      childNode: {
        id: 'n4',
        type: 'notifier',
        name: '抄送人',
        content: '发起人本人',
        childNode: {
          id: 'end',
          type: 'end',
          name: '流程结束'
        }
      },
      conditionNodes: [
        {
          id: 'c1',
          type: 'condition',
          name: '金额 < 5000',
          content: '系统自动通过',
          childNode: null
        },
        {
          id: 'c2',
          type: 'condition',
          name: '金额 ≥ 5000',
          content: '需高级审批',
          childNode: {
            id: 'n3',
            type: 'approver',
            name: '财务总监',
            content: '王总',
            childNode: null
          }
        }
      ]
    }
  }
});

const defaultFormFields: FormField[] = [
  { id: 'f1', type: 'input', label: '申请事由', required: true, placeholder: '请输入申请事由' },
  { id: 'f2', type: 'money', label: '预估金额', required: true, placeholder: '0.00' },
  { id: 'f3', type: 'select', label: '费用类型', required: false, placeholder: '请选择', options: ['差旅费', '招待费', '采购费'] }
];

const mockWorkflows: WorkflowDef[] = [
  {
    id: 'wf-001',
    name: '采购立项审批',
    group: '采购业务',
    description: '适用于非生产性物资采购申请',
    icon: Package,
    status: 'active',
    updatedAt: '2023-10-25',
    formFields: defaultFormFields,
    flowData: generateInitialFlow()
  },
  {
    id: 'wf-002',
    name: '供应商准入审批',
    group: '采购业务',
    description: '新供应商引进资质审核流程',
    icon: UserPlus,
    status: 'active',
    updatedAt: '2023-10-20',
    formFields: [],
    flowData: generateInitialFlow()
  },
  {
    id: 'wf-003',
    name: '合同签署审批',
    group: '法务财务',
    description: '标准采购合同用印申请',
    icon: FileText,
    status: 'active',
    updatedAt: '2023-10-15',
    formFields: [],
    flowData: generateInitialFlow()
  },
  {
    id: 'wf-004',
    name: '付款申请',
    group: '法务财务',
    description: '对公付款及预付款申请',
    icon: CreditCard,
    status: 'active',
    updatedAt: '2023-10-28',
    formFields: [],
    flowData: generateInitialFlow()
  },
  {
    id: 'wf-005',
    name: '出差报销',
    group: '行政人事',
    description: '员工差旅费用报销流程',
    icon: Plane,
    status: 'draft',
    updatedAt: '2023-10-01',
    formFields: [],
    flowData: generateInitialFlow()
  }
];

const WorkflowSettings: React.FC = () => {
  // View Modes: 'list' (groups) | 'editor' (form/flow)
  const [workflowView, setWorkflowView] = useState<'list' | 'editor'>('list');
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('edit');
  const [createStep, setCreateStep] = useState<1 | 2>(1); // 1: Form, 2: Flow
  
  // Editor State
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDef | null>(null);
  const [editorTab, setEditorTab] = useState<'forms' | 'flows'>('forms'); // Used in 'edit' mode

  // Form Designer State
  const [formFields, setFormFields] = useState<FormField[]>(defaultFormFields);
  const [activeFieldId, setActiveFieldId] = useState<string | null>('f1');

  // Flow Designer State
  const [flowData, setFlowData] = useState<FlowNode>(generateInitialFlow());
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // --- Helper Functions ---

  const handleEditWorkflow = (workflow: WorkflowDef) => {
    setEditingWorkflow(workflow);
    setFormFields(workflow.formFields);
    setFlowData(workflow.flowData);
    setEditorMode('edit');
    setEditorTab('forms');
    setWorkflowView('editor');
  };

  const handleCreateWorkflow = () => {
    const newWorkflow: WorkflowDef = {
      id: `wf-${Date.now()}`,
      name: '未命名流程',
      group: '其他业务',
      description: '请输入流程描述',
      icon: Layout,
      status: 'draft',
      updatedAt: new Date().toISOString().split('T')[0],
      formFields: defaultFormFields,
      flowData: generateInitialFlow()
    };
    setEditingWorkflow(newWorkflow);
    setFormFields(defaultFormFields);
    setFlowData(generateInitialFlow());
    setEditorMode('create');
    setCreateStep(1);
    setWorkflowView('editor');
  };

  const handleSaveWorkflow = () => {
    // Logic to save to backend or update local list
    setWorkflowView('list');
    setEditingWorkflow(null);
  };

  const addFormField = (type: FormFieldType, label: string) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type,
      label,
      required: false,
      placeholder: '请输入',
      options: type.includes('select') ? ['选项1', '选项2'] : undefined
    };
    setFormFields([...formFields, newField]);
    setActiveFieldId(newField.id);
  };

  const updateFormField = (id: string, updates: Partial<FormField>) => {
    setFormFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFormField = (id: string) => {
    setFormFields(prev => prev.filter(f => f.id !== id));
    if (activeFieldId === id) setActiveFieldId(null);
  };

  const activeField = formFields.find(f => f.id === activeFieldId);

  // Flow Operations
  // Simple deep update helper
  const updateFlowTree = (root: FlowNode, nodeId: string, updateFn: (n: FlowNode) => FlowNode): FlowNode => {
    if (root.id === nodeId) return updateFn(root);
    const newRoot = { ...root };
    if (newRoot.childNode) {
      newRoot.childNode = updateFlowTree(newRoot.childNode, nodeId, updateFn);
    }
    if (newRoot.conditionNodes) {
      newRoot.conditionNodes = newRoot.conditionNodes.map(c => updateFlowTree(c, nodeId, updateFn));
    }
    return newRoot;
  };

  // Helper to add node after a specific node
  const addNodeAfter = (root: FlowNode, targetNodeId: string, type: FlowNodeType): FlowNode => {
    const newNode: FlowNode = {
      id: `node_${Date.now()}`,
      type,
      name: type === 'approver' ? '新审批人' : type === 'notifier' ? '新抄送人' : '条件分支',
      content: '请配置',
      childNode: null
    };

    if (type === 'route') {
      // Special logic for route: add 2 conditions by default
      newNode.name = '路由分支';
      newNode.conditionNodes = [
        { id: `c1_${Date.now()}`, type: 'condition', name: '条件1', content: '请设置条件', childNode: null },
        { id: `c2_${Date.now()}`, type: 'condition', name: '条件2', content: '请设置条件', childNode: null }
      ];
    }

    // Deep traverse to find target and insert
    const traverse = (node: FlowNode): FlowNode => {
      if (node.id === targetNodeId) {
        // Insert newNode after current node
        const oldChild = node.childNode;
        newNode.childNode = oldChild;
        return { ...node, childNode: newNode };
      }
      
      // If it's a route node, traverse conditions too
      if (node.conditionNodes) {
        return {
          ...node,
          conditionNodes: node.conditionNodes.map(c => traverse(c)),
          childNode: node.childNode ? traverse(node.childNode) : null
        };
      }

      // Normal traversal
      if (node.childNode) {
        return { ...node, childNode: traverse(node.childNode) };
      }

      return node;
    };

    return traverse(root);
  };

  const deleteNode = (root: FlowNode, nodeId: string): FlowNode => {
    const traverse = (node: FlowNode): FlowNode | null => {
      if (node.id === nodeId) {
        return node.childNode || null; // Return child to skip current
      }
      if (node.conditionNodes) {
        // If deleting a condition node inside a route? 
        // Typically we delete the whole route if only 1 condition remains, but for simplicity here:
        const newConditions = node.conditionNodes
          .map(c => c.id === nodeId ? null : traverse(c))
          .filter(Boolean) as FlowNode[];
        
        return {
          ...node,
          conditionNodes: newConditions,
          childNode: node.childNode ? traverse(node.childNode) : null
        };
      }
      if (node.childNode) {
        // Check if child is the target
        if (node.childNode.id === nodeId) {
           // Skip child
           return { ...node, childNode: node.childNode.childNode };
        }
        return { ...node, childNode: traverse(node.childNode) };
      }
      return node;
    };
    // Root special case handled by wrapper if needed, but root usually is Start node which can't be deleted.
    return traverse(root) as FlowNode;
  };

  const handleAddNode = (parentId: string, type: FlowNodeType) => {
    setFlowData(prev => addNodeAfter(prev, parentId, type));
  };

  const handleDeleteNode = (nodeId: string) => {
    if (nodeId === 'root' || nodeId === 'end') return;
    setFlowData(prev => deleteNode(prev, nodeId));
    if (selectedNode?.id === nodeId) setSelectedNode(null);
  };

  const handleUpdateNode = (nodeId: string, updates: Partial<FlowNode>) => {
    setFlowData(prev => updateFlowTree(prev, nodeId, n => ({ ...n, ...updates })));
    setSelectedNode(prev => prev ? { ...prev, ...updates } : null);
  };

  // List Mode
  if (workflowView === 'list') {
      return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <Workflow className="text-blue-600" size={20} /> 流程引擎
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">可视化配置业务审批流与表单</p>
              </div>
              <button 
                onClick={handleCreateWorkflow}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
              >
                  <Plus size={18} /> 新建流程
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockWorkflows.map((wf, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                          <wf.icon size={24} />
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-bold ${wf.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                          {wf.status === 'active' ? '已启用' : '草稿'}
                        </div>
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 mb-1">{wf.name}</h3>
                    <p className="text-xs text-slate-500 mb-4 h-8 line-clamp-2">{wf.description}</p>
                    
                    <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                        <span className="text-xs text-slate-400">更新于 {wf.updatedAt}</span>
                        <button 
                          onClick={() => handleEditWorkflow(wf)}
                          className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          配置
                        </button>
                    </div>
                  </div>
              ))}
            </div>
        </div>
      );
  }

  // --- Flow Designer Renderer Sub-components ---
  
  const AddButton = ({ onClick }: { onClick: () => void }) => (
    <div className="group relative w-full h-12 flex items-center justify-center">
        <div className="absolute w-0.5 h-full bg-slate-300 left-1/2 -translate-x-1/2 group-hover:bg-blue-400 transition-colors"></div>
        <button 
          onClick={onClick}
          className="relative z-10 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md hover:scale-125 transition-all hover:shadow-blue-300"
        >
          <Plus size={14} />
        </button>
    </div>
  );

  const AddPopover = ({ parentId }: { parentId: string }) => {
      const [open, setOpen] = useState(false);
      return (
        <div className="group relative w-full h-16 flex items-center justify-center">
            <div className="absolute w-0.5 h-full bg-slate-300 left-1/2 -translate-x-1/2"></div>
            <div className="relative z-10">
              {!open ? (
                  <button 
                    onClick={() => setOpen(true)}
                    className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                  >
                    <Plus size={18} />
                  </button>
              ) : (
                  <div className="flex gap-2 bg-white p-2 rounded-xl shadow-xl border border-slate-100 animate-in zoom-in duration-200">
                    <button onClick={() => { handleAddNode(parentId, 'approver'); setOpen(false); }} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-50 rounded-lg text-slate-600">
                        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><UserCheck size={16} /></div>
                        <span className="text-[10px]">审批</span>
                    </button>
                    <button onClick={() => { handleAddNode(parentId, 'notifier'); setOpen(false); }} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-50 rounded-lg text-slate-600">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Send size={16} /></div>
                        <span className="text-[10px]">抄送</span>
                    </button>
                    <button onClick={() => { handleAddNode(parentId, 'route'); setOpen(false); }} className="flex flex-col items-center gap-1 p-2 hover:bg-slate-50 rounded-lg text-slate-600">
                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><GitBranch size={16} /></div>
                        <span className="text-[10px]">分支</span>
                    </button>
                    <button onClick={() => setOpen(false)} className="w-6 h-6 self-start text-slate-400 hover:text-red-500"><X size={14}/></button>
                  </div>
              )}
            </div>
        </div>
      );
  };

  const NodeCard = ({ node }: { node: FlowNode }) => {
      const isSelected = selectedNode?.id === node.id;
      let colorClass = 'border-slate-300';
      let icon = <User size={16} />;
      let bgHeader = 'bg-slate-50';
      
      if (node.type === 'start') {
        return (
            <div className="flex flex-col items-center">
              <div 
                onClick={() => setSelectedNode(node)}
                className={`px-6 py-3 rounded-full bg-blue-600 text-white font-bold shadow-lg cursor-pointer hover:scale-105 transition-all ${isSelected ? 'ring-4 ring-blue-200' : ''}`}
              >
                  {node.name}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 bg-white px-2 py-0.5 rounded-full border shadow-sm">{node.content}</div>
            </div>
        );
      }

      if (node.type === 'end') {
        return (
            <div className="flex flex-col items-center justify-center mt-2">
              <div className="w-3 h-3 bg-slate-300 rounded-full mb-1"></div>
              <span className="text-xs text-slate-400 font-bold">流程结束</span>
            </div>
        );
      }

      if (node.type === 'approver') {
        colorClass = 'border-l-4 border-l-orange-500';
        bgHeader = 'bg-orange-50 text-orange-700';
        icon = <UserCheck size={16} />;
      } else if (node.type === 'notifier') {
        colorClass = 'border-l-4 border-l-blue-500';
        bgHeader = 'bg-blue-50 text-blue-700';
        icon = <Send size={16} />;
      } else if (node.type === 'condition') {
        colorClass = 'border-l-4 border-l-green-500';
        bgHeader = 'bg-green-50 text-green-700';
        icon = <GitBranch size={16} />;
      }

      return (
        <div 
          onClick={(e) => { e.stopPropagation(); setSelectedNode(node); }}
          className={`w-64 bg-white rounded-lg shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-all relative group ${colorClass} ${isSelected ? 'ring-2 ring-blue-400 shadow-md' : ''}`}
        >
            <div className={`flex items-center justify-between px-3 py-2 border-b border-slate-100 rounded-t-lg ${bgHeader}`}>
              <div className="flex items-center gap-2 text-xs font-bold">
                  {icon} {node.name}
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }} className="opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity">
                  <X size={14} />
              </button>
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between text-sm text-slate-700">
                  <span>{node.content || '请设置'}</span>
                  <ChevronRight size={14} className="text-slate-300" />
              </div>
            </div>
        </div>
      );
  };

  const FlowRenderer = ({ node }: { node: FlowNode }) => {
      if (!node) return null;

      if (node.type === 'route' && node.conditionNodes) {
        return (
            <div className="flex flex-col items-center">
              <div className="relative flex justify-center gap-12 py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 px-4">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-slate-300"></div>
                  
                  {/* Draw connecting lines for branches - simplified with CSS/Divs */}
                  <div className="absolute top-0 w-full h-0.5 bg-slate-300 left-0"></div>

                  {node.conditionNodes.map((cNode, i) => (
                    <div key={cNode.id} className="flex flex-col items-center relative">
                        {/* Vertical line connector from top horizontal bar */}
                        <div className="absolute -top-6 w-0.5 h-6 bg-slate-300"></div>
                        
                        <NodeCard node={cNode} />
                        <AddPopover parentId={cNode.id} />
                        {cNode.childNode && <FlowRenderer node={cNode.childNode} />}
                    </div>
                  ))}
              </div>
              <AddPopover parentId={node.id} />
              {node.childNode && <FlowRenderer node={node.childNode} />}
            </div>
        );
      }

      return (
        <div className="flex flex-col items-center">
            <NodeCard node={node} />
            {node.type !== 'end' && (
              <>
                  <AddPopover parentId={node.id} />
                  {node.childNode && <FlowRenderer node={node.childNode} />}
              </>
            )}
        </div>
      );
  };

  // --- Main Editor Layout ---
  return (
      <div className="h-[calc(100vh-140px)] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Editor Header */}
        <div className="h-16 border-b border-slate-200 flex justify-between items-center px-6 bg-slate-50/50">
            <div className="flex items-center gap-4">
              <button onClick={() => setWorkflowView('list')} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500">
                  <ChevronLeft size={20} />
              </button>
              <div className="h-6 w-px bg-slate-300"></div>
              <h2 className="font-bold text-slate-900">{editingWorkflow?.name || '新建流程'}</h2>
            </div>
            
            <div className="flex bg-slate-200 p-1 rounded-lg">
              <button 
                onClick={() => setEditorTab('forms')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${editorTab === 'forms' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                  表单设计
              </button>
              <button 
                onClick={() => setEditorTab('flows')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${editorTab === 'flows' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                  流程设计
              </button>
            </div>

            <div className="flex gap-3">
              <button className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100">预览</button>
              <button onClick={handleSaveWorkflow} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800">发布流程</button>
            </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 bg-slate-100 p-0 overflow-hidden relative flex">
            
            {editorTab === 'forms' ? (
              <div className="flex gap-4 h-full w-full p-4">
                  {/* Left: Components */}
                  <div className="w-64 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">基础组件</h4>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                          { type: 'input', label: '单行文本', icon: TextCursor },
                          { type: 'textarea', label: '多行文本', icon: FileText },
                          { type: 'number', label: '数字', icon: Hash },
                          { type: 'money', label: '金额', icon: CreditCard },
                          { type: 'date', label: '日期', icon: CalendarIcon },
                          { type: 'select', label: '下拉选', icon: List },
                        ].map((c, i) => (
                          <button 
                            key={i}
                            onClick={() => addFormField(c.type as any, c.label)}
                            className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-100 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-all"
                          >
                              <c.icon size={20} className="mb-2 text-slate-400" />
                              <span className="text-xs font-bold">{c.label}</span>
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Center: Canvas */}
                  <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-8 overflow-y-auto">
                    <div className="max-w-xl mx-auto space-y-4">
                        {formFields.map((field) => (
                          <div 
                            key={field.id}
                            onClick={() => setActiveFieldId(field.id)}
                            className={`group relative p-4 rounded-xl border-2 transition-all cursor-pointer ${activeFieldId === field.id ? 'border-blue-500 bg-blue-50/20' : 'border-transparent hover:border-slate-200 bg-slate-50'}`}
                          >
                              <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-bold text-slate-700">
                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                </label>
                                {activeFieldId === field.id && (
                                    <button onClick={(e) => { e.stopPropagation(); removeFormField(field.id); }} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                                )}
                              </div>
                              <div className="h-10 bg-white border border-slate-200 rounded-lg w-full flex items-center px-3 text-sm text-slate-400">
                                {field.placeholder}
                              </div>
                          </div>
                        ))}
                        {formFields.length === 0 && (
                          <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                              请从左侧点击添加组件
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Right: Properties */}
                  <div className="w-72 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">组件属性</h4>
                    {activeField ? (
                        <div className="space-y-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">标题</label>
                              <input 
                                type="text" 
                                value={activeField.label} 
                                onChange={(e) => updateFormField(activeField.id, { label: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" 
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">提示文字</label>
                              <input 
                                type="text" 
                                value={activeField.placeholder} 
                                onChange={(e) => updateFormField(activeField.id, { placeholder: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" 
                              />
                          </div>
                          <div className="flex items-center gap-2">
                              <input 
                                type="checkbox" 
                                checked={activeField.required} 
                                onChange={(e) => updateFormField(activeField.id, { required: e.target.checked })}
                                className="rounded text-blue-600 focus:ring-blue-500" 
                              />
                              <span className="text-sm">必填项</span>
                          </div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 text-center py-10">未选中组件</p>
                    )}
                  </div>
              </div>
            ) : (
              // --- FLOW DESIGNER CANVAS ---
              <>
                  <div className="flex-1 overflow-auto bg-slate-100 p-10 relative cursor-grab active:cursor-grabbing">
                    <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                        <button onClick={() => setZoomLevel(z => Math.min(z + 0.1, 2))} className="p-2 bg-white rounded-lg shadow border border-slate-200 hover:text-blue-600"><ZoomIn size={20}/></button>
                        <button onClick={() => setZoomLevel(z => Math.max(z - 0.1, 0.5))} className="p-2 bg-white rounded-lg shadow border border-slate-200 hover:text-blue-600"><ZoomOut size={20}/></button>
                        <button onClick={() => setZoomLevel(1)} className="p-2 bg-white rounded-lg shadow border border-slate-200 hover:text-blue-600"><Maximize size={20}/></button>
                    </div>
                    
                    <div 
                        className="min-w-full min-h-full flex flex-col items-center transition-transform origin-top"
                        style={{ transform: `scale(${zoomLevel})` }}
                    >
                        <FlowRenderer node={flowData} />
                    </div>
                  </div>

                  {/* Right: Flow Properties Panel */}
                  <div className={`w-80 bg-white border-l border-slate-200 shadow-xl z-20 transition-all duration-300 absolute right-0 top-0 bottom-0 ${selectedNode ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="flex justify-between items-center p-4 border-b border-slate-100">
                        <h3 className="font-bold text-slate-900">节点属性</h3>
                        <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><X size={18}/></button>
                    </div>
                    {selectedNode ? (
                        <div className="p-4 space-y-6">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">节点名称</label>
                              <input 
                                type="text" 
                                value={selectedNode.name} 
                                onChange={(e) => handleUpdateNode(selectedNode.id, { name: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" 
                              />
                          </div>
                          
                          {selectedNode.type === 'approver' && (
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">审批人设置</label>
                                <div className="space-y-2">
                                    {['指定成员', '部门主管', '发起人自选', '角色'].map(type => (
                                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                                          <input type="radio" name="approverType" defaultChecked={type === '指定成员'} className="text-blue-600 focus:ring-blue-500" />
                                          <span className="text-sm text-slate-700">{type}</span>
                                      </label>
                                    ))}
                                </div>
                                <div className="mt-4">
                                    <button className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold border border-blue-100 hover:bg-blue-100">+ 选择成员</button>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <span className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-600 flex items-center gap-1">
                                          张建国 <X size={12} className="cursor-pointer hover:text-red-500" />
                                      </span>
                                    </div>
                                </div>
                              </div>
                          )}

                          {selectedNode.type === 'condition' && (
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">条件规则</label>
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-500 text-center">
                                    <p>点击配置筛选条件</p>
                                    <button className="mt-2 text-blue-600 font-bold hover:underline">设置条件</button>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">显示内容</label>
                                    <input 
                                      type="text" 
                                      value={selectedNode.content} 
                                      onChange={(e) => handleUpdateNode(selectedNode.id, { content: e.target.value })}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" 
                                    />
                                </div>
                              </div>
                          )}
                        </div>
                    ) : (
                        <div className="p-10 text-center text-slate-400">
                          请选择节点
                        </div>
                    )}
                  </div>
              </>
            )}
        </div>
      </div>
  );
};

export default WorkflowSettings;
