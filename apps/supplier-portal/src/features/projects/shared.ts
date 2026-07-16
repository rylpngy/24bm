// 供应商项目页共享:方式/邀请状态推导与展示口径(询价/竞价/商城三页共用)。
export const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

export const shortTime = (v?: string | null) => (v ? `${v.slice(0, 10)} ${v.slice(11, 16)}` : '—');

// 邀请函状态:以邀请记录真实字段推导(已拒绝 > 已读(有 viewedAt) > 待查看)。
export function inviteState(inv?: { inviteStatus?: string; viewedAt?: string | null }) {
  if (inv?.inviteStatus === '已拒绝') return '已拒绝';
  if (inv?.viewedAt) return '已读';
  return '待查看';
}

export const inviteTone: Record<string, string> = {
  待查看: 'bg-amber-50 text-amber-700',
  已读: 'bg-emerald-50 text-emerald-700',
  已拒绝: 'bg-red-50 text-red-600',
};
