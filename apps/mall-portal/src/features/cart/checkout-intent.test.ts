import { expect, it } from 'vitest';
import { checkoutIntent } from './checkout-intent';
it('keeps one submission key for retries and renews it when checkout contents change', () => {
  const first=checkoutIntent(undefined,'cart-a',()=> 'key-a');
  expect(checkoutIntent(first,'cart-a',()=> 'unused')).toBe(first);
  expect(checkoutIntent(first,'cart-b',()=> 'key-b')).toEqual({ fingerprint:'cart-b', key:'key-b' });
});
