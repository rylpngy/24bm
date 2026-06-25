// 纯展示/计算工具——可单测,供三端复用(此前散落在各组件内联实现)。

/** 人民币金额格式化(两位小数);空值返回占位符。 */
export function formatCurrency(value?: number | null, placeholder = '—'): string {
  if (value == null) return placeholder;
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}

/** 合格率/百分比:分子/分母 → 0-100 整数百分比;分母为 0 返回 null。 */
export function ratePercent(numerator?: number | null, denominator?: number | null): number | null {
  if (denominator == null || denominator <= 0 || numerator == null) return null;
  return Math.round((numerator * 100) / denominator);
}

/** SRM 综合分 → 建议生命周期标记(与后端 SupplierPerformanceScoring 阈值一致)。 */
export function suggestTier(totalScore: number): string {
  if (totalScore >= 90) return '优选';
  if (totalScore >= 75) return '合格';
  if (totalScore >= 60) return '观察';
  return '淘汰';
}

/** 从 Content-Disposition 解析下载文件名,失败回退到 fallback。 */
export function parseContentDispositionFilename(disposition: string, fallback: string): string {
  const match = /filename\*?=(?:UTF-8'')?["']?([^;"'\n]+)/i.exec(disposition ?? '');
  return match ? decodeURIComponent(match[1]) : fallback;
}
