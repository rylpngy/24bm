// Match the server's four-decimal inputs and per-line HALF_UP rounding to cents.
export function projectLineCents(
  quantity: number,
  unitPrice: number,
): bigint | null {
  const scaled = (value: number) => {
    const text = String(value);
    if (!/^\d{1,12}(\.\d{1,4})?$/.test(text)) return null;
    const [whole, fraction = ''] = text.split('.');
    return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
  };
  const q = scaled(quantity),
    p = scaled(unitPrice);
  return q === null || p === null ? null : (q * p + 500000n) / 1000000n;
}

export function projectAmount(
  lines: Array<{ quantity: number; unitPrice: number }>,
): number | null {
  let cents = 0n;
  for (const line of lines) {
    const amount = projectLineCents(line.quantity, line.unitPrice);
    if (amount === null) return null;
    cents += amount;
  }
  return Number(cents) / 100;
}
