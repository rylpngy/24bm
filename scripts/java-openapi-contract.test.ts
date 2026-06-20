import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

type JavaRoute = {
  method: string;
  path: string;
};

const read = (path: string) => readFileSync(join(root, path), 'utf8');

const listFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    return statSync(fullPath).isDirectory() ? listFiles(fullPath) : [fullPath];
  });

const annotationPath = (annotationArgs: string | undefined) => {
  if (!annotationArgs?.trim()) return '';
  return annotationArgs.match(/"([^"]*)"/)?.[1] ?? '';
};

const joinRoutePath = (basePath: string, childPath: string) =>
  `/${[basePath, childPath]
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')}`;

const extractJavaControllerRoutes = (): JavaRoute[] => {
  const controllerFiles = listFiles(join(root, 'backend-java/src/main/java/com/procurement')).filter((file) =>
    file.endsWith('Controller.java'),
  );

  return controllerFiles.flatMap((file) => {
    const source = read(file.replace(`${root}/`, ''));
    const basePath = annotationPath(source.match(/@RequestMapping\(([^)]*)\)/)?.[1]);
    const routes: JavaRoute[] = [];
    const mappingPattern = /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping)(?:\(([^)]*)\))?/g;
    let match: RegExpExecArray | null;

    while ((match = mappingPattern.exec(source))) {
      routes.push({
        method: match[1].replace('Mapping', '').toUpperCase(),
        path: joinRoutePath(basePath, annotationPath(match[2])),
      });
    }

    return routes;
  });
};

const openApiOperations = () => {
  const openApi = JSON.parse(read('docs/openapi-draft.json')) as {
    paths: Record<string, Record<string, unknown>>;
    servers: Array<{ url: string }>;
  };
  const apiPrefix = openApi.servers[0]?.url ?? '';

  return Object.entries(openApi.paths).flatMap(([path, methods]) =>
    Object.keys(methods).map((method) => ({
      method: method.toUpperCase(),
      path: joinRoutePath(apiPrefix, path),
    })),
  );
};

const extractJavaAdapterRoutes = (): JavaRoute[] => {
  const source = read('services/procurementApiClient.ts');
  const javaAdapterStart = source.indexOf('export const createJavaProcurementApiClient');
  const javaAdapterSource = javaAdapterStart >= 0 ? source.slice(javaAdapterStart) : source;
  const routePattern = /(platformRequest|buyerRequest|supplierRequest)<[^>]+>\((`|')([^`']+)/g;
  const routes: JavaRoute[] = [];
  let match: RegExpExecArray | null;

  while ((match = routePattern.exec(javaAdapterSource))) {
    const callEnd = javaAdapterSource.indexOf(');', routePattern.lastIndex);
    const callOptions = javaAdapterSource.slice(routePattern.lastIndex, callEnd >= 0 ? callEnd : routePattern.lastIndex + 320);
    routes.push({
      method: callOptions.match(/method:\s*'(GET|POST|PUT|PATCH|DELETE)'/)?.[1] ?? 'GET',
      path: match[3]
        .replace(/\$\{[^}]+\}/g, (placeholder) => `{${placeholder.slice(2, -1).split('.').pop()}}`)
        .replace(/\{demandId\}/g, '{demandId}')
        .replace(/\{relationId\}/g, '{relationId}')
        .replace(/\{rfqId\}/g, '{rfqId}')
        .replace(/\{awardId\}/g, '{awardId}')
        .replace(/\{orderId\}/g, '{orderId}')
        .replace(/\{invoiceId\}/g, '{invoiceId}'),
    });
  }

  return Array.from(new Map(routes.map((route) => [`${route.method} ${route.path}`, route])).values());
};

describe('Java OpenAPI contract coverage', () => {
  it('documents every Java adapter endpoint used by the frontend', () => {
    const operations = openApiOperations().map((operation) => `${operation.method} ${operation.path}`);
    const adapterRoutes = extractJavaAdapterRoutes().map((route) => `${route.method} ${route.path}`);

    expect(operations).toEqual(expect.arrayContaining(adapterRoutes));
  });

  it('keeps Java controller routes and OpenAPI operations in sync', () => {
    const javaRoutes = new Set(extractJavaControllerRoutes().map((route) => `${route.method} ${route.path}`));
    const operations = openApiOperations().map((operation) => `${operation.method} ${operation.path}`);
    const documentedRoutes = new Set(operations);

    expect([...javaRoutes]).toEqual(expect.arrayContaining(operations));
    expect([...documentedRoutes]).toEqual(expect.arrayContaining([...javaRoutes].filter((route) => route !== 'GET /api/v1/health')));
  });
});
