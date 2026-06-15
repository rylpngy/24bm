// LEGACY NODE PROTOTYPE: demos the old Hono prototype only.
// New backend business work belongs in backend-java.
import { createHttpApp } from '../server/httpApp.ts';

const app = createHttpApp();
const buyerHeaders = {
  'content-type': 'application/json',
  'X-Tenant-Id': 'tenant-acme',
  'X-User-Id': 'u-acme-admin',
};
const supplierHeaders = {
  'content-type': 'application/json',
  'X-Supplier-Id': 'supplier-orbit',
  'X-User-Id': 'u-orbit-sales',
};

const post = async (path, body, headers = buyerHeaders) => {
  const response = await app.request(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${path} failed: ${JSON.stringify(payload)}`);
  }
  return payload.data;
};

const rfq = await post('/api/v1/buyer/rfqs', {
  title: 'HTTP Demo 询价',
  demandIds: ['dem-acme-1'],
  invitedSupplierIds: ['supplier-orbit'],
  deadline: '2026-09-01',
});
const quote = await post(
  `/api/v1/supplier/rfqs/${rfq.id}/quotes`,
  {
    amount: 168000,
    taxRate: 13,
    deliveryDays: 6,
  },
  supplierHeaders,
);
const award = await post(`/api/v1/buyer/rfqs/${rfq.id}/award`, {
  quoteId: quote.id,
  reason: 'HTTP demo supplier meets price and delivery requirements',
});
const order = await post('/api/v1/buyer/orders', {
  awardId: award.id,
  expectedReceiptDate: '2026-09-15',
});

console.log(JSON.stringify({ rfq, quote, award, order }, null, 2));
