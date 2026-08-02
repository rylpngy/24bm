// @24bid/ui — shadcn/ui + Radix 复刻的组件库
// 三端后台共享组件从这里导出。

export { cn } from './lib/cn';

// i18n(G-3):以中文原文为 key、缺条目回落中文的轻量方案,详见 i18n/i18n.tsx。
export { I18nProvider, useI18n } from './i18n/i18n';
export type { Locale } from './i18n/i18n';
export { EN_DICTIONARY } from './i18n/en';

export { StatusPill } from './components/status-pill';
export type { StatusPillProps } from './components/status-pill';

export { MiniFact } from './components/mini-fact';
export type { MiniFactProps } from './components/mini-fact';

export { Panel } from './components/panel';
export type { PanelProps } from './components/panel';

export { SignaturePad, EsignRecordList } from './components/signature-pad';
export type { SignaturePadProps, EsignRecordItem } from './components/signature-pad';
export { RichTextEditor, RichTextView, richTextToPlain, sanitizeRichText } from './components/rich-text';
export type { RichTextEditorProps } from './components/rich-text';
export { PrimaryActionButton } from './components/primary-action-button';
export type { PrimaryActionButtonProps } from './components/primary-action-button';

export { ResponsiveTableFrame } from './components/responsive-table-frame';
export type { ResponsiveTableFrameProps } from './components/responsive-table-frame';

export { FilterTabs } from './components/filter-tabs';
export type { FilterTabItem, FilterTabsProps } from './components/filter-tabs';

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

export { CountTag } from './components/count-tag';
export type { CountTagProps } from './components/count-tag';
export { MetricGrid, MetricCard, SummaryChips, SummaryChip } from './components/metric-card';

export { ConfirmDialog } from './components/confirm-dialog';
export type { ConfirmDialogProps } from './components/confirm-dialog';

export { FormErrorSummary } from './components/form-error-summary';
export type { FormErrorSummaryProps } from './components/form-error-summary';
export { SectionCard, ApprovalTimeline } from './components/section-card';
export type { ApprovalTimelineNode } from './components/section-card';
