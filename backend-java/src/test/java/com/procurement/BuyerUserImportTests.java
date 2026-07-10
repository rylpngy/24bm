package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.api.ImportBuyerUserRow;
import com.procurement.identity.api.ImportBuyerUsersRequest;
import com.procurement.identity.application.BuyerUserApplicationService;
import com.procurement.identity.application.BuyerUserImportApplicationService;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 成员批量导入:逐行尽力创建,角色名解析失败/姓名为空/createUser 异常的行计入失败明细,其余成功。
class BuyerUserImportTests {

  private final BuyerUserApplicationService createService = mock(BuyerUserApplicationService.class);
  private final BuyerUserMapper buyerUserMapper = mock(BuyerUserMapper.class);
  private final BuyerUserImportApplicationService importService =
      new BuyerUserImportApplicationService(createService, buyerUserMapper);

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  private ImportBuyerUserRow row(String name, String role) {
    return new ImportBuyerUserRow(name, "ZC100", "专员", "13700000000", "x@example.com", role);
  }

  @Test
  void importsValidRowsAndCollectsFailures() {
    TenantContext.set("tenant-1", null, "buyer-admin");
    when(buyerUserMapper.findBuyerRoleIdByName("tenant-1", "采购申请员")).thenReturn("role-req");
    when(buyerUserMapper.findBuyerRoleIdByName("tenant-1", "幽灵角色")).thenReturn(null);

    var resp = importService.importUsers(new ImportBuyerUsersRequest(
        "dept-it", "demo123456",
        List.of(
            row("张三", "采购申请员"),     // ok
            row("", "采购申请员"),         // 姓名为空 → 失败
            row("李四", "幽灵角色"))));     // 角色不存在 → 失败

    assertThat(resp.created()).isEqualTo(1);
    assertThat(resp.failed()).isEqualTo(2);
    assertThat(resp.failures()).extracting("row").containsExactly(2, 3);
    verify(createService).createUser(any());
  }

  @Test
  void createUserExceptionFailsOnlyThatRow() {
    TenantContext.set("tenant-1", null, "buyer-admin");
    when(buyerUserMapper.findBuyerRoleIdByName("tenant-1", "采购申请员")).thenReturn("role-req");
    doThrow(new IllegalStateException("已达成员名额上限")).when(createService).createUser(any());

    var resp = importService.importUsers(new ImportBuyerUsersRequest(
        "dept-it", "demo123456", List.of(row("张三", "采购申请员"))));

    assertThat(resp.created()).isZero();
    assertThat(resp.failed()).isEqualTo(1);
    assertThat(resp.failures().get(0).reason()).contains("名额上限");
  }
}
