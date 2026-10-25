import type {
  MaterialResponse,
  PurchaseDemandResponse,
} from '@24bid/api-client';
export function planDemandLines(
  demands: PurchaseDemandResponse[],
  materials: MaterialResponse[],
) {
  const index = new Map(materials.map((m) => [m.id, m]));
  return demands.flatMap((d) =>
    (d.lineItems || []).map((line) => {
      const m = index.get(line.materialId),
        quantity = line.quantity ?? 0;
      const subtotal =
        d.lineItems?.length === 1 && typeof d.budget === 'number'
          ? d.budget
          : null;
      return {
        demandId: d.id,
        demandTitle: d.title,
        materialName: m?.name || line.materialId || '未登记物料',
        spec: m?.specification || '—',
        quantity,
        unit: m?.unit || '—',
        budgetUnit:
          subtotal != null && quantity > 0 ? subtotal / quantity : null,
        referencePrice: m?.referencePrice ?? null,
        subtotal,
      };
    }),
  );
}
