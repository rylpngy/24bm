
import React, { useState } from 'react';
import { 
  Boxes, Plus, Search, Edit3, Eye, MoreVertical, ArrowLeft, 
  Save, UploadCloud, Trash2, FileImage as ImageIcon, X, CheckCircle2, AlertCircle,
  Package, Tag, DollarSign, Layers
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  price: number;
  stock: number;
  unit: string;
  status: '上架' | '下架' | '缺货';
  description?: string;
  image?: string;
  specs?: { key: string; value: string }[];
  createDate?: string;
}

const initialProducts: Product[] = [
  { 
    id: 'P001', 
    name: '精密轴承 Model-X', 
    category: '工业零部件', 
    brand: 'NSK', 
    model: 'Model-X',
    price: 170.00, 
    stock: 1200, 
    unit: '个',
    status: '上架',
    description: '高精度深沟球轴承，适用于高速运转环境，耐高温，低噪音。',
    specs: [{ key: '内径', value: '20mm' }, { key: '外径', value: '47mm' }, { key: '材质', value: '轴承钢' }],
    createDate: '2023-01-15'
  },
  { 
    id: 'P002', 
    name: '高强度螺栓 M12', 
    category: '紧固件', 
    brand: '强力',
    model: 'M12x50',
    price: 2.50, 
    stock: 50000, 
    unit: '颗',
    status: '上架',
    description: '12.9级高强度外六角螺栓，表面发黑处理，防锈性能优越。',
    specs: [{ key: '直径', value: 'M12' }, { key: '长度', value: '50mm' }, { key: '强度等级', value: '12.9' }],
    createDate: '2023-03-20'
  },
  { 
    id: 'P003', 
    name: '定制液压油缸', 
    category: '液压元件', 
    brand: '恒立',
    model: 'CUST-HYD-01',
    price: 3500.00, 
    stock: 0, 
    unit: '台',
    status: '缺货',
    description: '根据客户图纸定制的双作用液压油缸，行程可调。',
    specs: [{ key: '缸径', value: '80mm' }, { key: '行程', value: '500mm' }],
    createDate: '2023-06-10'
  },
];

