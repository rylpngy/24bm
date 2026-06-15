import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java backend scaffold', () => {
  it('keeps the Node backend explicitly marked as a prototype', () => {
    const doc = read('docs/backend-skeleton.md');

    expect(doc).toContain('Node 后端原型');
    expect(doc).toContain('正式后端以 backend-java 为准');
  });

  it('provides a Spring Boot backend module boundary', () => {
    expect(existsSync(join(root, 'backend-java/pom.xml'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/ProcurementApplication.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/resources/application.yml'))).toBe(true);
  });

  it('defines core package boundaries for the procurement SaaS backend', () => {
    const expectedPackages = [
      'platform',
      'tenant',
      'identity',
      'supplier',
      'catalog',
      'demand',
      'approval',
      'sourcing',
      'order',
      'finance',
      'notification',
      'attachment',
      'audit',
      'common',
    ];

    for (const packageName of expectedPackages) {
      expect(existsSync(join(root, `backend-java/src/main/java/com/procurement/${packageName}`))).toBe(true);
    }
  });

  it('permits the public health endpoint through Spring Security', () => {
    const securityConfig = read('backend-java/src/main/java/com/procurement/identity/SecurityConfig.java');

    expect(securityConfig).toContain('/api/v1/health');
    expect(securityConfig).toContain('permitAll');
  });

  it('moves the initial PostgreSQL schema into Flyway migrations', () => {
    const migration = read('backend-java/src/main/resources/db/migration/V1__initial_schema.sql');

    expect(migration).toContain('create table tenants');
    expect(migration).toContain('create table purchase_demands');
    expect(migration).toContain('create table rfqs');
    expect(migration).toContain('create table purchase_orders');
  });

  it('documents and pins the local Maven verification entrypoint', () => {
    const mavenConfig = read('backend-java/.mvn/maven.config');
    const settings = read('backend-java/.mvn/settings.xml');
    const readme = read('backend-java/README.md');

    expect(mavenConfig).toContain('--settings');
    expect(mavenConfig).toContain('.mvn/settings.xml');
    expect(settings).toContain('https://maven.aliyun.com/repository/public');
    expect(readme).toContain('JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home');
    expect(readme).toContain('mvn test');
  });

  it('provides an explicit PostgreSQL integration test entrypoint', () => {
    const pom = read('backend-java/pom.xml');
    const readme = read('backend-java/README.md');

    expect(pom).toContain('<artifactId>junit-jupiter</artifactId>');
    expect(pom).toContain('<id>integration</id>');
    expect(pom).toContain('<artifactId>maven-failsafe-plugin</artifactId>');
    expect(existsSync(join(root, 'backend-java/src/test/java/com/procurement/DatabaseMigrationIT.java'))).toBe(true);
    expect(readme).toContain('mvn verify -Pintegration');
  });

  it('documents the local Java backend and Vite integration workflow', () => {
    const docPath = 'docs/local-java-integration.md';
    expect(existsSync(join(root, docPath))).toBe(true);

    const doc = read(docPath);
    expect(doc).toContain('mvn spring-boot:run');
    expect(doc).toContain('npm run dev:java');
    expect(doc).toContain('POST /api/v1/auth/login');
    expect(doc).toContain('Authorization: Bearer');
    expect(doc).toContain('createJavaProcurementApiClient');
    expect(doc).toContain('npm run dev:mock');
    expect(doc).toContain('mvn verify -Pintegration');
    expect(doc).toContain('Docker daemon');
  });

  it('keeps the frontend integration strategy aligned with Java as the primary backend path', () => {
    const doc = read('docs/api-and-data-design.md');

    expect(doc).toContain('Java 后端联调是主线');
    expect(doc).toContain('npm run dev:java');
    expect(doc).toContain('npm run dev:mock');
    expect(doc).not.toContain('开发早期默认使用 mock adapter');
  });

  it('documents the buyer attachment metadata API handoff', () => {
    const architecture = read('docs/java-backend-architecture.md');
    const readme = read('backend-java/README.md');

    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/attachment/api/AttachmentController.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/attachment/application/AttachmentApplicationService.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/attachment/infrastructure/AttachmentMapper.java'))).toBe(true);
    expect(architecture).toContain('附件元数据 Java API');
    expect(architecture).toContain('GET /api/v1/buyer/attachments');
    expect(architecture).toContain('attachment.created');
    expect(readme).toContain('Buyer Attachment Metadata APIs');
    expect(readme).toContain('POST /api/v1/buyer/attachments');
  });

  it('documents the buyer notification API handoff', () => {
    const architecture = read('docs/java-backend-architecture.md');
    const readme = read('backend-java/README.md');

    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/notification/api/BuyerNotificationController.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/notification/application/NotificationApplicationService.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/notification/infrastructure/NotificationMapper.java'))).toBe(true);
    expect(architecture).toContain('站内通知 Java API');
    expect(architecture).toContain('GET /api/v1/buyer/notifications');
    expect(architecture).toContain('POST /api/v1/buyer/notifications/{notificationId}/read');
    expect(architecture).toContain('采购需求提交审批时会为当前租户启用采购方用户生成站内通知');
    expect(architecture).toContain('RFQ 定标结果提交审批时会为当前租户启用采购方用户生成站内通知');
    expect(architecture).toContain('供应商确认采购订单时会为当前租户启用采购方用户生成站内通知');
    expect(readme).toContain('Buyer Notification APIs');
    expect(readme).toContain('Purchase demand submission now creates in-app notifications');
    expect(readme).toContain('RFQ award approval submission also creates in-app notifications');
    expect(readme).toContain('Supplier order confirmation creates in-app notifications');
    expect(existsSync(join(root, 'backend-java/src/test/java/com/procurement/PurchaseDemandNotificationTests.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/test/java/com/procurement/RfqAwardNotificationTests.java'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/test/java/com/procurement/PurchaseOrderNotificationTests.java'))).toBe(true);
  });

  it('provides a reproducible local PostgreSQL runtime for Java frontend integration', () => {
    const compose = read('backend-java/docker-compose.yml');
    const localProfile = read('backend-java/src/main/resources/application-local.yml');
    const localSeed = read('backend-java/src/main/resources/db/dev/V100__local_demo_seed.sql');
    const readme = read('backend-java/README.md');
    const integrationDoc = read('docs/local-java-integration.md');

    expect(compose).toContain('postgres:16');
    expect(compose).toContain('procurement_saas');
    expect(compose).toContain('5432:5432');
    expect(compose).toContain('procurement-postgres-data');

    expect(localProfile).toContain('jdbc:postgresql://localhost:5432/procurement_saas');
    expect(localProfile).toContain('classpath:db/migration,classpath:db/dev');

    expect(localSeed).toContain('tenant-acme');
    expect(localSeed).toContain('supplier-tech');
    expect(localSeed).toContain('mat-laptop');
    expect(localSeed).toContain('user-buyer-owner');

    expect(readme).toContain('docker compose up -d');
    expect(readme).toContain('mvn spring-boot:run -Dspring-boot.run.profiles=local');
    expect(integrationDoc).toContain('docker compose up -d');
    expect(integrationDoc).toContain('mvn spring-boot:run -Dspring-boot.run.profiles=local');
  });
});
