import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleHelp,
  Database,
  KeyRound,
  Lock,
  LogIn,
  Megaphone,
  Search,
  ShieldCheck,
  Store,
  User,
  Eye,
} from 'lucide-react';
import { FeedbackNotice } from '@24bid/ui';
import { SELF_LOGIN_FALLBACK, useBuyerLogin } from '../auth/use-buyer-login';
import {
  HomeAnnouncementsStrip,
  HomeOpportunitiesSection,
  HomeSuppliersSection,
  PortalAnnouncementsPage,
  PortalMallPage,
  PortalSupplierRegisterPage,
  PortalOpportunitiesPage,
  PortalSuppliersPage,
} from './portal-public-pages';

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
    text: '入驻后维护企业档案、响应询比、跟踪订单与回款节点，降低协同成本。',
    tone: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Database,
    title: '智能大数据',
    text: '沉淀采购、供应、履约和财务数据，形成风险预警、价格洞察与绩效分析。',
    tone: 'bg-violet-50 text-violet-600',
  },
];

// 以下均为演示环境示例数据(虚构企业名),正式环境替换为真实入驻企业与发布商机。
const buyers = [
  ['HY', '宏远建设(演示)', '建筑工程'],
  ['LW', '蓝湾汽车(演示)', '汽车制造'],
  ['HX', '华信电子(演示)', '电子制造'],
  ['ST', '盛泰置业(演示)', '房地产'],
  ['JG', '精工机械(演示)', '机械制造'],
  ['BC', '北辰新材(演示)', '新材料'],
];

const hotKeywords = ['服务器设备', '办公用品', '物流运输', '辅材工程', 'SaaS软件'];

function LogoMark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white shadow-sm">
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
  onAction,
}: {
  icon: typeof Building2;
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
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
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-blue-600 hover:bg-slate-50"
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
  const [username, setUsername] = useState('buyer.owner@example.com');
  const [password, setPassword] = useState('demo123456');
  const [showPassword, setShowPassword] = useState(false);

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
        <div className="relative z-10 mt-auto">
          <p className="text-lg font-black">三端协同 · 全流程留痕</p>
          <p className="mt-1 text-sm font-bold text-slate-500">
            采购方 / 供应商 / 平台运营三端联动,询比、竞价、商城、单一来源全流程线上化。
          </p>
        </div>
        <p className="relative z-10 mt-8 text-sm font-bold text-slate-700">© 2026 24Bid Cloud Inc.</p>
        <div className="absolute -bottom-28 left-10 h-[660px] w-[520px] rotate-[-8deg] rounded-[55%] bg-blue-500/10" />
        <div className="absolute bottom-0 right-[-220px] h-[560px] w-[560px] rounded-full bg-indigo-500/10 blur-2xl" />
      </aside>

      <main className="flex min-h-dvh items-center justify-center px-5 py-8">
        <div className="w-full max-w-[430px] rounded-lg border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/60 sm:p-10">
          <div className="mb-8 text-center">
            <div className="mb-7 flex justify-center lg:hidden">
              <LogoMark />
            </div>
            <h2 className="text-3xl font-black text-slate-950">欢迎回来</h2>
            <p className="mt-3 text-sm font-bold text-slate-500">请登录您的账号以继续管理业务</p>
          </div>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleKeycloakLogin(username, password);
            }}
          >
            <label className="block">
              <span className="text-xs font-black text-slate-500">账号 / 邮箱</span>
              <span className="mt-2 flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
                <User size={16} className="text-slate-400" />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  placeholder="请输入用户名或企业邮箱"
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                />
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-black text-slate-500">密码</span>
              <span className="mt-2 flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
                <Lock size={16} className="text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="请输入密码"
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <Eye size={16} />
                </button>
              </span>
            </label>

            <button
              type="submit"
              disabled={kcBusy || !username.trim() || !password}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <KeyRound size={17} />
              {kcBusy ? '登录中' : '登录系统'}
              <ArrowRight size={17} />
            </button>
          </form>
          {kcError && (
            <div className="mt-3">
              <FeedbackNotice tone="error" message="登录失败：请检查账号密码，或确认 Keycloak 已在 8081 运行。" />
            </div>
          )}
          <p className="mt-4 text-center text-xs font-bold text-slate-400">
            统一身份认证由 Keycloak(OIDC)提供，登录即代表同意平台服务协议。
          </p>

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

          <p className="mt-6 text-center text-xs font-bold text-slate-500">
            还没有账号？企业开户与成员邀请由平台运营方统一开通，请联系管理员。
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

type PortalPage = 'home' | 'opportunities' | 'mall' | 'suppliers' | 'announcements' | 'supplier-register';

