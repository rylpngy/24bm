import { expect, it } from 'vitest';
import { planDemandLines } from './procurement-plan-lines';
it('never repeats a multi-line demand budget as every line subtotal', () => {
  const rows = planDemandLines(
    [
      {
        id: 'd',
        budget: 100,
        lineItems: [
          { materialId: 'm', quantity: 2 },
          { materialId: 'n', quantity: 4 },
        ],
      },
    ],
    [
      {
        id: 'm',
        name: '实验设备',
        unit: '套',
        specification: '型号A',
        referencePrice: 10,
      },
    ],
  );
  expect(rows[0]).toMatchObject({
    unit: '套',
    spec: '型号A',
    budgetUnit: null,
    subtotal: null,
  });
  expect(rows[1].subtotal).toBeNull();
});
it('preserves exact single-line allocation without rounding whole yuan or inventing material metadata', () => {
  const [r] = planDemandLines(
    [{ budget: 10.01, lineItems: [{ materialId: 'missing', quantity: 3 }] }],
    [],
  );
  expect(r.unit).toBe('—');
  expect(r.budgetUnit).toBe(10.01 / 3);
  expect(r.subtotal).toBe(10.01);
  expect(r.referencePrice).toBeNull();
});
