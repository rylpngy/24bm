// LEGACY NODE PROTOTYPE: starts the old Hono prototype only.
// New backend business work belongs in backend-java.
import { serve } from '@hono/node-server';
import { createHttpApp } from '../server/httpApp.ts';

const port = Number(process.env.API_PORT ?? 8787);
const app = createHttpApp();

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`24Bid API listening on http://localhost:${info.port}`);
  },
);
