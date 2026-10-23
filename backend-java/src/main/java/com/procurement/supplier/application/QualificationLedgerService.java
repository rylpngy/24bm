package com.procurement.supplier.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.api.QualificationLedgerPage;
import com.procurement.supplier.infrastructure.QualificationLedgerMapper;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QualificationLedgerService {
  private final QualificationLedgerMapper mapper;
  private final PermissionService permissions;
  public QualificationLedgerService(QualificationLedgerMapper mapper, PermissionService permissions) {
    this.mapper = mapper;
    this.permissions = permissions;
  }
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public QualificationLedgerPage list(String keyword, String state, int page, int pageSize) {
    permissions.require("buyer:supplier:read");
    String tenant = TenantAccessGuard.requireTenantId("qualification ledger");
    if (!Set.of("all", "expired", "expiring", "unknown", "valid").contains(state)
        || page < 1 || pageSize < 1 || pageSize > 100 || (keyword != null && keyword.length() > 200)) {
      throw new IllegalArgumentException("资质筛选或分页参数无效");
    }
    String search = keyword == null || keyword.isBlank() ? null : keyword.trim();
    LocalDate today = LocalDate.now(ZoneId.of("Asia/Shanghai"));
    long total = mapper.count(tenant, search, state, today, today.plusDays(30));
    int current = (int) Math.min(page, Math.max(1, (total + pageSize - 1) / pageSize));
    return new QualificationLedgerPage(mapper.list(tenant, search, state, today, today.plusDays(30),
        pageSize, (long) (current - 1) * pageSize), total, current, pageSize);
  }
}
