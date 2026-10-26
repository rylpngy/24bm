export function invoiceLineCents(
  quantity: string,
  unitPrice: number,
): number | null {
  if (
    !/^\d+(\.\d{1,4})?$/.test(quantity) ||
    !Number.isFinite(unitPrice) ||
    unitPrice < 0
  )
    return null;
  const [whole, fraction = ''] = quantity.split('.');
  const q = BigInt(whole!) * 10000n + BigInt(fraction.padEnd(4, '0'));
  if (q > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const text = unitPrice.toFixed(2);
  if (!/^\d+\.\d{2}$/.test(text)) return null;
  const p = BigInt(text.replace('.', ''));
  const value = (q * p + 5000n) / 10000n;
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}
