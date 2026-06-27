// @24bid/ui — shadcn/ui + Radix 复刻的组件库
// 视觉逐像素对齐现有 App.tsx；逐切片补齐 Detail* / *ListRowCard 等其余组件。

export { cn } from './lib/cn';

export { StatusPill } from './components/status-pill';
export type { StatusPillProps } from './components/status-pill';

export { MiniFact } from './components/mini-fact';
export type { MiniFactProps } from './components/mini-fact';

export { Panel } from './components/panel';
export type { PanelProps } from './components/panel';

export { PrimaryActionButton } from './components/primary-action-button';
export type { PrimaryActionButtonProps } from './components/primary-action-button';

export { ResponsiveTableFrame } from './components/responsive-table-frame';
export type { ResponsiveTableFrameProps } from './components/responsive-table-frame';

export { FeedbackNotice } from './components/feedback-notice';
export type { FeedbackNoticeProps } from './components/feedback-notice';

export { AppShell } from './components/app-shell';
export type { AppShellProps } from './components/app-shell';

export {
  DetailHeroCard,
  DetailSection,
  DetailActionPanel,
  DetailKeyValueRow,
  RelatedBusinessRow,
  InlineFactGrid,
} from './components/detail';
export type { Fact } from './components/detail';

export { NextActionNotice, ProcessStateNotice } from './components/notices';
export type { NextActionTone } from './components/notices';

export { WorkflowRail } from './components/workflow-rail';
export type { WorkflowStep } from './components/workflow-rail';

export { ShellState } from './components/shell-state';

export { Tabs } from './components/tabs';
export type { TabsProps, TabItem } from './components/tabs';

export { Pagination } from './components/pagination';
export type { PaginationProps } from './components/pagination';

export { SearchInput } from './components/search-input';
export type { SearchInputProps } from './components/search-input';
