// LEGACY NODE PROTOTYPE: retained only as a reference for early MVP flow tests.
// New backend business work belongs in backend-java.
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getBuyerWorkspace, getSupplierWorkspace, getTenantKpis } from '../data/procurementModel.ts';
import {
  createBackendContext,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type BackendPrincipal,
} from './procurementBackend.ts';

type BackendContext = ReturnType<typeof createBackendContext>;

const buyerPrincipal = (backend: BackendContext, request: Request): BackendPrincipal => {
  const tenantId = request.headers.get('X-Tenant-Id');
  const userId = request.headers.get('X-User-Id');
  if (!tenantId || !userId) {
    throw new ForbiddenError('Buyer endpoints require X-Tenant-Id and X-User-Id headers.');
  }
  return backend.auth.asBuyer(tenantId, userId);
};

const supplierPrincipal = (backend: BackendContext, request: Request): BackendPrincipal => {
  const supplierId = request.headers.get('X-Supplier-Id');
  const userId = request.headers.get('X-User-Id');
  if (!supplierId || !userId) {
    throw new ForbiddenError('Supplier endpoints require X-Supplier-Id and X-User-Id headers.');
  }
  return backend.auth.asSupplier(supplierId, userId);
};

const platformPrincipal = (backend: BackendContext, request: Request): BackendPrincipal => {
  const userId = request.headers.get('X-User-Id');
  if (!userId) {
    throw new ForbiddenError('Platform endpoints require X-User-Id header.');
  }
  return backend.auth.asPlatform(userId);
};

const statusForError = (error: Error): number => {
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ValidationError) return 400;
  return 500;
};

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const createHttpApp = (backend = createBackendContext()) => {
  const app = new Hono();

  app.use(
    '/api/*',
    cors({
      origin: (origin) => origin,
      allowHeaders: ['Content-Type', 'X-Tenant-Id', 'X-Supplier-Id', 'X-User-Id'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );

  app.onError((error, c) =>
    c.json(
      {
        error: {
          name: error.name || 'Error',
          message: error.message,
        },
      },
      statusForError(error),
    ),
  );

  app.get('/api/v1/health', (c) => c.json({ status: 'ok', version: 'v1' }));

  app.get('/api/v1/platform/workspace', (c) => {
    platformPrincipal(backend, c.req.raw);
    return c.json({
      data: {
        model: backend.model,
        tenants: backend.model.tenants,
        enterprises: backend.model.enterprises,
      },
    });
  });

  app.get('/api/v1/buyer/workspace', (c) => {
    const principal = buyerPrincipal(backend, c.req.raw);
    const tenantId = principal.tenantId as string;
    return c.json({
      data: {
        workspace: getBuyerWorkspace(backend.model, tenantId),
        kpis: getTenantKpis(backend.model, tenantId),
      },
    });
  });

  app.get('/api/v1/supplier/workspace', (c) => {
    const principal = supplierPrincipal(backend, c.req.raw);
    return c.json({ data: getSupplierWorkspace(backend.model, principal.supplierId as string) });
  });

  app.get('/api/v1/buyer/demands', (c) => {
    const principal = buyerPrincipal(backend, c.req.raw);
    return c.json({ data: backend.demands.list(principal) });
  });

  app.post('/api/v1/buyer/demands', async (c) => {
    const principal = buyerPrincipal(backend, c.req.raw);
    const body = await c.req.json();
    return ok(backend.demands.create(principal, body), 201);
  });

  app.post('/api/v1/buyer/demands/:demandId/submit', (c) => {
    const principal = buyerPrincipal(backend, c.req.raw);
    return ok(backend.demands.submit(principal, c.req.param('demandId')), 201);
  });

  app.get('/api/v1/buyer/rfqs', (c) => {
    const principal = buyerPrincipal(backend, c.req.raw);
    return c.json({ data: backend.rfqs.list(principal) });
  });

  app.post('/api/v1/buyer/rfqs', async (c) => {
    const principal = buyerPrincipal(backend, c.req.raw);
    const body = await c.req.json();
    return ok(backend.rfqs.create(principal, body), 201);
  });

  app.post('/api/v1/supplier/rfqs/:rfqId/quotes', async (c) => {
    const principal = supplierPrincipal(backend, c.req.raw);
    const body = await c.req.json();
    return ok(backend.quotes.submit(principal, c.req.param('rfqId'), body), 201);
  });

  app.post('/api/v1/buyer/rfqs/:rfqId/award', async (c) => {
    const principal = buyerPrincipal(backend, c.req.raw);
    const body = await c.req.json();
    return ok(backend.rfqs.award(principal, c.req.param('rfqId'), body), 201);
  });

  app.post('/api/v1/buyer/orders', async (c) => {
    const principal = buyerPrincipal(backend, c.req.raw);
    const body = await c.req.json();
    return ok(
      backend.orders.createFromAward(principal, body.awardId, {
        expectedReceiptDate: body.expectedReceiptDate,
      }),
      201,
    );
  });

  return app;
};
