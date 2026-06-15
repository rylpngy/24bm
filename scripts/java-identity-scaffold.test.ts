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

  it('enforces buyer tenant user limits from SaaS plan entitlements', () => {
    const service = read('backend-java/src/main/java/com/procurement/identity/application/BuyerUserApplicationService.java');
    const roleService = read('backend-java/src/main/java/com/procurement/identity/application/BuyerRoleApplicationService.java');
    const userMapper = read('backend-java/src/main/java/com/procurement/identity/infrastructure/BuyerUserMapper.java');
    const roleMapper = read('backend-java/src/main/java/com/procurement/identity/infrastructure/BuyerRoleMapper.java');
    const roleController = read('backend-java/src/main/java/com/procurement/identity/api/BuyerRoleController.java');
    const userController = read('backend-java/src/main/java/com/procurement/identity/api/BuyerUserController.java');
    const changeRoleRequest = read('backend-java/src/main/java/com/procurement/identity/api/ChangeBuyerUserRoleRequest.java');
    const changeStatusRequest = read('backend-java/src/main/java/com/procurement/identity/api/ChangeBuyerUserStatusRequest.java');
    const resetPasswordRequest = read('backend-java/src/main/java/com/procurement/identity/api/ResetBuyerUserPasswordRequest.java');
    const request = read('backend-java/src/main/java/com/procurement/identity/api/CreateBuyerUserRequest.java');
    const response = read('backend-java/src/main/java/com/procurement/identity/api/BuyerUserResponse.java');
    const entitlementService = read('backend-java/src/main/java/com/procurement/tenant/application/TenantEntitlementApplicationService.java');
    const entitlementMapper = read('backend-java/src/main/java/com/procurement/tenant/infrastructure/TenantEntitlementMapper.java');
    const migration = read('backend-java/src/main/resources/db/migration/V1__initial_schema.sql');
    const apiContract = read('data/apiContract.ts');
    const readme = read('backend-java/README.md');
    const architecture = read('docs/java-backend-architecture.md');

    expect(service).toContain('TenantEntitlementApplicationService');
    expect(service).toContain('requireUserCapacity');
    expect(service).toContain('DepartmentMapper');
    expect(service).toContain('existsActiveByTenantAndId');
    expect(service).toContain('requireBuyerRole');
    expect(service).toContain('assignRole');
    expect(service).toContain('changeUserRole');
    expect(service).toContain('buyer_user.role_changed');
    expect(service).toContain('resetUserPassword');
    expect(service).toContain('buyer_user.password_reset');
    expect(service).toContain('changeUserStatus');
    expect(service).toContain('buyer_user.status_changed');
    expect(service).toContain('Unsupported buyer user status');
    expect(roleService).toContain('listCurrentTenantRoles');
    expect(roleService).toContain('buyer role APIs');
    expect(roleMapper).toContain("scope = 'buyer'");
    expect(roleMapper).toContain('listBuyerRolesByTenant');
    expect(roleController).toContain('/api/v1/buyer/roles');
    expect(userController).toContain('/{userId}/role');
    expect(userController).toContain('/{userId}/password');
    expect(userController).toContain('/{userId}/status');
    expect(request).toContain('departmentId');
    expect(request).toContain('roleId');
    expect(changeRoleRequest).toContain('roleId');
    expect(resetPasswordRequest).toContain('newPassword');
    expect(changeStatusRequest).toContain('status');
    expect(response).toContain('departmentId');
    expect(response).toContain('roleId');
    expect(userMapper).toContain('department_id');
    expect(userMapper).toContain('existsBuyerRoleByTenantAndId');
    expect(userMapper).toContain('insert into user_roles');
    expect(userMapper).toContain('replaceRole');
    expect(userMapper).toContain('updatePasswordHash');
    expect(userMapper).toContain('existsByTenantAndId');
    expect(userMapper).toContain('updateStatus');
    expect(userMapper).toContain('countByTenant');
    expect(entitlementService).toContain('Tenant user limit reached');
    expect(entitlementMapper).toContain('user_limit');
    expect(migration).toContain('department_id text');
    expect(apiContract).toContain('department_id');
    expect(apiContract).toContain('/buyer/roles');
    expect(apiContract).toContain('/buyer/users/{userId}/role');
    expect(apiContract).toContain('/buyer/users/{userId}/password');
    expect(apiContract).toContain('/buyer/users/{userId}/status');
    expect(readme).toContain("current tenant's `user_limit`");
    expect(readme).toContain('GET /api/v1/buyer/roles');
    expect(readme).toContain('POST /api/v1/buyer/users/{userId}/role');
    expect(readme).toContain('POST /api/v1/buyer/users/{userId}/password');
    expect(readme).toContain('POST /api/v1/buyer/users/{userId}/status');
    expect(readme).toContain('departmentId');
    expect(readme).toContain('roleId');
    expect(architecture).toContain('当前用户数达到或超过 `user_limit` 时拒绝创建');
    expect(architecture).toContain('GET /api/v1/buyer/roles');
    expect(architecture).toContain('POST /api/v1/buyer/users/{userId}/role');
    expect(architecture).toContain('POST /api/v1/buyer/users/{userId}/password');
    expect(architecture).toContain('POST /api/v1/buyer/users/{userId}/status');
    expect(architecture).toContain('用户所属 `departmentId`');
    expect(architecture).toContain('用户角色 `roleId`');
  });

  it('documents the frontend header transition from demo headers to Authorization bearer', () => {
    const doc = read('docs/java-backend-architecture.md');

    expect(doc).toContain('Authorization: Bearer');
    expect(doc).toContain('X-Tenant-Id');
    expect(doc).toContain('X-Supplier-Id');
  });
});