const SupplierProducts: React.FC = () => {
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'detail'>('list');
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [searchTerm, setSearchTerm] = useState('');

  // --- Actions ---

  const handleCreate = () => {
    setFormData({
      status: '上架',
      unit: '件',
      specs: [{ key: '', value: '' }]
    });
    setView('create');
  };

  const handleEdit = (product: Product) => {
    setCurrentProduct(product);
    setFormData(JSON.parse(JSON.stringify(product))); // Deep copy
    setView('edit');
  };

  const handleView = (product: Product) => {
    setCurrentProduct(product);
    setView('detail');
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除该商品吗？')) {
      setProducts(products.filter(p => p.id !== id));
      if (view !== 'list') setView('list');
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.price) {
      alert('请填写必填项');
      return;
    }

    if (view === 'create') {
      const newProduct: Product = {
        id: `P${Date.now()}`,
        name: formData.name!,
        category: formData.category || '未分类',
        brand: formData.brand || '',
        model: formData.model || '',
        price: Number(formData.price),
        stock: Number(formData.stock) || 0,
        unit: formData.unit || '件',
        status: formData.status || '下架',
        description: formData.description || '',
        specs: formData.specs?.filter(s => s.key && s.value) || [],
        createDate: new Date().toISOString().split('T')[0],
      };
      setProducts([newProduct, ...products]);
    } else if (view === 'edit' && currentProduct) {
      const updatedProducts = products.map(p => 
        p.id === currentProduct.id ? { ...p, ...formData } as Product : p
      );
      setProducts(updatedProducts);
    }
    setView('list');
  };

  const handleSpecChange = (index: number, field: 'key' | 'value', value: string) => {
    const newSpecs = [...(formData.specs || [])];
    newSpecs[index] = { ...newSpecs[index], [field]: value };
    setFormData({ ...formData, specs: newSpecs });
  };

  const addSpecRow = () => {
    setFormData({ ...formData, specs: [...(formData.specs || []), { key: '', value: '' }] });
  };

  const removeSpecRow = (index: number) => {
    const newSpecs = (formData.specs || []).filter((_, i) => i !== index);
    setFormData({ ...formData, specs: newSpecs });
  };

  // --- Views ---

  const renderForm = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-20">
      <div className="flex items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-xl font-black text-slate-900">{view === 'create' ? '发布新商品' : '编辑商品信息'}</h2>
          <p className="text-sm text-slate-500 mt-1">完善商品详情，有助于提高采购方的搜索匹配率</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Package className="text-orange-600" size={20} /> 基础信息
            </h3>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">商品标题 <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-orange-500" 
                  placeholder="请输入商品名称，包含品牌型号"
                />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">所属分类</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500 appearance-none"
                  >
                    <option value="">请选择分类</option>
                    <option value="工业零部件">工业零部件</option>
                    <option value="紧固件">紧固件</option>
                    <option value="液压元件">液压元件</option>
                    <option value="办公用品">办公用品</option>
                    <option value="IT设备">IT设备</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">品牌</label>
                  <input 
                    type="text" 
                    value={formData.brand || ''}
                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500" 
                    placeholder="品牌名称"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">商品描述</label>
                <textarea 
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500 h-32 resize-none" 
                  placeholder="详细描述商品的材质、用途、特性等..."
                ></textarea>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Tag className="text-orange-600" size={20} /> 规格参数
            </h3>
            <div className="space-y-3">
              {formData.specs?.map((spec, i) => (
                <div key={i} className="flex gap-4 items-center">
                  <input 
                    type="text" 
                    value={spec.key} 
                    onChange={e => handleSpecChange(i, 'key', e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-orange-500"
                    placeholder="参数名 (如：颜色)"
                  />
                  <input 
                    type="text" 
                    value={spec.value} 
                    onChange={e => handleSpecChange(i, 'value', e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-orange-500"
                    placeholder="参数值 (如：红色)"
                  />
                  <button onClick={() => removeSpecRow(i)} className="text-slate-400 hover:text-red-500 p-2">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              <button onClick={addSpecRow} className="text-sm font-bold text-orange-600 hover:bg-orange-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                <Plus size={16} /> 添加参数行
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Sales & Image */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <DollarSign className="text-orange-600" size={20} /> 销售信息
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">协议单价 (元) <span className="text-red-500">*</span></label>
                <input 
                  type="number" 
                  value={formData.price || ''}
                  onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-orange-500" 
                  placeholder="0.00"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">当前库存</label>
                  <input 
                    type="number" 
                    value={formData.stock || ''}
                    onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-orange-500" 
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">计量单位</label>
                  <input 
                    type="text" 
                    value={formData.unit || ''}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500" 
                    placeholder="个/箱"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">商品状态</label>
                <div className="flex gap-2">
                  {['上架', '下架', '缺货'].map(s => (
                    <button
                      key={s}
                      onClick={() => setFormData({ ...formData, status: s as any })}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                        formData.status === s 
                        ? 'bg-orange-600 text-white border-orange-600' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ImageIcon className="text-orange-600" size={20} /> 商品图片
            </h3>
            <div className="aspect-square w-full border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center bg-slate-50 hover:bg-orange-50 hover:border-orange-300 transition-all cursor-pointer group">
              <UploadCloud size={40} className="text-slate-300 group-hover:text-orange-500 mb-2 transition-colors" />
              <p className="text-xs font-bold text-slate-500 group-hover:text-orange-600">点击上传主图</p>
              <p className="text-[10px] text-slate-400 mt-1">支持 JPG, PNG (Max 5MB)</p>
            </div>
          </div>

          <div className="flex gap-3 pt-6">
            <button 
              onClick={() => setView('list')}
              className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button 
              onClick={handleSave}
              className="flex-[2] py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 shadow-lg transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} /> 保存商品
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDetail = () => {
    if (!currentProduct) return null;
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
              <ArrowLeft size={24} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-slate-900">{currentProduct.name}</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                  currentProduct.status === '上架' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {currentProduct.status}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">商品编码: {currentProduct.id} · 创建于: {currentProduct.createDate}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => handleDelete(currentProduct.id)}
              className="px-4 py-2 border border-red-100 text-red-600 bg-red-50 rounded-xl text-sm font-bold hover:bg-red-100 flex items-center gap-2"
            >
              <Trash2 size={18} /> 删除
            </button>
            <button 
              onClick={() => handleEdit(currentProduct)}
              className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shadow-lg flex items-center gap-2"
            >
              <Edit3 size={18} /> 编辑商品
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
             <div className="w-full aspect-square bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                <ImageIcon size={64} className="text-slate-200" />
             </div>
             <p className="text-xs text-slate-400">暂无图片</p>
          </div>

          <div className="lg:col-span-2 space-y-6">
             <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                   <Tag size={20} className="text-orange-600"/> 商品概览
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                   <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">协议单价</p>
                      <p className="text-2xl font-black text-orange-600">¥{currentProduct.price.toLocaleString()}</p>
                   </div>
                   <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">当前库存</p>
                      <p className="text-2xl font-black text-slate-900">{currentProduct.stock} <span className="text-sm font-normal text-slate-500">{currentProduct.unit}</span></p>
                   </div>
                   <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">分类</p>
                      <p className="text-lg font-bold text-slate-900">{currentProduct.category}</p>
                   </div>
                   <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">品牌型号</p>
                      <p className="text-lg font-bold text-slate-900">{currentProduct.brand} {currentProduct.model}</p>
                   </div>
                </div>
                
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <p className="text-sm text-slate-600 leading-relaxed">{currentProduct.description || '暂无描述'}</p>
                </div>
             </div>

             <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                   <Layers size={20} className="text-blue-600"/> 详细参数
                </h3>
                <div className="grid grid-cols-2 gap-4">
                   {currentProduct.specs?.map((spec, i) => (
                      <div key={i} className="flex justify-between p-3 border-b border-slate-100">
                         <span className="text-slate-500 text-sm font-bold">{spec.key}</span>
                         <span className="text-slate-900 text-sm">{spec.value}</span>
                      </div>
                   ))}
                   {(!currentProduct.specs || currentProduct.specs.length === 0) && (
                      <p className="text-slate-400 text-sm col-span-2 text-center py-4">暂无规格参数</p>
                   )}
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const renderList = () => {
    const filteredProducts = products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Boxes className="text-orange-600" size={24} />
              商品管理
            </h1>
            <p className="text-sm text-slate-500 mt-1">维护商品目录、价格及库存信息</p>
          </div>
          <button 
            onClick={handleCreate}
            className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-orange-700 shadow-lg shadow-orange-200 transition-all"
          >
              <Plus size={18} />
              发布商品
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
           <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                   type="text" 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   placeholder="搜索商品名称或编码..." 
                   className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none w-64 focus:ring-2 focus:ring-orange-500 transition-all" 
                 />
              </div>
           </div>
           <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-left">
                 <tr>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">商品名称</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase">分类</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-right">协议价</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">库存</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">状态</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase text-center">操作</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {filteredProducts.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => handleView(p)}>
                       <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors">{p.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{p.id} {p.brand && `· ${p.brand}`}</p>
                       </td>
                       <td className="px-6 py-4 text-slate-600">{p.category}</td>
                       <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">¥{p.price.toFixed(2)}</td>
                       <td className="px-6 py-4 text-center">{p.stock} <span className="text-xs text-slate-400">{p.unit}</span></td>
                       <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                             p.status === '上架' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>
                             {p.status}
                          </span>
                       </td>
                       <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                             <button 
                               onClick={(e) => { e.stopPropagation(); handleEdit(p); }}
                               className="p-2 text-slate-400 hover:bg-white hover:shadow hover:text-blue-600 rounded-lg transition-all"
                               title="编辑"
                             >
                               <Edit3 size={16}/>
                             </button>
                             <button 
                               onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                               className="p-2 text-slate-400 hover:bg-white hover:shadow hover:text-red-600 rounded-lg transition-all"
                               title="删除"
                             >
                               <Trash2 size={16}/>
                             </button>
                          </div>
                       </td>
                    </tr>
                 ))}
                 {filteredProducts.length === 0 && (
                    <tr>
                       <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Search size={32} className="mx-auto mb-2 opacity-20" />
                          <p>暂无相关商品</p>
                       </td>
                    </tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>
    );
  };

  if (view === 'create' || view === 'edit') return renderForm();
  if (view === 'detail') return renderDetail();
  return renderList();
};

export default SupplierProducts;
