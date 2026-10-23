const neutral = 'bg-slate-100 text-slate-600 border-slate-200';

export type QualificationExpiryState = 'unknown' | 'expired' | 'expiring' | 'valid';
export function qualificationAlert(expiresAt?: string, today = new Date()): { label: string; tone: string; state: QualificationExpiryState } {
  if (!expiresAt) return { label: '未登记有效期', tone: neutral, state: 'unknown' };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiresAt);
  if (!match) return { label: '有效期格式异常', tone: neutral, state: 'unknown' };
  const [, y, m, d] = match.map(Number);
  const expiry = new Date(Date.UTC(y, m - 1, d));
  if (expiry.getUTCFullYear() !== y || expiry.getUTCMonth() !== m - 1 || expiry.getUTCDate() !== d) {
    return { label: '有效期格式异常', tone: neutral, state: 'unknown' };
  }
  // Compare calendar dates, not elapsed hours, so a certificate stays valid through its expiry day.
  const days = (expiry.getTime() - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000;
  if (days < 0) return { label: '已过期', tone: 'bg-red-50 text-red-700 border-red-100', state: 'expired' };
  if (days <= 30) return { label: days === 0 ? '今日到期' : `${days}天后到期`, tone: 'bg-amber-50 text-amber-700 border-amber-100', state: 'expiring' };
  return { label: '正常', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', state: 'valid' };
}
