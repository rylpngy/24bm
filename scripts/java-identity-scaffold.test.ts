import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java identity and JWT scaffold', () => {
  it('defines authentication DTOs with SaaS identity scope fields', () => {
    const loginRequest = read('backend-java/src/main/java/com/procurement/identity/api/LoginRequest.java');
    const loginResponse = read('backend-java/src/main/java/com/procurement/identity/api/LoginResponse.java');

    expect(loginRequest).toContain('account');
    expect(loginRequest).toContain('password');
    expect(loginRequest).toContain('scope');
    expect(loginResponse).toContain('accessToken');
    expect(loginResponse).toContain('tenantId');
    expect(loginResponse).toContain('supplierId');
    expect(loginResponse).toContain('userId');
  });

  it('exposes a login endpoint under /api/v1/auth', () => {
    const controller = read('backend-java/src/main/java/com/procurement/identity/api/AuthController.java');

    expect(controller).toContain('@RequestMapping("/api/v1/auth")');
    expect(controller).toContain('@PostMapping("/login")');
    expect(controller).toContain('AuthenticationApplicationService');
  });

  it('defines a JWT service with tenant, supplier, user, and scope claims', () => {
    const jwtService = read('backend-java/src/main/java/com/procurement/identity/security/JwtTokenService.java');

    expect(jwtService).toContain('tenantId');
    expect(jwtService).toContain('supplierId');
    expect(jwtService).toContain('userId');
    expect(jwtService).toContain('scope');
  });

  it('wires JWT authentication into Spring Security while keeping login public', () => {
    const securityConfig = read('backend-java/src/main/java/com/procurement/identity/SecurityConfig.java');

    expect(securityConfig).toContain('/api/v1/auth/login');
    expect(securityConfig).toContain('permitAll');
    expect(securityConfig).toContain('JwtAuthenticationFilter');
    expect(securityConfig).toContain('addFilterBefore');
  });

  it('documents the frontend header transition from demo headers to Authorization bearer', () => {
    const doc = read('docs/java-backend-architecture.md');

    expect(doc).toContain('Authorization: Bearer');
    expect(doc).toContain('X-Tenant-Id');
    expect(doc).toContain('X-Supplier-Id');
  });
});
