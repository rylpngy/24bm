import { expect, it } from 'vitest';
import { qualificationAlert } from './qualification-status';

const today = new Date(2026, 9, 23, 23, 59);
it.each([
  [undefined, '未登记有效期'], ['', '未登记有效期'], ['invalid', '有效期格式异常'],
  ['2026-02-30', '有效期格式异常'], ['2026-10-22', '已过期'],
  ['2026-10-23', '今日到期'], ['2026-10-24', '1天后到期'],
  ['2026-11-22', '30天后到期'], ['2026-11-23', '正常'],
])('classifies %s without treating unknown dates as valid', (date, label) => {
  expect(qualificationAlert(date, today).label).toBe(label);
});
