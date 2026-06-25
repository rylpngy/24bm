import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  parseContentDispositionFilename,
  ratePercent,
  suggestTier,
} from './formatting';

describe('formatCurrency', () => {
  it('formats with ¥ and two decimals', () => {
    expect(formatCurrency(1119)).toBe('¥1,119.00');
    expect(formatCurrency(0)).toBe('¥0.00');
  });
  it('returns placeholder for null/undefined', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency(undefined, 'N/A')).toBe('N/A');
  });
});

describe('ratePercent', () => {
  it('rounds numerator/denominator to a percent', () => {
    expect(ratePercent(495, 500)).toBe(99); // 99.0
    expect(ratePercent(1995, 2000)).toBe(100); // 99.75 → 100
    expect(ratePercent(1, 2)).toBe(50);
  });
  it('returns null when denominator is zero or missing', () => {
    expect(ratePercent(5, 0)).toBeNull();
    expect(ratePercent(5, null)).toBeNull();
    expect(ratePercent(null, 10)).toBeNull();
  });
});

describe('suggestTier', () => {
  it('maps total score to lifecycle tier at the thresholds', () => {
    expect(suggestTier(90)).toBe('优选');
    expect(suggestTier(89.99)).toBe('合格');
    expect(suggestTier(75)).toBe('合格');
    expect(suggestTier(60)).toBe('观察');
    expect(suggestTier(59)).toBe('淘汰');
  });
});

describe('parseContentDispositionFilename', () => {
  it('extracts RFC5987 UTF-8 filename', () => {
    expect(
      parseContentDispositionFilename("attachment; filename*=UTF-8''invoices.xlsx", 'fallback.bin'),
    ).toBe('invoices.xlsx');
  });
  it('extracts plain quoted filename', () => {
    expect(parseContentDispositionFilename('attachment; filename="reconciliation.pdf"', 'x')).toBe(
      'reconciliation.pdf',
    );
  });
  it('falls back when no filename present', () => {
    expect(parseContentDispositionFilename('attachment', 'fallback.bin')).toBe('fallback.bin');
    expect(parseContentDispositionFilename('', 'fallback.bin')).toBe('fallback.bin');
  });
});
