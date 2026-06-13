
import React, { useState } from 'react';
import { 
  Search, ShoppingCart, Sparkles, Plus, Minus,
  FileText, Monitor, Wrench, Gift, Settings2, Store,
  ChevronLeft, Star, TrendingUp, ShieldCheck, Truck,
  Check, X, BarChart2, ListTodo, ArrowRight, Trash2,
  AlertCircle, CreditCard
} from 'lucide-react';

// --- Types ---

interface ProductSpec {
  brand: string;
  model: string;
  weight: string;
  origin: string;
  warranty: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  supplier: string;
  supplierLevel: 'Strategic' | 'Core' | 'Standard';
  tag: string;
  discount?: string;
  img: string;
  category: string;
  sales: number;
  rating: number;
  specs: ProductSpec;
  delivery: string;
  stock: number;
}

interface CartItem extends Product {
  qty: number;
}

interface ProcurementTask {
  id: string;
  planId: string;
  itemName: string;
  qty: number;
  budget: number;
  deadline: string;
  dept: string;
}

// --- Mock Data ---

const MOCK_TASKS: ProcurementTask[] = [
  { id: 'T01', planId: 'PLAN-2023-088', itemName: 'A4复印纸', qty: 500, budget: 12500, deadline: '2023-11-15', dept: '行政部' },
  { id: 'T02', planId: 'PLAN-2023-092', itemName: '戴尔显示器', qty: 15, budget: 18000, deadline: '2023-11-20', dept: 'IT部' },
];

const MOCK_PRODUCTS: Product[] = [
  { 
    id: 'p1', 
    title: 'Apple MacBook Pro 14英寸 M3芯片 16G+512G 深空灰', 
    price: 12999, 
    supplier: '京东企业购', 
    supplierLevel: 'Strategic',
    tag: '协议价', 
    discount: '9.5折', 
    img: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&q=80&w=600',
    category: 'IT 数码',
    sales: 1240,
    rating: 4.9,
    delivery: '次日达',
    stock: 50,
    specs: { brand: 'Apple', model: 'MRX33CH/A', weight: '1.55kg', origin: '中国', warranty: '1年原厂' }
  },
  { 
    id: 'p2', 
    title: '得力(deli) A4复印纸 70g 500张/包 5包/箱 整箱销售', 
    price: 185, 
    supplier: '晨光科力普', 
    supplierLevel: 'Core',
    tag: '集采', 
    discount: '满减', 
    img: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&q=80&w=600',
    category: '办公用品',
    sales: 58000,
    rating: 4.8,
    delivery: '3日内',
    stock: 2000,
    specs: { brand: '得力', model: '7754', weight: '12kg/箱', origin: '浙江', warranty: '-' }
  },
  { 
    id: 'p3', 
    title: '赫曼米勒(Herman Miller) Aeron 人体工学办公椅', 
    price: 8500, 
    supplier: '震旦家具', 
    supplierLevel: 'Standard',
    tag: '员工特惠', 
    discount: '直降', 
    img: 'https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&q=80&w=600',
    category: '办公用品',
    sales: 120,
    rating: 4.9,
    delivery: '7日内',
    stock: 15,
    specs: { brand: 'Herman Miller', model: 'Aeron 2.0', weight: '22kg', origin: '美国', warranty: '12年' }
  },
  { 
    id: 'p4', 
    title: '3M 9010CN 防护口罩 N95 独立包装 (50只/盒)', 
    price: 450, 
    supplier: '震坤行', 
    supplierLevel: 'Strategic',
    tag: 'MRO', 
    img: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?auto=format&fit=crop&q=80&w=600',
    category: 'MRO 工业品',
    sales: 8500,
    rating: 4.7,
    delivery: '次日达',
    stock: 500,
    specs: { brand: '3M', model: '9010CN', weight: '0.5kg', origin: '上海', warranty: '3年' }
  },
  { 
    id: 'p5', 
    title: '戴尔(DELL) U2723QE 27英寸 4K超清 IPS显示器', 
    price: 3299, 
    supplier: '京东企业购', 
    supplierLevel: 'Strategic',
    tag: '协议价', 
    discount: '9.8折', 
    img: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=600',
    category: 'IT 数码',
    sales: 850,
    rating: 4.8,
    delivery: '次日达',
    stock: 80,
    specs: { brand: 'DELL', model: 'U2723QE', weight: '6.6kg', origin: '中国', warranty: '3年上门' }
  },
  { 
    id: 'p6', 
    title: '罗技(Logitech) MX Master 3S 无线蓝牙鼠标', 
    price: 599, 
    supplier: '京东企业购', 
    supplierLevel: 'Strategic',
    tag: '热销', 
    discount: '', 
    img: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&q=80&w=600',
    category: 'IT 数码',
    sales: 4200,
    rating: 4.9,
    delivery: '次日达',
    stock: 150,
    specs: { brand: 'Logitech', model: 'MX Master 3S', weight: '141g', origin: '中国', warranty: '1年' }
  },
  { 
    id: 'p9', 
    title: '华为(HUAWEI) MateBook X Pro 2024 微绒典藏版', 
    price: 14999, 
    supplier: '京东企业购', 
    supplierLevel: 'Strategic',
    tag: '新品', 
    discount: '9.8折', 
    img: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&q=80&w=600',
    category: 'IT 数码',
    sales: 320,
    rating: 4.9,
    delivery: '次日达',
    stock: 20,
    specs: { brand: 'HUAWEI', model: 'VGHH-X', weight: '0.98kg', origin: '中国', warranty: '1年全国联保' }
  },
  { 
    id: 'p10', 
    title: '绿联(UGREEN) 100W 氮化镓充电器套装', 
    price: 199, 
    supplier: '晨光科力普', 
    supplierLevel: 'Core',
    tag: '热销', 
    discount: '', 
    img: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=600',
    category: 'IT 数码',
    sales: 12500,
    rating: 4.8,
    delivery: '次日达',
    stock: 800,
    specs: { brand: '绿联', model: 'CD226', weight: '0.2kg', origin: '广东', warranty: '1年' }
  }
];

