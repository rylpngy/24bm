import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

export class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="space-y-3 p-6 text-sm text-slate-700">
        <p>页面加载失败，请刷新后重试。</p>
        <button type="button" onClick={() => window.location.reload()}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 font-semibold hover:bg-slate-50">
          <RefreshCw size={16} />刷新页面
        </button>
      </div>
    );
  }
}
