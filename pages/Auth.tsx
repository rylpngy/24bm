
import React, { useState } from 'react';
import { 
  User, Lock, ArrowRight, Building2, Phone, Mail, 
  ShieldCheck, Eye, EyeOff, CheckCircle2, Smartphone, 
  QrCode, Globe, ChevronLeft
} from 'lucide-react';

interface AuthProps {
  view: 'login' | 'register';
  onLoginSuccess: () => void;
  onNavigate: (view: 'login' | 'register' | 'portal') => void;
}

const AuthPage: React.FC<AuthProps> = ({ view, onLoginSuccess, onNavigate }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'account' | 'mobile'>('account');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess();
    }, 1500);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900">
      {/* Left Column: Brand & Hero (Hidden on mobile) */}
      <div className="hidden lg:flex w-5/12 bg-slate-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Background Patterns */}
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
           <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0 100 C 20 0 50 0 100 100 Z" fill="url(#grad1)" />
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style={{stopColor:'white', stopOpacity:1}} />
                  <stop offset="100%" style={{stopColor:'blue', stopOpacity:1}} />
                </linearGradient>
              </defs>
           </svg>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => onNavigate('portal')}>
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-blue-500/20">智</div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight leading-none">智采云</span>
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-0.5">Smart Procurement</span>
            </div>
          </div>
          <div className="mt-20">
             <h1 className="text-4xl font-black leading-tight mb-6">
                连接企业采购的<br/>
                <span className="text-blue-400">数字化未来</span>
             </h1>
             <p className="text-slate-400 text-lg leading-relaxed max-w-md">
                一站式 SRM 供应商管理与电子招投标平台。让寻源更智能，让交易更透明，让决策更科学。
             </p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
           <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                 {[1,2,3,4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-700">
                       <img src={`https://picsum.photos/seed/${i+20}/100`} className="w-full h-full rounded-full opacity-80" alt="User" />
                    </div>
                 ))}
              </div>
              <div className="text-sm">
                 <p className="font-bold text-white">10,000+ 家企业信赖</p>
                 <p className="text-slate-500 text-xs">加入行业领先的采购生态网络</p>
              </div>
           </div>
           <div className="text-xs text-slate-600">
              © 2023 Zhicai Cloud Inc.
           </div>
        </div>
      </div>

      {/* Right Column: Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 relative">
        <button 
           onClick={() => onNavigate('portal')}
           className="absolute top-8 left-8 flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold text-sm lg:hidden"
        >
           <ChevronLeft size={18} /> 返回首页
        </button>

        <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-8 duration-500">
           {/* Header Switcher */}
           <div className="text-center mb-10">
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                 {view === 'login' ? '欢迎回来' : '创建企业账号'}
              </h2>
              <p className="text-slate-500 text-sm">
                 {view === 'login' ? '请登录您的账号以继续管理业务' : '注册即享 30 天高级会员试用权益'}
              </p>
           </div>

           {/* View: Login */}
           {view === 'login' && (
              <form onSubmit={handleSubmit} className="space-y-5">
                 {/* Login Method Tabs */}
                 <div className="flex p-1 bg-slate-50 rounded-xl mb-6">
                    <button 
                       type="button"
                       onClick={() => setLoginMethod('account')}
                       className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${loginMethod === 'account' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                       账号密码登录
                    </button>
                    <button 
                       type="button"
                       onClick={() => setLoginMethod('mobile')}
                       className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${loginMethod === 'mobile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                       手机验证码
                    </button>
                 </div>

                 {loginMethod === 'account' ? (
                    <>
                       <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase ml-1">账号 / 邮箱</label>
                          <div className="relative">
                             <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                             <input 
                                type="text" 
                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-900" 
                                placeholder="请输入用户名或企业邮箱"
                             />
                          </div>
                       </div>
                       <div className="space-y-1.5">
                          <div className="flex justify-between items-center ml-1">
                             <label className="text-xs font-bold text-slate-500 uppercase">密码</label>
                             <a href="#" className="text-xs font-bold text-blue-600 hover:underline">忘记密码?</a>
                          </div>
                          <div className="relative">
                             <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                             <input 
                                type={showPassword ? "text" : "password"}
                                className="w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-900" 
                                placeholder="请输入密码"
                             />
                             <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                             </button>
                          </div>
                       </div>
                    </>
                 ) : (
                    <>
                       <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase ml-1">手机号码</label>
                          <div className="relative">
                             <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                             <input 
                                type="text" 
                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-900" 
                                placeholder="请输入 11 位手机号码"
                             />
                          </div>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase ml-1">验证码</label>
                          <div className="flex gap-3">
                             <div className="relative flex-1">
                                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                   type="text" 
                                   className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-900" 
                                   placeholder="6 位验证码"
                                />
                             </div>
                             <button type="button" className="px-4 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 whitespace-nowrap">
                                获取验证码
                             </button>
                          </div>
                       </div>
                    </>
                 )}

                 <button 
                    disabled={isLoading}
                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2 mt-4"
                 >
                    {isLoading ? (
                       <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                       <>
                          登录系统 <ArrowRight size={18} />
                       </>
                    )}
                 </button>

                 <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">其他登录方式</span></div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <button type="button" className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                       <QrCode size={18} className="text-green-600" /> 微信扫码
                    </button>
                    <button type="button" className="flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                       <Globe size={18} className="text-blue-500" /> 钉钉登录
                    </button>
                 </div>

                 <p className="text-center text-sm text-slate-500 mt-6">
                    还没有账号? <button type="button" onClick={() => onNavigate('register')} className="text-blue-600 font-bold hover:underline">立即注册企业</button>
                 </p>
              </form>
           )}

           {/* View: Register */}
           {view === 'register' && (
              <form onSubmit={handleSubmit} className="space-y-5">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-500 uppercase ml-1">企业名称</label>
                       <div className="relative">
                          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input type="text" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium" placeholder="公司全称" />
                       </div>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-500 uppercase ml-1">联系人</label>
                       <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input type="text" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium" placeholder="真实姓名" />
                       </div>
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">手机号码</label>
                    <div className="relative">
                       <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <input type="text" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium" placeholder="用于接收验证码" />
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">工作邮箱</label>
                    <div className="relative">
                       <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <input type="email" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium" placeholder="name@company.com" />
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">设置密码</label>
                    <div className="relative">
                       <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <input type="password" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium" placeholder="8位以上字母数字组合" />
                    </div>
                 </div>

                 <div className="flex items-start gap-3 mt-2">
                    <div className="mt-0.5">
                       <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300" />
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                       我已阅读并同意 <a href="#" className="text-blue-600 hover:underline">《智采云服务条款》</a> 和 <a href="#" className="text-blue-600 hover:underline">《隐私政策》</a>，并授权平台进行企业信息核验。
                    </p>
                 </div>

                 <button 
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 mt-2"
                 >
                    {isLoading ? '注册中...' : '立即注册'}
                 </button>

                 <p className="text-center text-sm text-slate-500 mt-6">
                    已有账号? <button type="button" onClick={() => onNavigate('login')} className="text-blue-600 font-bold hover:underline">直接登录</button>
                 </p>
              </form>
           )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