const EnterpriseMall: React.FC = () => {
  const [view, setView] = useState<'home' | 'detail' | 'cart' | 'compare'>('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [compareList, setCompareList] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // --- Actions ---

  const handleAddToCart = (product: Product) => {
    setCart(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const handleUpdateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleToggleCompare = (product: Product) => {
    setCompareList(prev => {
      const exists = prev.find(p => p.id === product.id);
      if (exists) return prev.filter(p => p.id !== product.id);
      if (prev.length >= 4) {
        alert("最多只能对比 4 件商品");
        return prev;
      }
      return [...prev, product];
    });
  };

  const handleTaskSearch = (taskName: string) => {
    setSearchTerm(taskName);
    // Simulate search logic filter visual
  };

  // --- Components ---

  const PendingTasksBar = () => (
    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 animate-in slide-in-from-top-2">
      <div className="flex items-center gap-2 mb-3">
        <ListTodo size={18} className="text-blue-600" />
        <h3 className="font-bold text-blue-900 text-sm">待执行采购计划任务 ({MOCK_TASKS.length})</h3>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {MOCK_TASKS.map(task => (
          <div key={task.id} className="min-w-[280px] bg-white rounded-xl p-3 border border-slate-100 shadow-sm flex justify-between items-center group hover:border-blue-300 transition-colors">
            <div>
              <p className="text-xs font-bold text-slate-700">{task.itemName} x {task.qty}</p>
              <p className="text-[10px] text-slate-400 mt-1">来源: {task.dept} | 截止: {task.deadline}</p>
            </div>
            <button 
              onClick={() => handleTaskSearch(task.itemName)}
              className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-600 hover:text-white transition-colors"
            >
              去采购
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const CompareFloatBar = () => {
    if (compareList.length === 0 || view === 'compare') return null;
    return (
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-10">
        <div className="flex gap-3">
          {compareList.map(p => (
            <div key={p.id} className="w-12 h-12 bg-white rounded-lg p-1 relative group">
              <img src={p.img} alt="" className="w-full h-full object-contain" />
              <button 
                onClick={() => handleToggleCompare(p)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {Array.from({ length: 4 - compareList.length }).map((_, i) => (
            <div key={i} className="w-12 h-12 bg-white/10 rounded-lg border border-dashed border-white/20 flex items-center justify-center text-xs text-white/30">
              {i + 1 + compareList.length}
            </div>
          ))}
        </div>
        <div className="h-8 w-px bg-white/20"></div>
        <div>
          <p className="text-xs text-slate-400 mb-1">已选 {compareList.length} / 4</p>
          <button 
            onClick={() => setView('compare')}
            className="text-sm font-bold hover:text-blue-400 transition-colors flex items-center gap-1"
          >
            开始对比 <ArrowRight size={14} />
          </button>
        </div>
        <button 
          onClick={() => setCompareList([])}
          className="text-xs text-slate-500 hover:text-white"
        >
          清空
        </button>
      </div>
    );
  };

  const renderProductDetail = () => {
    if (!selectedProduct) return null;
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-300">
        <button 
          onClick={() => setView('home')}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 mb-6 transition-colors"
        >
          <ChevronLeft size={16} /> 返回商城
        </button>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left: Images */}
            <div className="space-y-4">
              <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-100">
                <img src={selectedProduct.img} alt={selectedProduct.title} className="max-w-[80%] max-h-[80%] object-contain mix-blend-multiply" />
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="aspect-square bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-400 cursor-pointer"></div>
                ))}
              </div>
            </div>

            {/* Right: Info */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-lg uppercase">{selectedProduct.tag}</span>
                {selectedProduct.discount && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg uppercase">{selectedProduct.discount}</span>
                )}
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1 ml-auto">
                  <Star size={12} className="text-yellow-400 fill-yellow-400" /> {selectedProduct.rating} 评分
                </span>
              </div>
              
              <h1 className="text-2xl font-black text-slate-900 leading-snug mb-4">{selectedProduct.title}</h1>
              
              <div className="bg-slate-50 rounded-2xl p-6 mb-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-sm text-slate-500 font-bold">企业协议价</span>
                  <span className="text-3xl font-black text-blue-600">¥{selectedProduct.price.toLocaleString()}</span>
                  <span className="text-sm text-slate-400 line-through ml-2">¥{(selectedProduct.price * 1.2).toFixed(0)}</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                  <span className="flex items-center gap-1"><TrendingUp size={14} className="text-green-600"/> 价格低于市场均价 15%</span>
                  <span className="w-px h-3 bg-slate-300"></span>
                  <span>月销 {selectedProduct.sales}+</span>
                </div>
              </div>

              <div className="space-y-4 mb-8 flex-1">
                <div className="flex gap-4 text-sm">
                  <span className="text-slate-400 font-bold w-16 shrink-0">供应商</span>
                  <div>
                    <p className="font-bold text-slate-900 flex items-center gap-2">
                      <Store size={16} className="text-blue-600" /> 
                      {selectedProduct.supplier}
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 uppercase">{selectedProduct.supplierLevel}</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-slate-400 font-bold w-16 shrink-0">配送</span>
                  <div>
                    <p className="font-bold text-slate-900 flex items-center gap-2">
                      <Truck size={16} className="text-slate-400" /> 
                      {selectedProduct.delivery}
                      <span className="text-slate-400 font-normal"> (库存: {selectedProduct.stock})</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-slate-400 font-bold w-16 shrink-0">参数</span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedProduct.specs).map(([k, v]) => (
                      <span key={k} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-slate-100">
                <button 
                  onClick={() => handleAddToCart(selectedProduct)}
                  className="flex-1 py-4 bg-slate-100 text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={20} /> 加入购物车
                </button>
                <button className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2">
                  <CreditCard size={20} /> 立即下单
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderComparison = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <button 
        onClick={() => setView('home')}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 mb-2 transition-colors"
      >
        <ChevronLeft size={16} /> 返回商城
      </button>
      
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <BarChart2 className="text-blue-600" size={24} /> 商品对比
          </h2>
          <button onClick={() => setCompareList([])} className="text-sm font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
            清空对比
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="p-6 w-32 bg-slate-50 text-slate-500 font-bold">商品信息</th>
                {compareList.map(p => (
                  <th key={p.id} className="p-6 min-w-[240px] align-top relative">
                    <button onClick={() => handleToggleCompare(p)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><X size={16}/></button>
                    <div className="h-32 bg-slate-50 rounded-xl mb-4 flex items-center justify-center">
                      <img src={p.img} alt="" className="max-h-[80%] max-w-[80%] object-contain mix-blend-multiply" />
                    </div>
                    <p className="font-bold text-slate-900 line-clamp-2 h-10 mb-2">{p.title}</p>
                    <p className="text-xl font-black text-blue-600">¥{p.price.toLocaleString()}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-4 pl-6 bg-slate-50 text-slate-500 font-bold">供应商</td>
                {compareList.map(p => <td key={p.id} className="p-4 font-medium">{p.supplier}</td>)}
              </tr>
              <tr>
                <td className="p-4 pl-6 bg-slate-50 text-slate-500 font-bold">品牌</td>
                {compareList.map(p => <td key={p.id} className="p-4">{p.specs.brand}</td>)}
              </tr>
              <tr>
                <td className="p-4 pl-6 bg-slate-50 text-slate-500 font-bold">型号</td>
                {compareList.map(p => <td key={p.id} className="p-4">{p.specs.model}</td>)}
              </tr>
              <tr>
                <td className="p-4 pl-6 bg-slate-50 text-slate-500 font-bold">产地</td>
                {compareList.map(p => <td key={p.id} className="p-4">{p.specs.origin}</td>)}
              </tr>
              <tr>
                <td className="p-4 pl-6 bg-slate-50 text-slate-500 font-bold">质保</td>
                {compareList.map(p => <td key={p.id} className="p-4">{p.specs.warranty}</td>)}
              </tr>
              <tr>
                <td className="p-4 pl-6 bg-slate-50 text-slate-500 font-bold">交期</td>
                {compareList.map(p => <td key={p.id} className="p-4">{p.delivery}</td>)}
              </tr>
              <tr>
                <td className="p-4 pl-6 bg-slate-50"></td>
                {compareList.map(p => (
                  <td key={p.id} className="p-4">
                    <button 
                      onClick={() => handleAddToCart(p)}
                      className="w-full py-2 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800"
                    >
                      加入购物车
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCart = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <button 
        onClick={() => setView('home')}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 mb-2 transition-colors"
      >
        <ChevronLeft size={16} /> 继续采购
      </button>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-black text-slate-900">采购清单 ({cart.length})</h2>
          </div>
          {cart.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
              <p>购物车暂无商品</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {cart.map(item => (
                <div key={item.id} className="p-6 flex gap-6 items-center">
                  <div className="w-24 h-24 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center shrink-0">
                    <img src={item.img} alt="" className="max-h-[80%] max-w-[80%] object-contain mix-blend-multiply" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                    <p className="text-xs text-slate-500 mb-2">供应商: {item.supplier}</p>
                    <p className="text-lg font-black text-blue-600">¥{item.price.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-slate-200 rounded-lg">
                      <button onClick={() => handleUpdateQty(item.id, -1)} className="p-2 hover:bg-slate-50 text-slate-500"><Minus size={14} /></button>
                      <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                      <button onClick={() => handleUpdateQty(item.id, 1)} className="p-2 hover:bg-slate-50 text-slate-500"><Plus size={14} /></button>
                    </div>
                    <button onClick={() => handleRemoveFromCart(item.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:w-80 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4">订单摘要</h3>
            <div className="space-y-2 text-sm text-slate-500 border-b border-slate-100 pb-4 mb-4">
              <div className="flex justify-between">
                <span>商品总额</span>
                <span className="font-bold text-slate-900">¥{cart.reduce((acc, item) => acc + item.price * item.qty, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>运费</span>
                <span className="font-bold text-green-600">免运费</span>
              </div>
            </div>
            <div className="flex justify-between items-end mb-6">
              <span className="font-bold text-slate-900">应付总额</span>
              <span className="text-2xl font-black text-blue-600">¥{cart.reduce((acc, item) => acc + item.price * item.qty, 0).toLocaleString()}</span>
            </div>
            <button className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg transition-all flex items-center justify-center gap-2">
              <CreditCard size={18} /> 生成采购订单
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHome = () => (
    <>
      {/* Mall Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden gap-6 mb-8">
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black uppercase rounded shadow-lg shadow-blue-500/30">Enterprise Mall</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">B2B Procurement Portal</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">企业协议商城</h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">聚合京东企业购、震坤行等优质供应商，享受企业专属协议价与账期服务。</p>
        </div>
        
        <div className="flex flex-1 w-full md:w-auto gap-4 relative z-10 justify-end">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="搜索商品名称、品牌、型号或供应商..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700 placeholder:font-medium" 
            />
          </div>
          <button 
            onClick={() => setView('cart')}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 shrink-0"
          >
            <ShoppingCart size={20} />
            <span className="hidden md:inline">购物车</span>
            {cart.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{cart.length}</span>}
          </button>
        </div>
        
        {/* Decorative Background Elements */}
        <div className="absolute right-0 top-0 h-full w-2/3 bg-gradient-to-l from-blue-50 via-indigo-50/50 to-transparent opacity-60 -z-0"></div>
        <div className="absolute -right-10 -bottom-20 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-40"></div>
      </div>

      <PendingTasksBar />

      {/* Category Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
         {[
           { name: '办公用品', icon: FileText, count: '1,240+', color: 'text-blue-600', bg: 'bg-blue-50' },
           { name: 'IT 数码', icon: Monitor, count: '850+', color: 'text-purple-600', bg: 'bg-purple-50' },
           { name: 'MRO 工业品', icon: Wrench, count: '5,620+', color: 'text-orange-600', bg: 'bg-orange-50' },
           { name: '员工福利', icon: Gift, count: '320+', color: 'text-pink-600', bg: 'bg-pink-50' },
           { name: '定制加工', icon: Settings2, count: '定制询价', color: 'text-green-600', bg: 'bg-green-50' },
         ].map((cat, i) => (
           <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group text-center flex flex-col items-center justify-center h-32">
              <div className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3 transition-colors ${cat.bg}`}>
                <cat.icon size={24} className={cat.color} />
              </div>
              <h3 className="font-bold text-slate-900">{cat.name}</h3>
              <p className="text-xs text-slate-400 mt-1 font-medium">{cat.count}</p>
           </div>
         ))}
      </div>

      {/* Featured Products Grid */}
      <div>
        <div className="flex justify-between items-center mb-6">
           <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
             <Sparkles className="text-yellow-500 fill-yellow-500" size={20} />
             企业精选推荐
           </h2>
           <div className="flex gap-2">
              <button className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors">销量优先</button>
              <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:border-blue-400 transition-colors">价格筛选</button>
           </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           {MOCK_PRODUCTS
             .filter(p => !searchTerm || p.title.toLowerCase().includes(searchTerm.toLowerCase()))
             .map((p, i) => (
             <div 
                key={i} 
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all group flex flex-col h-full relative"
             >
                <div onClick={() => { setSelectedProduct(p); setView('detail'); }} className="h-48 bg-slate-100 relative overflow-hidden shrink-0 cursor-pointer">
                   <img src={p.img} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 mix-blend-multiply" />
                   <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                      <div className="bg-slate-900/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-lg uppercase shadow-lg">
                          {p.tag}
                      </div>
                      {p.discount && (
                        <div className="bg-red-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-lg uppercase shadow-lg">
                            {p.discount}
                        </div>
                      )}
                   </div>
                </div>
                
                {/* Compare Checkbox */}
                <label className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                   <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold shadow-sm backdrop-blur-md ${compareList.find(c => c.id === p.id) ? 'bg-blue-600 text-white' : 'bg-white/80 text-slate-600 border border-slate-200'}`}>
                      <input 
                        type="checkbox" 
                        className="hidden"
                        checked={!!compareList.find(c => c.id === p.id)}
                        onChange={() => handleToggleCompare(p)}
                      />
                      {compareList.find(c => c.id === p.id) ? <Check size={12} /> : <BarChart2 size={12} />}
                      对比
                   </div>
                </label>

                <div className="p-5 flex flex-col flex-1">
                   <div className="flex items-center gap-1.5 mb-2">
                      <Store size={12} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-500">{p.supplier}</span>
                   </div>
                   <h3 
                      onClick={() => { setSelectedProduct(p); setView('detail'); }}
                      className="font-bold text-slate-900 leading-snug mb-4 line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors" 
                      title={p.title}
                   >
                      {p.title}
                   </h3>
                   
                   <div className="mt-auto flex justify-between items-end">
                      <div>
                         <span className="text-xs text-slate-400 block mb-0.5 font-medium">企业价</span>
                         <span className="text-xl font-black text-blue-600">¥{p.price.toLocaleString()}</span>
                      </div>
                      <button 
                        onClick={() => handleAddToCart(p)}
                        className="w-10 h-10 bg-slate-50 text-slate-900 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm hover:shadow-blue-200"
                      >
                         <Plus size={20} />
                      </button>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </div>
      
      <CompareFloatBar />
    </>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
      {view === 'home' && renderHome()}
      {view === 'detail' && renderProductDetail()}
      {view === 'cart' && renderCart()}
      {view === 'compare' && renderComparison()}
    </div>
  );
};

export default EnterpriseMall;
