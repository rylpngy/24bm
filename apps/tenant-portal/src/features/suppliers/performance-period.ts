export const isPerformancePeriod = (value: string) => /^[1-9][0-9]{3}(?:-(?:Q[1-4]|0[1-9]|1[0-2]))?$/.test(value.trim());
export function currentPerformanceQuarter() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric',
  }).formatToParts(new Date());
  const year = parts.find(part => part.type === 'year')!.value;
  const month = Number(parts.find(part => part.type === 'month')!.value);
  return `${year}-Q${Math.ceil(month / 3)}`;
}
