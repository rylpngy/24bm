import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleHelp,
  Database,
  Globe2,
  KeyRound,
  Lock,
  LogIn,
  Megaphone,
  PackageSearch,
  Search,
  ShieldCheck,
  Store,
  User,
  Eye,
  QrCode,
} from 'lucide-react';
import { FeedbackNotice } from '@24bid/ui';
import { SELF_LOGIN_FALLBACK, useBuyerLogin } from '../auth/use-buyer-login';

const ecosystem = [
  {
    icon: Building2,
    title: '对于采购商',
    text: '统一采购工作台、商机管理、供应商协同与合同付款，支撑从需求到履约的全链路透明。',
    tone: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Store,
    title: '对于供应商',
    text: '入驻后维护企业档案、响应询价、跟踪订单与回款节点，降低协同成本。',
    tone: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Database,
    title: '智能大数据',
    text: '沉淀采购、供应、履约和财务数据，形成风险预警、价格洞察与绩效分析。',
    tone: 'bg-violet-50 text-violet-600',
  },
];

const buyers = [
  ['CS', '中国建航', '建筑工程'],
  ['GL', '吉利控股', '汽车制造'],
  ['MD', '美的集团', '家电制造'],
  ['VK', '万科集团', '房地产'],
  ['SY', '三一重工', '机械制造'],
  ['LX', '立讯精密', '电子制造'],
];

const opportunities = [
  ['招标采购', '物流', '集团2024年度核心机房服务器集群扩容项目招标公告', '信息技术部', '2026-07-12'],
  ['询价采购', '服务', 'Q4季度行政办公用品及耗材集中采购询价函', '行政部', '2026-07-11'],
  ['招标采购', '工程', '生产基地自动化流水线改造项目中标结果公示', '生产技术部', '2026-07-10'],
  ['招标采购', '服务', '关于征集2026年度物流运输服务合作伙伴的公告', '供应链管理部', '2026-07-08'],
  ['单一来源', '工程', '三号车间安防监控系统采购项目延期通知', '安环部', '2026-07-06'],
  ['竞价采购', '设备', '废旧钢材及边角料年度回收处置竞价交易', '资产管理部', '2026-07-05'],
];

const suppliers = [
  ['ZK', '真坤行工业超市', 'MRO工业品'],
  ['JD', '京东企业购', '综合物资'],
  ['SE', '施耐德电气', '电气设备'],
  ['SF', '顺丰速运', '物流服务'],
  ['MG', '晨光科力普', '办公用品'],
  ['BS', '宝钢股份', '原材料'],
];

const hotKeywords = ['服务器设备', '办公用品', '物流运输', '辅材工程', 'SaaS软件'];