export function PortalLanding() {
  const [loginOpen, setLoginOpen] = useState(false);
  // 门户页面路由(?page= 深链接):home / suppliers 供应商名录 / announcements 平台公告。
  const [page, setPageState] = useState<PortalPage>(() => {
    const p = new URLSearchParams(window.location.search).get('page');
    return p === 'suppliers' || p === 'announcements' || p === 'opportunities' || p === 'mall' || p === 'supplier-register' ? p : 'home';
  });
  const setPage = (next: PortalPage) => {
    setPageState(next);
    const url = new URL(window.location.href);
    if (next === 'home') url.searchParams.delete('page');
    else url.searchParams.set('page', next);
    window.history.replaceState(null, '', url.toString());
    window.scrollTo({ top: 0 });
  };
  const [query, setQuery] = useState('');

  if (loginOpen) {
    return <BuyerLoginPage onBack={() => setLoginOpen(false)} />;
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
          <LogoMark />
          <nav className="hidden items-center gap-8 text-sm font-black text-slate-600 md:flex">
            <button type="button" onClick={() => setPage('home')} className={page === 'home' ? 'text-blue-600' : 'hover:text-blue-600'}>首页</button>
            <button type="button" onClick={() => setPage('opportunities')} className={page === 'opportunities' ? 'text-blue-600' : 'hover:text-blue-600'}>商机大厅</button>
            <button type="button" onClick={() => setPage('mall')} className={page === 'mall' ? 'text-blue-600' : 'hover:text-blue-600'}>采购商城</button>
            <button type="button" onClick={() => setPage('suppliers')} className={page === 'suppliers' ? 'text-blue-600' : 'hover:text-blue-600'}>供应商名录</button>
            <button type="button" onClick={() => setPage('announcements')} className={page === 'announcements' ? 'text-blue-600' : 'hover:text-blue-600'}>平台公告</button>
            <button type="button" onClick={() => setPage('supplier-register')} className={page === 'supplier-register' ? 'text-blue-600' : 'hover:text-blue-600'}>供应商入驻</button>
            <a href="#help" onClick={() => setPage('home')} className="hover:text-blue-600">帮助中心</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-black text-white shadow-sm hover:bg-slate-800"
            >
              <LogIn size={16} />
              登录 / 注册
            </button>
          </div>
        </div>
      </header>

      {page === 'supplier-register' ? (
        <main className="min-h-[60vh] bg-slate-50">
          <PortalSupplierRegisterPage />
        </main>
      ) : page === 'mall' ? (
        <main className="min-h-[60vh] bg-slate-50">
          <PortalMallPage onLogin={() => setLoginOpen(true)} />
        </main>
      ) : page === 'opportunities' ? (
        <main className="min-h-[60vh] bg-slate-50">
          <PortalOpportunitiesPage />
        </main>
      ) : page === 'suppliers' ? (
        <main className="min-h-[60vh] bg-slate-50">
          <PortalSuppliersPage onLogin={() => setLoginOpen(true)} />
        </main>
      ) : page === 'announcements' ? (
        <main className="min-h-[60vh] bg-slate-50">
          <PortalAnnouncementsPage />
        </main>
      ) : (
      <main id="home">
        <section className="relative overflow-hidden bg-slate-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(37,99,235,0.28),transparent_34%),radial-gradient(circle_at_78%_30%,rgba(124,58,237,0.18),transparent_28%)]" />
          <div className="relative mx-auto flex min-h-[520px] max-w-6xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-1.5 text-xs font-black text-blue-200">
              <ShieldCheck size={14} />
              询比 · 竞价 · 商城 · 单一来源 全流程线上化
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
            <div className="mt-8 flex w-full max-w-2xl items-center gap-3 rounded-lg border border-white/10 bg-white/10 p-2 shadow-sm">
              <Search size={20} className="ml-3 shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="请输入采购品目、项目名称或供应商关键词..."
                className="h-11 min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setPage('opportunities')}
                className="inline-flex h-11 shrink-0 items-center rounded-md bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-500"
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
                    <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-lg ${item.tone}`}>
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

        <HomeAnnouncementsStrip onOpenAll={() => setPage('announcements')} />

        <section id="buyers" className="bg-slate-50 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeader
              icon={Building2}
              title="入驻采购业主"
              subtitle="演示环境示例展示(虚构企业)· 正式环境呈现真实入驻企业"
              action="我是采购商，登录入驻"
              onAction={() => setLoginOpen(true)}
            />
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
            <SectionHeader
              icon={Megaphone}
              title="最新商机"
              subtitle="平台采购人发布的项目公开信息 · 实时更新"
              action="进入商机大厅"
              onAction={() => setPage('opportunities')}
            />
            <HomeOpportunitiesSection onOpenHall={() => setPage('opportunities')} />
          </div>
        </section>

        <section id="suppliers" className="bg-slate-50 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeader
              icon={Store}
              title="优质供应商"
              subtitle="平台认证供应商 · 实时公开名录"
              action="进入供应商名录"
              onAction={() => setPage('suppliers')}
            />
            <HomeSuppliersSection onOpenDirectory={() => setPage('suppliers')} />
            <div className="mt-12 rounded-lg bg-blue-600 px-6 py-10 text-center shadow-sm">
              <h2 className="text-2xl font-black text-white">加入 24Bid 大平台</h2>
              <p className="mt-3 text-sm font-bold text-blue-100">
                无论是寻找优质货源，还是拓展销售渠道，24Bid 都是值得信赖的合作伙伴。
              </p>
              <button
                type="button"
                onClick={() => setPage('supplier-register')}
                className="mt-7 inline-flex h-11 items-center gap-2 rounded-md bg-white px-6 text-sm font-black text-blue-600 hover:bg-blue-50"
              >
                申请供应商入驻
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>
      )}

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
              <p className="flex items-center gap-2"><BadgeCheck size={15} />support@24bid.local</p>
              <p className="flex items-center gap-2"><CircleHelp size={15} />工作日 9:00 - 18:00 响应</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={15} />当前为演示环境</p>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-white/10 px-4 pt-6 text-xs font-bold text-slate-600 sm:px-6">
          <p>© 2026 24Bid Cloud Inc. All rights reserved.</p>
          <p>演示环境 · 页面示例数据不代表真实交易</p>
        </div>
      </footer>

    </div>
  );
}
