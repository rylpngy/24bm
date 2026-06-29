package com.procurement.identity.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.api.CreateBuyerUserRequest;
import com.procurement.identity.api.ImportBuyerUserRow;
import com.procurement.identity.api.ImportBuyerUsersRequest;
import com.procurement.identity.api.ImportBuyerUsersResponse;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

// 成员批量导入编排:逐行解析角色名→id 并调用 createUser(经代理,每行独立事务),
// 单行失败不影响其他行,返回成功/失败明细。
@Service
public class BuyerUserImportApplicationService {
  private final BuyerUserApplicationService buyerUserApplicationService;
  private final BuyerUserMapper buyerUserMapper;

  public BuyerUserImportApplicationService(
      BuyerUserApplicationService buyerUserApplicationService,
      BuyerUserMapper buyerUserMapper) {
    this.buyerUserApplicationService = buyerUserApplicationService;
    this.buyerUserMapper = buyerUserMapper;
  }

  public ImportBuyerUsersResponse importUsers(ImportBuyerUsersRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer user import APIs");
    int created = 0;
    List<ImportBuyerUsersResponse.Failure> failures = new ArrayList<>();
    List<ImportBuyerUserRow> rows = request.members();
    for (int i = 0; i < rows.size(); i++) {
      ImportBuyerUserRow row = rows.get(i);
      int rowNo = i + 1;
      try {
        if (row.name() == null || row.name().isBlank()) {
          throw new IllegalArgumentException("姓名不能为空");
        }
        String roleId = buyerUserMapper.findBuyerRoleIdByName(tenantId, blank(row.roleName()));
        if (roleId == null) {
          throw new IllegalArgumentException("角色不存在: " + row.roleName());
        }
        buyerUserApplicationService.createUser(new CreateBuyerUserRequest(
            row.name().trim(),
            blank(row.mobile()),
            blank(row.email()),
            "active",
            request.departmentId(),
            roleId,
            request.defaultPassword(),
            blank(row.employeeNo()),
            row.jobTitle() == null ? "" : row.jobTitle().trim()));
        created++;
      } catch (Exception exception) {
        failures.add(new ImportBuyerUsersResponse.Failure(
            rowNo, row.name(), rootMessage(exception)));
      }
    }
    return new ImportBuyerUsersResponse(created, failures.size(), failures);
  }

  private static String blank(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private static String rootMessage(Throwable t) {
    Throwable cur = t;
    while (cur.getCause() != null && cur.getCause() != cur) {
      cur = cur.getCause();
    }
    String msg = cur.getMessage();
    return msg == null ? cur.getClass().getSimpleName() : msg;
  }
}