function LogoMark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-600/25">
        智
      </div>
      <div>
        <p className={`text-base font-black leading-none ${dark ? 'text-white' : 'text-slate-950'}`}>智采云</p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
          Smart Procurement
        </p>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: typeof Building2;
  title: string;
  subtitle: string;
  action?: string;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-black text-slate-950">
          <Icon size={25} className="text-blue-600" />
          {title}
        </h2>
        <p className="mt-2 text-sm font-bold text-slate-500">{subtitle}</p>
      </div>
      {action && (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-black text-blue-600 hover:text-blue-700"
        >
          {action}
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}

function BuyerLoginPage({ onBack }: { onBack: () => void }) {
  const { demoAccounts, handleKeycloakLogin, handleLogin, kcBusy, kcError, login } = useBuyerLogin();
  const [activeTab, setActiveTab] = useState<'password' | 'sms'>('password');

  return (
    <div className="grid min-h-dvh bg-slate-50 lg:grid-cols-[42%_58%]">
      <aside className="relative hidden overflow-hidden bg-slate-950 px-10 py-12 text-white lg:flex lg:flex-col">
        <div className="relative z-10">
          <LogoMark dark />
        </div>
        <div className="relative z-10 mt-28 max-w-lg">
          <h1 className="text-5xl font-black leading-tight">
            连接企业采购的
            <span className="block text-blue-400">数字化未来</span>
          </h1>
          <p className="mt-7 text-xl font-bold leading-9 text-slate-400">
            一站式 SRM 供应商管理与电子招投标平台。让寻源更智能，让交易更透明，让决策更科学。
          </p>
        </div>
        <div className="relative z-10 mt-auto flex items-center gap-5">
          <div className="flex -space-x-3">
            {['bg-blue-200', 'bg-amber-200', 'bg-slate-200', 'bg-emerald-200'].map((tone, index) => (
              <span key={tone} className={`h-11 w-11 rounded-full border-2 border-slate-950 ${tone}`} aria-hidden="true">
                <span className="sr-only">trusted enterprise {index + 1}</span>
              </span>
            ))}
          </div>
          <div>
            <p className="text-lg font-black">10,000+ 家企业信赖</p>
            <p className="mt-1 text-sm font-bold text-slate-500">加入行业领先的采购生态网络</p>
          </div>
        </div>
        <p className="relative z-10 mt-8 text-sm font-bold text-slate-700">© 2026 24Bid Cloud Inc.</p>
        <div className="absolute -bottom-28 left-10 h-[660px] w-[520px] rotate-[-8deg] rounded-[55%] bg-blue-500/10" />
        <div className="absolute bottom-0 right-[-220px] h-[560px] w-[560px] rounded-full bg-indigo-500/10 blur-2xl" />
      </aside>

      <main className="flex min-h-dvh items-center justify-center px-5 py-8">
        <div className="w-full max-w-[430px] rounded-[1.5rem] border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-200/80 sm:p-10">
          <div className="mb-8 text-center">
            <div className="mb-7 flex justify-center lg:hidden">
              <LogoMark />
            </div>
            <h2 className="text-3xl font-black text-slate-950">欢迎回来</h2>
            <p className="mt-3 text-sm font-bold text-slate-500">请登录您的账号以继续管理业务</p>
          </div>

          <div className="mb-7 grid grid-cols-2 rounded-lg bg-slate-50 p-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('password')}
              className={`h-11 rounded-md text-sm font-black transition ${
                activeTab === 'password' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400'
              }`}
            >
              账号密码登录
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sms')}
              className={`h-11 rounded-md text-sm font-black transition ${
                activeTab === 'sms' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400'
              }`}
            >
              手机验证码
            </button>
          </div>

          <div className="space-y-5">
            <label className="block">
              <span className="text-sm font-black text-slate-500">{activeTab === 'password' ? '账号 / 邮箱' : '手机号'}</span>
              <span className="mt-2 flex h-14 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
                <User size={19} className="text-slate-400" />
                <input
                  placeholder={activeTab === 'password' ? '请输入用户名或企业邮箱' : '请输入手机号'}
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-400"
                />
              </span>
            </label>

            <label className="block">
              <span className="flex items-center justify-between text-sm font-black text-slate-500">
                <span>{activeTab === 'password' ? '密码' : '验证码'}</span>
                {activeTab === 'password' && (
                  <button type="button" className="text-xs font-black text-blue-600 hover:text-blue-700">忘记密码?</button>
                )}
              </span>
              <span className="mt-2 flex h-14 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
                <Lock size={19} className="text-slate-400" />
                <input
                  type={activeTab === 'password' ? 'password' : 'text'}
                  placeholder={activeTab === 'password' ? '请输入密码' : '请输入验证码'}
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-400"
                />
                {activeTab === 'password' && <Eye size={18} className="text-slate-400" />}
              </span>
            </label>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleKeycloakLogin}
              disabled={kcBusy}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-black text-white shadow-lg shadow-slate-950/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <KeyRound size={17} />
              {kcBusy ? '登录中' : '登录系统'}
              <ArrowRight size={17} />
            </button>
          </div>
          {kcError && (
            <div className="mt-3">
              <FeedbackNotice tone="error" message="Keycloak 登录失败：请确认 Keycloak 已在 8081 运行。" />
            </div>
          )}

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-100" />
            <span className="text-xs font-black text-slate-400">其他登录方式</span>
            <span className="h-px flex-1 bg-slate-100" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-600 hover:bg-slate-50"
            >
              <QrCode size={18} className="text-emerald-500" />
              微信扫码
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-600 hover:bg-slate-50"
            >
              <Globe2 size={18} className="text-blue-500" />
              钉钉登录
            </button>
          </div>

          {SELF_LOGIN_FALLBACK && (
            <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-400">演示角色</p>
              <div className="grid gap-2">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.account}
                    type="button"
                    onClick={() => handleLogin(acc.account, acc.name)}
                    disabled={login.isPending}
                    className="flex h-9 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <LogIn size={14} className="shrink-0 text-slate-400" />
                    <span>{login.isPending ? '登录中...' : `以${acc.name}登录`}</span>
                    <span className="ml-auto text-[10px] font-bold text-slate-400">{acc.hint}</span>
                  </button>
                ))}
              </div>
              {login.isError && (
                <div className="mt-3">
                  <FeedbackNotice tone="error" message="登录失败：自研登录可能已在后端关闭。" />
                </div>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-sm font-bold text-slate-500">
            还没有账号?
            <button type="button" className="ml-1 font-black text-blue-600 hover:text-blue-700">立即注册企业</button>
          </p>

          <button
            type="button"
            onClick={onBack}
            className="mt-4 w-full text-center text-xs font-black text-slate-400 hover:text-slate-600"
          >
            返回门户首页
          </button>
        </div>
      </main>
    </div>
  );
}

