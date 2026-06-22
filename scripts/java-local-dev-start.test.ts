import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('Java local backend dev startup command', () => {
  it('provides a npm script that starts Spring Boot with local Flyway seed migrations', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['java:dev']).toBeDefined();
    expect(packageJson.scripts['java:dev']).toContain('backend-java');
    expect(packageJson.scripts['java:dev']).toContain('SPRING_FLYWAY_LOCATIONS');
    expect(packageJson.scripts['java:dev']).toContain('classpath:db/migration,classpath:db/dev');
    expect(packageJson.scripts['java:dev']).toContain('mvn spring-boot:run');
  });

  it('documents java:dev as the stable local backend startup path', () => {
    const doc = read('docs/local-java-integration.md');
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(doc).toContain('npm run java:dev');
    expect(doc).toContain("SPRING_FLYWAY_LOCATIONS='classpath:db/migration,classpath:db/dev'");
    expect(doc).toContain('V100');
    expect(doc).toContain('dev seed');
    expect(checklist).toContain('Java 本地启动脚本');
    expect(checklist).toContain('scripts/java-local-dev-start.test.ts');
  });
});
