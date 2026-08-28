import { execFileSync } from 'node:child_process';

export const baseUrl = process.env.JAVA_API_BASE_URL ?? 'http://localhost:8080';
const localSmokeDatabaseUrl = process.env.JAVA_SMOKE_DATABASE_URL
  ?? process.env.DB_URL
  ?? 'postgresql://procurement:procurement@localhost:5432/procurement_saas';

export const requestJson = async (path, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok || payload?.success === false) {
    const message = payload?.message || payload?.error?.message || response.statusText;
    throw new Error(`${init.method ?? 'GET'} ${path} failed: ${response.status} ${message}`);
  }

  return payload?.data;
};

export const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;

const resolveLocalSmokeSqlCommand = () => {
  try {
    execFileSync('psql', ['--version'], { stdio: 'ignore' });
    return {
      command: 'psql',
      args: [localSmokeDatabaseUrl, '-v', 'ON_ERROR_STOP=1', '-q', '-c'],
    };
  } catch {
    const databaseUrl = new URL(localSmokeDatabaseUrl);
    const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
    const databaseUser = decodeURIComponent(databaseUrl.username) || 'procurement';
    if (!databaseName) {
      throw new Error(`JAVA_SMOKE_DATABASE_URL must include a database name: ${localSmokeDatabaseUrl}`);
    }
    return {
      command: 'docker',
      args: [
        'exec',
        '-i',
        process.env.JAVA_SMOKE_POSTGRES_CONTAINER ?? 'procurement-saas-postgres',
        'psql',
        '-U',
        databaseUser,
        '-d',
        databaseName,
        '-v',
        'ON_ERROR_STOP=1',
        '-q',
        '-c',
      ],
    };
  }
};

export const runLocalSmokeSql = (sql) => {
  const sqlCommand = resolveLocalSmokeSqlCommand();
  execFileSync(sqlCommand.command, [...sqlCommand.args, sql], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
};
