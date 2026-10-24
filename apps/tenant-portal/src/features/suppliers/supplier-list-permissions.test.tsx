import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SupplierListView } from './supplier-list-view';
vi.mock('../shared/excel-import-control', () => ({ ExcelImportControl: () => null }));

const access = vi.hoisted(() => ({ write: false }));
vi.mock('../../lib/use-buyer-permissions', () => ({ useBuyerPermissions: () => ({ can: () => access.write }) }));
vi.mock('@24bid/api-client', () => ({ useBuyerSupplierList: () => ({ data: { data: [] } }) }));
afterEach(() => { cleanup(); access.write = false; });

it('does not offer supplier registration to readers', () => {
  render(<SupplierListView onOpen={() => {}} onRegister={() => {}} />);
  expect(screen.queryByRole('button', { name: '登记供应商' })).toBeNull();
});

it('offers registration to supplier maintainers', () => {
  access.write = true;
  render(<SupplierListView onOpen={() => {}} onRegister={() => {}} />);
  expect(screen.getByRole('button', { name: '登记供应商' })).toBeTruthy();
});
