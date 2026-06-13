
import React, { useState } from 'react';
import { 
  Database, Plus, Search, Filter, MoreHorizontal, 
  Boxes, Layers, UploadCloud, Trash2,
  Edit3, Save, Eye, Package, FileText, FileImage as ImageIcon,
  FolderTree, AlertCircle, Percent, FileCode, X
} from 'lucide-react';

// --- Types ---
export interface MaterialCategory {
  id: string;
  name: string;
  count: number;
  expanded?: boolean;
  children?: MaterialCategory[];
}

export interface MaterialItem {
  id: string;
  code: string;
  name: string;
  spec: string;
  category: string;
  type: string;
  unit: string;
  price: number;
  status: 'active' | 'inactive';
  updateTime: string;
}

// --- Mock Data ---
const initialMaterialCategories: MaterialCategory[] = [
  { id: 'all', name: '全部物料', count: 1250, expanded: true, children: [
    { id: 'cat1', name: '生产物资', count: 850, expanded: true, children: [
       { id: 'cat1-1', name: '原材料', count: 500 },
       { id: 'cat1-2', name: '半成品', count: 200 },
       { id: 'cat1-3', name: '包装材料', count: 150 },
    ]},
    { id: 'cat2', name: 'MRO 工业品', count: 300, children: [
       { id: 'cat2-1', name: '五金工具', count: 120 },
       { id: 'cat2-2', name: '劳保用品', count: 80 },
       { id: 'cat2-3', name: '润滑油脂', count: 100 },
    ]},
    { id: 'cat3', name: '行政办公', count: 100, children: [
       { id: 'cat3-1', name: 'IT 设备', count: 40 },
       { id: 'cat3-2', name: '办公耗材', count: 60 },
    ]},
  ]}
];

const mockMaterials: MaterialItem[] = [
  { id: 'm1', code: '1001001', name: '聚丙烯颗粒 (PP)', spec: 'T30S 工业级', category: '原材料', type: '原料', unit: '吨', price: 7250.00, status: 'active', updateTime: '2023-10-20' },
  { id: 'm2', code: '1002005', name: '304 不锈钢板', spec: '2000*1000*2mm', category: '原材料', type: '原料', unit: '张', price: 450.00, status: 'active', updateTime: '2023-10-18' },
  { id: 'm3', code: '2001012', name: '手电钻', spec: '博世 500W 手持式', category: '五金工具', type: '低值易耗', unit: '把', price: 280.00, status: 'active', updateTime: '2023-09-15' },
  { id: 'm4', code: '2002001', name: '防静电手套', spec: 'L 号', category: '劳保用品', type: '消耗品', unit: '双', price: 3.50, status: 'active', updateTime: '2023-10-01' },
  { id: 'm5', code: '3001008', name: 'MacBook Pro 14"', spec: 'M3 Pro/18G/512G', category: 'IT 设备', type: '固定资产', unit: '台', price: 14999.00, status: 'active', updateTime: '2023-11-01' },
  { id: 'm6', code: '3002003', name: 'A4 复印纸', spec: '70g 500张/包', category: '办公耗材', type: '消耗品', unit: '包', price: 22.00, status: 'active', updateTime: '2023-10-25' },
  { id: 'm7', code: '1003001', name: '瓦楞纸箱', spec: '50*40*30cm 五层', category: '包装材料', type: '辅料', unit: '个', price: 4.20, status: 'inactive', updateTime: '2023-08-10' },
  { id: 'm8', code: '1001005', name: 'HDPE 颗粒', spec: '注塑级', category: '原材料', type: '原料', unit: '吨', price: 8100.00, status: 'active', updateTime: '2023-10-22' },
  { id: 'm9', code: '2001015', name: '活动扳手', spec: '10寸', category: '五金工具', type: '低值易耗', unit: '把', price: 45.00, status: 'active', updateTime: '2023-09-20' },
  { id: 'm10', code: '3002005', name: '订书机', spec: '得力 0306', category: '办公耗材', type: '消耗品', unit: '个', price: 15.00, status: 'active', updateTime: '2023-10-10' },
];

