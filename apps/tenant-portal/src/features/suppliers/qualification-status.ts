const neutral = 'bg-slate-100 text-slate-600 border-slate-200';

export function qualificationAlert(expiresAt?: string, today = new Date()): { label: string; tone: string } {
  if (!expiresAt) return { label: '未登记有效期', tone: neutral };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiresAt);
  if (!match) return { label: '有效期格式异常', tone: neutral };
  const [, y, m, d] = match.map(Number);
  const expiry = new Date(Date.UTC(y, m - 1, d));
  if (expiry.getUTCFullYear() !== y || expiry.getUTCMonth() !== m - 1 || expiry.getUTCDate() !== d) {
    return { label: '有效期格式异常', tone: neutral };
  }
  // Compare calendar dates, not elapsed hours, so a certificate stays valid through its expiry day.
  const days = (expiry.getTime() - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000;
  if (days < 0) return { label: '已过期', tone: 'bg-red-50 text-red-700 border-red-100' };
  if (days <= 30) return { label: days === 0 ? '今日到期' : `${days}天后到期`, tone: 'bg-amber-50 text-amber-700 border-amber-100' };
  return { label: '正常', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
}
