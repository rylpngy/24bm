// 设计 token — 三端后台共享视觉语言。

/** 品牌与语义色（Tailwind 工具类，沿用现状）。 */
export const brand = {
  primary: 'blue-600',
  primaryHover: 'blue-700',
  sidebar: 'slate-950',
  appBg: 'slate-100/70',
} as const;

/** StatusPill 的中文状态 → 配色映射。 */
export const statusPositiveLabels = [
  '已启用', '已通过', '已准入', '已定标', '已完成',
  '已付款', '已提交', '已签收',
] as const;

export const statusWarningLabels = [
  '审批中', '报价中', '待付款', '待供应商确认',
  '待收货', '运输中', '试用中', '待准入', '准入审批中', '进行中',
] as const;

export type StatusTone = 'positive' | 'warning' | 'neutral';

/** 按中文状态文本判定语义色调（绿/黄/灰）。 */
export function resolveStatusTone(label: string): StatusTone {
  if ((statusPositiveLabels as readonly string[]).includes(label)) return 'positive';
  if ((statusWarningLabels as readonly string[]).includes(label)) return 'warning';
  return 'neutral';
}

export const statusToneClasses: Record<StatusTone, string> = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
};

/** 各业务模块的主题色（卡片 hover/选中边框）。 */
export const moduleAccent = {
  demand: 'blue',
  rfq: 'indigo',
  order: 'cyan',
  receipt: 'lime',
  invoice: 'fuchsia',
} as const;

/** 操作反馈色调。 */
export type FeedbackTone = 'success' | 'error' | 'info';

export const feedbackToneClasses: Record<FeedbackTone, string> = {
  success: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  error: 'border-red-100 bg-red-50 text-red-700',
  info: 'border-blue-100 bg-blue-50 text-blue-700',
};

/** 按反馈文案推断色调（失败/拒绝→红，已完成/已…→绿，其余→蓝）。 */
export function resolveFeedbackTone(message: string): FeedbackTone {
  if (
    message.includes('失败') ||
    message.includes('拒绝') ||
    message.includes('冻结') ||
    message.includes('不允许')
  ) {
    return 'error';
  }
  if (message.includes('已完成') || message.includes('已')) {
    return 'success';
  }
  return 'info';
}