export function PortalLanding() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filteredOpportunities = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) return opportunities;
    return opportunities.filter((item) => item.join('').includes(keyword));
  }, [query]);

  if (loginOpen) {
    return <BuyerLoginPage onBack={() => setLoginOpen(false)} />;
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
          <LogoMark />
          <nav className="hidden items-center gap-8 text-sm font-black text-slate-600 md:flex">
            <a href="#home" className="text-blue-600">首页</a>
            <a href="#opportunities" className="hover:text-blue-600">商机大厅</a>
            <a href="#buyers" className="hover:text-blue-600">采购商城</a>
            <a href="#suppliers" className="hover:text-blue-600">供应商入驻</a>
            <a href="#help" className="hover:text-blue-600">帮助中心</a>
          </nav>
          <div className="flex items-center gap-3">
            <button type="button" className="hidden items-center gap-1.5 text-xs font-black text-slate-600 sm:inline-flex">
              <Globe2 size={15} />
              CN
            </button>
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-black text-white shadow-lg shadow-slate-950/20 hover:bg-slate-800"
            >
              <LogIn size={16} />
              登录 / 注册
            </button>
          </div>
        </div>
      </header>

      <main id="home">
        <section className="relative overflow-hidden bg-slate-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(37,99,235,0.28),transparent_34%),radial-gradient(circle_at_78%_30%,rgba(124,58,237,0.18),transparent_28%)]" />
          <div className="relative mx-auto flex min-h-[520px] max-w-6xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-1.5 text-xs font-black text-blue-200">
              <ShieldCheck size={14} />
              连接 10 万+ 采购商与 500 万+ 供应商
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight text-white sm:text-6xl">
              数据驱动的
              <span className="block bg-gradient-to-r from-blue-300 via-blue-500 to-violet-400 bg-clip-text text-transparent">
                智慧供应链生态
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base font-bold leading-7 text-slate-400">
              24Bid 汇聚采购需求、供应商能力与履约数据，让寻源更智能，让交易更透明，让决策更科学。
            </p>
            <div className="mt-8 flex w-full max-w-2xl items-center gap-3 rounded-lg border border-white/10 bg-white/10 p-2 shadow-2xl shadow-blue-950/30">
              <Search size={20} className="ml-3 shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="请输入采购品目、项目名称或供应商关键词..."
                className="h-11 min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                className="h-11 shrink-0 rounded-md bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-500"
              >
                搜商机
              </button>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-4 text-xs font-bold text-slate-500">
              <span>热门搜索：</span>
              {hotKeywords.map((keyword) => (
                <button key={keyword} type="button" onClick={() => setQuery(keyword)} className="hover:text-blue-300">
                  {keyword}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="-mt-9 rounded-t-[2rem] bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-black text-slate-950">智采云平台生态</h2>
            <p className="mt-3 text-sm font-bold text-slate-500">
              打破企业围墙，构建开放、协同、共赢的产业互联网基础设施
            </p>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {ecosystem.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-lg border border-slate-100 bg-slate-50 p-8">
                    <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${item.tone}`}>
                      <Icon size={24} />
                    </div>
                    <h3 className="mt-6 text-base font-black text-slate-950">{item.title}</h3>
                    <p className="mt-3 text-sm font-bold leading-6 text-slate-500">{item.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="buyers" className="bg-slate-50 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeader icon={Building2} title="入驻采购业主" subtitle="世界 500 强及行业龙头企业都在使用 24Bid" action="我是采购商，立即入驻" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {buyers.map(([code, name, industry]) => (
                <article key={name} className="rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800 font-black text-white shadow-md shadow-slate-300">
                    {code}
                  </div>
                  <p className="mt-4 text-sm font-black text-slate-950">{name}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">{industry}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="opportunities" className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeader icon={Megaphone} title="最新商机" subtitle="实时更新全国各行业采购需求与中标公示" action="进入商机大厅" />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredOpportunities.slice(0, 6).map(([type, category, title, dept, date]) => (
                <article key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
                  <div className="flex gap-2">
                    <span className="rounded-md bg-violet-50 px-2 py-1 text-[11px] font-black text-violet-600">{type}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">{category}</span>
                  </div>
                  <h3 className="mt-4 line-clamp-2 min-h-12 text-sm font-black leading-6 text-slate-950">{title}</h3>
                  <div className="mt-5 flex items-center justify-between gap-3 text-xs font-bold text-slate-400">
                    <span className="inline-flex items-center gap-1.5"><PackageSearch size={14} />{dept}</span>
                    <span>{date}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="suppliers" className="bg-slate-50 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeader icon={Store} title="优质供应商" subtitle="平台认证的行业标杆供应商展示" action="我是供应商，申请入驻" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {suppliers.map(([code, name, industry]) => (
                <article key={name} className="rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                    {code}
                  </div>
                  <p className="mt-4 text-sm font-black text-slate-950">{name}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">{industry}</p>
                </article>
              ))}
            </div>
            <div className="mt-12 rounded-lg bg-blue-600 px-6 py-10 text-center shadow-xl shadow-blue-200">
              <h2 className="text-2xl font-black text-white">加入 24Bid 大平台</h2>
              <p className="mt-3 text-sm font-bold text-blue-100">
                无论是寻找优质货源，还是拓展销售渠道，24Bid 都是值得信赖的合作伙伴。
              </p>
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="mt-7 inline-flex h-11 items-center gap-2 rounded-md bg-white px-6 text-sm font-black text-blue-600 hover:bg-blue-50"
              >
                立即免费注册
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer id="help" className="bg-slate-950 py-14 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-4">
          <div>
            <LogoMark dark />
            <p className="mt-5 text-sm font-bold leading-6 text-slate-500">
              面向未来的企业级智慧采购管理平台，助力企业构建高效、透明、可信的供应链协作网络。
            </p>
          </div>
          <div>
            <p className="font-black text-white">产品服务</p>
            <div className="mt-4 space-y-3 text-sm font-bold text-slate-500">
              <p>商机大厅</p>
              <p>电子招投标</p>
              <p>企业采购商城</p>
            </div>
          </div>
          <div>
            <p className="font-black text-white">帮助支持</p>
            <div className="mt-4 space-y-3 text-sm font-bold text-slate-500">
              <p>供应商入驻指南</p>
              <p>采购商操作手册</p>
              <p>帮助中心</p>
            </div>
          </div>
          <div>
            <p className="font-black text-white">联系我们</p>
            <div className="mt-4 space-y-3 text-sm font-bold text-slate-500">
              <p className="flex items-center gap-2"><CircleHelp size={15} />400-888-9999</p>
              <p className="flex items-center gap-2"><BadgeCheck size={15} />support@24bid.local</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={15} />上海市浦东新区张江高科园区</p>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-white/10 px-4 pt-6 text-xs font-bold text-slate-600 sm:px-6">
          <p>© 2026 24Bid Cloud Inc. All rights reserved.</p>
          <p>隐私政策 · 服务条款 · ICP备12345678号</p>
        </div>
      </footer>

    </div>
  );
}
