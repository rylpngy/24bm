import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('stage three first round detail density UI', () => {
  it('keeps detail headers, sections, and facts readable with long business text', () => {
    const app = read('App.tsx');
    const detailHeroCard = sliceBetween(app, 'const DetailHeroCard', 'const DetailSection');
    const detailSection = sliceBetween(app, 'const DetailSection', 'const parseAttachmentNames');
    const detailKeyValueRow = sliceBetween(app, 'const DetailKeyValueRow', 'const RelatedBusinessRow');
    const inlineFactGrid = sliceBetween(app, 'const InlineFactGrid', 'const nextActionToneClasses');

    expect(detailHeroCard).toContain('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between');
    expect(detailHeroCard).toContain('break-words text-base font-black text-slate-950');
    expect(detailHeroCard).not.toContain('truncate text-base font-black');
    expect(detailHeroCard).toContain('max-w-full font-mono text-xl font-black');

    expect(detailSection).toContain('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between');
    expect(detailSection).toContain('break-words text-xs font-black text-slate-600');
    expect(detailSection).toContain('self-start rounded-lg');

    expect(detailKeyValueRow).toContain('min-w-0');
    expect(detailKeyValueRow).toContain('sm:min-w-[7rem]');
    expect(detailKeyValueRow).toContain('max-w-full break-words');

    expect(inlineFactGrid).toContain('grid gap-2 sm:grid-cols-2 xl:grid-cols-4');
    expect(inlineFactGrid).not.toContain('grid-cols-2 xl:grid-cols-4 md:grid-cols-2');
  });
});
