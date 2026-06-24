import { StatusPill } from '@24bid/ui';

// S0-1 占位骨架：运营后台独立 app（安全隔离，私有化常不交付）。
export function App() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-100/70 text-slate-900 lg:flex-row">
      <aside className="hidden shrink-0 flex-col bg-slate-950 text-white lg:flex lg:w-72">
        <div className="border-b border-white/10 p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-lg font-black shadow-lg shadow-blue-950/40">
            24
          </div>
          <p className="mt-3 text-lg font-black leading-none">24Bid</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-blue-300">
            Platform Admin
          </p>
        </div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white/95 px-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            当前工作区
          </p>
          <h1 className="text-lg font-black text-slate-900">平台运营后台</h1>
        </header>
        <section className="min-h-0 flex-1 overflow-y-auto bg-slate-100/70">
          <div className="mx-auto w-full max-w-7xl space-y-5 p-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
              <h3 className="font-black text-slate-950">S0-1 骨架自检</h3>
              <p className="mt-1 text-xs font-bold text-slate-400">
                运营后台已与外部门户物理隔离为独立 app。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill label="已启用" />
                <StatusPill label="试用中" />
                <StatusPill label="已停用" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
