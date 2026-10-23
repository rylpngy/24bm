export const currency = (value?: number) =>
  value == null ? '—' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const departmentMap: Record<string, string> = {
  'dept-it': '信息化部',
  'dept-admin': '行政部',
  'dept-finance': '财务部',
  'dept-purchase': '采购部',
  'dept-hq': '集团总部',
};

export function departmentLabel(id?: string) {
  return id ? departmentMap[id] ?? id : '—';
}
