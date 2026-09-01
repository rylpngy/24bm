import { useState } from 'react';
import { axiosInstance } from '@24bid/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { FeedbackNotice, PrimaryActionButton } from '@24bid/ui';
import {
  Archive,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  LockKeyhole,
  LogIn,
  UserRound,
} from 'lucide-react';
import { useAuthStore } from '../../lib/auth-store';

const demoAccounts = [
  ['LDU000001', 'POC 管理员'],
  ['LDU100001', '项目申报人'],
  ['LDU200001', '购置必要性论证人'],
  ['LDU200002', '教育信息技术部审核人'],
] as const;

const featureItems = [
  { icon: FileText, title: '采购项目线上申报', note: '统一填报项目与设备配置明细' },
  { icon: CheckCircle2, title: '分级审批协同办理', note: '自定义节点、审批岗位和条件路由' },
  { icon: Archive, title: '原表生成与材料归档', note: '审批完成后统一下载留存' },
];

export function LudongPocLogin() {
  const signIn = useAuthStore((state) => state.signIn);
  const queryClient = useQueryClient();
  const [employeeNo, setEmployeeNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const login = async () => {
    if (!employeeNo.trim()) {
      setError('请输入工号。');
      return;
    }
    if (!password.trim()) {
      setError('请输入登录密码。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await axiosInstance.post('/api/v1/auth/login', {
        account: employeeNo.trim(),
        password,
        scope: 'BUYER',
        tenantId: 'tenant-ludong-poc',
      });
      const data = response.data?.data;
      if (!data?.accessToken) throw new Error('登录响应缺少令牌');
      signIn({
        token: data.accessToken,
        userId: data.userId,
        displayName: data.displayName ?? employeeNo.trim(),
        tenantId: data.tenantId,
      });
      queryClient.clear();
    } catch (reason) {
      const message = (reason as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message === 'Invalid account or password' ? '工号或密码错误，请重新输入。' : (message || '登录失败，请确认 POC 后端与演示数据已经启动。'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(30rem,0.92fr)]">
      <section className="relative min-h-[16rem] overflow-hidden bg-emerald-950 text-white lg:min-h-dvh">
        <img
          src="/ludong-poc/campus-entrance.jpg"
          alt="鲁东大学校园正门"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-emerald-950/80" />
        <div className="relative z-10 mx-auto flex h-full min-h-[16rem] max-w-3xl flex-col px-6 py-7 sm:px-10 lg:min-h-dvh lg:px-14 lg:py-12 xl:px-20">
          <img
            src="/ludong-poc/ldu-logo.png"
            alt="鲁东大学"
            className="h-auto w-52 object-contain object-left sm:w-60"
          />

          <div className="my-auto max-w-2xl py-8 lg:py-16">
            <p className="mb-4 inline-flex items-center gap-2 border-l-2 border-amber-300 pl-3 text-sm font-bold text-emerald-50">
              采购项目申报与审批系统
            </p>
            <h1 className="max-w-xl text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
              规范申报流程
              <br />
              提升采购协同效率
            </h1>
            <p className="mt-5 max-w-xl text-sm font-medium leading-7 text-emerald-50/90 sm:text-base">
              面向校内货物类采购项目，完成项目填报、分级审批、表格生成、材料归档与数据统计。
            </p>

            <div className="mt-8 hidden max-w-xl grid-cols-1 gap-4 sm:grid lg:mt-10">
              {featureItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-center gap-3 border-t border-white/15 pt-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10 text-amber-200">
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white">{item.title}</p>
                      <p className="mt-0.5 truncate text-xs font-medium text-emerald-100/75">{item.note}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-5 text-xs font-bold text-emerald-100/80">
            <span>厚德 · 博学 · 日新 · 笃行</span>
            <span className="hidden sm:inline">山东省烟台市芝罘区红旗中路186号</span>
          </div>
        </div>
      </section>

      <section className="flex min-h-[calc(100dvh-16rem)] items-center justify-center bg-white px-5 py-10 sm:px-10 lg:min-h-dvh lg:px-12 xl:px-20">
        <div className="w-full max-w-[30rem]">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white shadow-sm">
              24
            </span>
            <div className="min-w-0">
              <p className="text-base font-black text-slate-950">24Bid 采购管理平台</p>
              <p className="mt-0.5 text-xs font-bold text-slate-500">鲁东大学采购申报 POC</p>
            </div>
          </div>

          <header className="mb-7">
            <h2 className="text-2xl font-black text-slate-950">统一身份登录</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">请使用校内工号和登录密码进入系统，权限由组织岗位和业务角色统一确定。</p>
          </header>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void login();
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">工号</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  aria-label="工号"
                  value={employeeNo}
                  onChange={(event) => {
                    setEmployeeNo(event.target.value.toUpperCase());
                    setError('');
                  }}
                  autoComplete="username"
                  placeholder="请输入校内工号"
                  className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 font-mono text-sm font-bold uppercase text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">登录密码</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  aria-label="登录密码"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-12 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            {error && <FeedbackNotice tone="error" message={error} />}

            <PrimaryActionButton
              icon={LogIn}
              type="submit"
              flushTop
              fullWidth
              size="md"
              busy={busy}
              pendingLabel="登录中"
              disabled={busy}
              onClick={() => undefined}
            >
              工号登录
            </PrimaryActionButton>
          </form>

          <details className="mt-6 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
            <summary className="cursor-pointer text-sm font-black text-slate-700">POC 演示账号参考</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {demoAccounts.map(([account, label]) => (
                <div key={account} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                  <p className="font-mono text-xs font-black text-blue-700">{account}</p>
                  <p className="mt-0.5 truncate text-[11px] font-bold text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500">演示环境统一密码：demo123456。岗位仅作账号说明，仍需输入工号和密码后登录。</p>
          </details>

          <p className="mt-6 text-center text-xs font-medium text-slate-400">
            本页面用于鲁东大学采购项目流程 POC 验证
          </p>
        </div>
      </section>
    </main>
  );
}