const MaterialMasterData: React.FC = () => {
  const [matCategories, setMatCategories] = useState<MaterialCategory[]>(initialMaterialCategories);
  const [materials, setMaterials] = useState<MaterialItem[]>(mockMaterials);
  const [selectedMatCatId, setSelectedMatCatId] = useState<string>('all');
  const [materialSearch, setMaterialSearch] = useState('');
  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false);
  const [newMatForm, setNewMatForm] = useState<Partial<MaterialItem>>({
    status: 'active',
    category: '原材料',
    unit: '件',
    type: '物资'
  });

  const handleSaveMaterial = () => {
    if (!newMatForm.name || !newMatForm.code) return;
    const newItem: MaterialItem = {
      id: `m${Date.now()}`,
      code: newMatForm.code,
      name: newMatForm.name,
      spec: newMatForm.spec || '-',
      category: newMatForm.category || '未分类',
      type: newMatForm.type || '物资',
      unit: newMatForm.unit || '件',
      price: newMatForm.price || 0,
      status: 'active',
      updateTime: new Date().toISOString().split('T')[0]
    };
    setMaterials([newItem, ...materials]);
    setIsCreatingMaterial(false);
    setNewMatForm({
      status: 'active',
      category: '原材料',
      unit: '件',
      type: '物资'
    });
  };

  // Helper to find category names recursively for filtering
  const getCategoryNames = (categories: MaterialCategory[], id: string): string[] => {
    let names: string[] = [];
    const find = (cats: MaterialCategory[], targetId: string, collecting: boolean) => {
      for (const cat of cats) {
        if (cat.id === targetId || collecting) {
          names.push(cat.name);
          if (cat.children) {
             // Collect all children names
             cat.children.forEach(c => find([c], c.id, true)); 
          }
          if (collecting) return; // if already collecting, keep going down this branch
          if (cat.id === targetId) return; // found target, just return after collection initiated
        }
        if (cat.children) find(cat.children, targetId, false);
      }
    };
    find(categories, id, false);
    return names;
  };

  // Collect valid category names for filtering
  const validCategories = selectedMatCatId === 'all' 
    ? [] 
    : getCategoryNames(matCategories, selectedMatCatId);

  const filteredMaterials = materials.filter(m => {
    const matchSearch = m.name.includes(materialSearch) || m.code.includes(materialSearch);
    // If 'all', show everything. Else, check if material category is in the valid list (exact match of name)
    const matchCategory = selectedMatCatId === 'all' || validCategories.includes(m.category);
    return matchSearch && matchCategory;
  });

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 animate-in fade-in duration-300 relative">
      {/* Create Material Modal */}
      {isCreatingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                 <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <Database size={24} className="text-blue-600"/> 新增物料主数据
                 </h3>
                 <button onClick={() => setIsCreatingMaterial(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                    <X size={24} />
                 </button>
              </div>
              
              <div className="p-8 flex gap-8">
                 {/* Left: Image Upload */}
                 <div className="w-1/3 space-y-4">
                    <div className="w-full aspect-square bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group">
                       <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                          <ImageIcon size={24} className="text-slate-300 group-hover:text-blue-500" />
                       </div>
                       <p className="text-sm font-bold text-slate-500 group-hover:text-blue-600">点击上传图片</p>
                       <p className="text-xs text-slate-400 mt-1">支持 JPG, PNG (Max 5MB)</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 leading-relaxed">
                       <span className="font-bold block mb-1 flex items-center gap-1"><AlertCircle size={12}/> 提示</span>
                       物料编码可自动生成，也可手动输入。建议上传清晰的物料图片以便于识别。
                    </div>
                 </div>

                 {/* Right: Form */}
                 <div className="flex-1 space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                       <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-500 uppercase">物料名称 <span className="text-red-500">*</span></label>
                          <input 
                            type="text" 
                            value={newMatForm.name || ''}
                            onChange={e => setNewMatForm({...newMatForm, name: e.target.value})}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700"
                            placeholder="请输入物料名称"
                          />
                       </div>
                       <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-500 uppercase">物料编码 <span className="text-red-500">*</span></label>
                          <div className="relative">
                             <FileCode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                             <input 
                               type="text" 
                               value={newMatForm.code || ''}
                               onChange={e => setNewMatForm({...newMatForm, code: e.target.value})}
                               className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                               placeholder="自动生成或手动输入"
                             />
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                       <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-500 uppercase">所属分类</label>
                          <select 
                            value={newMatForm.category}
                            onChange={e => setNewMatForm({...newMatForm, category: e.target.value})}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                          >
                             <option>原材料</option>
                             <option>半成品</option>
                             <option>MRO工业品</option>
                             <option>办公用品</option>
                             <option>IT设备</option>
                          </select>
                       </div>
                       <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-500 uppercase">物料属性</label>
                          <select 
                            value={newMatForm.type}
                            onChange={e => setNewMatForm({...newMatForm, type: e.target.value})}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                          >
                             <option>物资</option>
                             <option>资产</option>
                             <option>服务</option>
                             <option>费用</option>
                          </select>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                       <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-500 uppercase">规格型号</label>
                          <input 
                            type="text" 
                            value={newMatForm.spec || ''}
                            onChange={e => setNewMatForm({...newMatForm, spec: e.target.value})}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="如: 50*50mm"
                          />
                       </div>
                       <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-500 uppercase">计量单位</label>
                          <input 
                            type="text" 
                            value={newMatForm.unit || ''}
                            onChange={e => setNewMatForm({...newMatForm, unit: e.target.value})}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="个/箱/吨"
                          />
                       </div>
                    </div>

                    <div className="grid grid-cols-3 gap-5">
                       <div className="col-span-1 space-y-1.5">
                          <label className="block text-xs font-bold text-slate-500 uppercase">参考单价 (元)</label>
                          <input 
                            type="number" 
                            value={newMatForm.price || ''}
                            onChange={e => setNewMatForm({...newMatForm, price: Number(e.target.value)})}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                            placeholder="0.00"
                          />
                       </div>
                       <div className="col-span-1 space-y-1.5">
                          <label className="block text-xs font-bold text-slate-500 uppercase">税率 (%)</label>
                          <div className="relative">
                             <Percent className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                             <input 
                               type="number" 
                               defaultValue={13}
                               className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                             />
                          </div>
                       </div>
                       <div className="col-span-1 space-y-1.5">
                          <label className="block text-xs font-bold text-slate-500 uppercase">启用状态</label>
                          <div className="flex items-center h-[42px]">
                             <label className="flex items-center cursor-pointer relative">
                                <input type="checkbox" defaultChecked className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                <span className="ml-3 text-sm font-medium text-gray-900">启用</span>
                             </label>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-1.5">
                       <label className="block text-xs font-bold text-slate-500 uppercase">备注说明</label>
                       <textarea 
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none h-20"
                         placeholder="请输入物料详细描述..."
                       ></textarea>
                    </div>
                 </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                 <button 
                    onClick={() => setIsCreatingMaterial(false)}
                    className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
                 >
                    取消
                 </button>
                 <button 
                    onClick={handleSaveMaterial}
                    className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 shadow-lg flex items-center gap-2"
                 >
                    <Save size={16} /> 保存物料
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Left: Category Tree */}
      <div className="w-64 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
         <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
               <Boxes size={18} className="text-blue-600"/> 物料分类
            </h3>
         </div>
         <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
               {/* Main 'All' Category */}
               <div 
                 onClick={() => setSelectedMatCatId('all')}
                 className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm font-medium transition-colors ${selectedMatCatId === 'all' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
               >
                  <span className="flex items-center gap-2">
                     <Layers size={16} className={selectedMatCatId === 'all' ? 'text-blue-500' : 'text-slate-400'} />
                     全部物料
                  </span>
                  <span className="text-xs text-slate-400 bg-white px-1.5 rounded-full border border-slate-100">{materials.length}</span>
               </div>

               {/* Recursive Tree */}
               {matCategories[0].children?.map(cat => (
                  <div key={cat.id}>
                     <div 
                       onClick={() => setSelectedMatCatId(cat.id)}
                       className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm font-medium transition-colors ${selectedMatCatId === cat.id ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                     >
                        <span className="flex items-center gap-2">
                           <FolderTree size={16} className={selectedMatCatId === cat.id ? 'text-blue-500' : 'text-slate-400'} />
                           {cat.name}
                        </span>
                        <span className="text-xs text-slate-400 bg-white px-1.5 rounded-full border border-slate-100">{cat.count}</span>
                     </div>
                     {cat.children && (
                        <div className="pl-4 mt-1 space-y-1">
                           {cat.children.map(sub => (
                              <div key={sub.id}>
                                 <div 
                                   onClick={() => setSelectedMatCatId(sub.id)}
                                   className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm font-medium transition-colors ${selectedMatCatId === sub.id ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                 >
                                    <span className="flex items-center gap-2">
                                       <span className="w-4 h-4 border-l border-b border-slate-200 -ml-1"></span>
                                       {sub.name}
                                    </span>
                                    <span className="text-xs text-slate-400">{sub.count}</span>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               ))}
            </div>
         </div>
      </div>

      {/* Right: Material List */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
         {/* Toolbar */}
         <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-4">
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="搜索物料编码、名称..." 
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64" 
                  />
               </div>
               <div className="flex gap-2">
                  <select className="bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg px-3 py-2 outline-none">
                     <option>所有状态</option>
                     <option>启用</option>
                     <option>停用</option>
                  </select>
               </div>
            </div>
            <div className="flex gap-3">
               <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                  <UploadCloud size={16} /> 导入
               </button>
               <button 
                  onClick={() => setIsCreatingMaterial(true)}
                  className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-800 shadow-lg"
               >
                  <Plus size={16} /> 新增物料
               </button>
            </div>
         </div>

         {/* Table */}
         <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                     <th className="px-6 py-4 w-12 text-center"><input type="checkbox" className="rounded text-blue-600" /></th>
                     <th className="px-6 py-4">物料编码</th>
                     <th className="px-6 py-4">物料名称</th>
                     <th className="px-6 py-4">规格型号</th>
                     <th className="px-6 py-4 text-center">单位</th>
                     <th className="px-6 py-4">所属分类</th>
                     <th className="px-6 py-4 text-right">参考价</th>
                     <th className="px-6 py-4 text-center">状态</th>
                     <th className="px-6 py-4 text-center">操作</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredMaterials.map((item, i) => (
                     <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4 text-center"><input type="checkbox" className="rounded text-blue-600" /></td>
                        <td className="px-6 py-4 font-mono text-slate-500">{item.code}</td>
                        <td className="px-6 py-4 font-bold text-slate-900">{item.name}</td>
                        <td className="px-6 py-4 text-slate-600">{item.spec}</td>
                        <td className="px-6 py-4 text-center">{item.unit}</td>
                        <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">{item.category}</span></td>
                        <td className="px-6 py-4 text-right font-mono">¥{item.price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-center">
                           <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              {item.status === 'active' ? '启用' : '停用'}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <button className="text-blue-600 font-bold hover:underline opacity-0 group-hover:opacity-100 transition-opacity">编辑</button>
                        </td>
                     </tr>
                  ))}
                  {filteredMaterials.length === 0 && (
                      <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400">
                              <Search size={32} className="mx-auto mb-2 opacity-20" />
                              <p>未找到匹配的物料数据</p>
                          </td>
                      </tr>
                  )}
               </tbody>
            </table>
         </div>
         <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500 flex justify-between items-center">
            <span>共 {filteredMaterials.length} 条记录</span>
            <div className="flex gap-2">
               <button className="px-2 py-1 border border-slate-200 rounded hover:bg-white">上一页</button>
               <button className="px-2 py-1 border border-slate-200 rounded hover:bg-white">下一页</button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default MaterialMasterData;
