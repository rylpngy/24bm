import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('stage three first round form density UI', () => {
  it('keeps detail edit panels and action buttons stable on narrow screens', () => {
    const app = read('App.tsx');
    const detailActionPanel = sliceBetween(app, 'const DetailActionPanel', 'const MiniFact');
    const primaryActionButton = sliceBetween(app, 'const PrimaryActionButton', 'const CapabilityList');

    expect(detailActionPanel).toContain('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between');
    expect(detailActionPanel).toContain('break-words text-xs font-black');
    expect(detailActionPanel).toContain('break-words text-xs font-bold leading-5');
    expect(detailActionPanel).toContain('self-start');
    expect(detailActionPanel).toContain('rounded-lg border border-white/70 bg-white/60 p-3');
    expect(detailActionPanel).toContain('min-w-0 space-y-3 overflow-x-auto');

    expect(primaryActionButton).toContain('min-w-0');
    expect(primaryActionButton).toContain('text-center leading-4');
    expect(primaryActionButton).toContain('max-w-full min-w-0 break-words');
    expect(primaryActionButton).toContain('{busy && pendingLabel ? pendingLabel : children}');
    expect(primaryActionButton).toContain('disabled:text-white/80');
    expect(primaryActionButton).toContain('Icon && <Icon size={14} className="shrink-0" />');
  });
});
