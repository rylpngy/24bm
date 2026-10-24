export interface CheckoutIntent { fingerprint: string; key: string }
export function checkoutIntent(previous: CheckoutIntent | undefined, fingerprint: string, createKey: () => string = () => crypto.randomUUID()): CheckoutIntent {
  return previous?.fingerprint === fingerprint ? previous : { fingerprint, key: createKey() };
}
