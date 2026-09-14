package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.catalog.application.MaterialApplicationService;
import com.procurement.catalog.domain.Material;
import com.procurement.catalog.infrastructure.MaterialMapper;
import com.procurement.common.api.ImportResultResponse;
import com.procurement.common.excel.ExcelSheets;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.organization.application.DepartmentApplicationService;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.supplier.application.SupplierInvitationApplicationService;
import com.procurement.supplier.domain.SupplierInvitation;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierInvitationMapper;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

// Excel 基础数据导入:部分成功语义——合法行入库,非法行(必填缺失/重复/坏数字)逐条报告。
class BaseDataExcelImportTests {

  private final MaterialMapper materialMapper = mock(MaterialMapper.class);
  private final ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
  private final MaterialApplicationService materialService =
      new MaterialApplicationService(materialMapper, eventPublisher);

  private final DepartmentMapper departmentMapper = mock(DepartmentMapper.class);
  private final PurchaseDemandMapper purchaseDemandMapper = mock(PurchaseDemandMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      mock(AuditLogApplicationService.class);
  private final BuyerUserMapper buyerUserMapper = mock(BuyerUserMapper.class);
  private final PermissionService permissionService = mock(PermissionService.class);
  private final DepartmentApplicationService departmentService = new DepartmentApplicationService(
      departmentMapper, purchaseDemandMapper, auditLogApplicationService, buyerUserMapper, permissionService);

  private final SupplierInvitationMapper invitationMapper = mock(SupplierInvitationMapper.class);
  private final BuyerSupplierRelationMapper relationMapper = mock(BuyerSupplierRelationMapper.class);
  private final SupplierInvitationApplicationService invitationService =
      new SupplierInvitationApplicationService(invitationMapper, relationMapper, new ObjectMapper());

  @BeforeEach
  void setTenant() {
    TenantContext.set("tenant-1", null, "buyer-user");
  }

  @AfterEach
  void clearTenant() {
    TenantContext.clear();
  }

  private static byte[] sheet(List<List<String>> rows) {
    return ExcelSheets.template("导入", rows.get(0), rows.subList(1, rows.size()));
  }

  @Test
  void materialImportInsertsValidRowsAndReportsInvalidOnes() {
    when(materialMapper.listByTenant("tenant-1", null, null)).thenReturn(List.of(
        new Material("mat-0", "tenant-1", "MAT-EXIST", "既有物料", "办公用品", "个",
            BigDecimal.ONE, "", "", false, BigDecimal.TEN, "")));

    ImportResultResponse result = materialService.importMaterials(sheet(List.of(
        List.of("物料编码*", "物料名称*", "分类*", "计量单位*", "参考价", "规格型号", "品牌", "省政府网上商城目录(是/否)", "税率(%)", "描述"),
        List.of("MAT-001", "A4复印纸", "办公用品", "箱", "180", "70g", "得力", "是", "13", ""),
        List.of("MAT-EXIST", "重复编码", "办公用品", "个", "1", "", "", "否", "", ""),
        List.of("", "缺编码", "办公用品", "个", "", "", "", "否", "", ""),
        List.of("MAT-002", "坏价格", "办公用品", "个", "abc", "", "", "否", "", ""),
        List.of("MAT-001", "文件内重复", "办公用品", "个", "2", "", "", "否", "", ""))));

    assertThat(result.totalRows()).isEqualTo(5);
    assertThat(result.successCount()).isEqualTo(1);
    assertThat(result.failures()).hasSize(4);
    assertThat(result.failures().get(0).message()).contains("已存在");
    assertThat(result.failures().get(1).message()).contains("必填");
    assertThat(result.failures().get(2).message()).contains("参考价");
    assertThat(result.failures().get(3).message()).contains("MAT-001");
    verify(materialMapper, times(1)).insert(
        anyString(), eq("tenant-1"), eq("MAT-001"), eq("A4复印纸"), eq("办公用品"), eq("箱"),
        any(), anyString(), anyString(), eq(true), any(), anyString());
  }

  @Test
  void materialImportRejectsFileWithoutDataRows() {
    assertThatThrownBy(() -> materialService.importMaterials(sheet(List.of(
        List.of("物料编码*", "物料名称*", "分类*", "计量单位*")))))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("没有数据行");
  }

  @Test
  void departmentImportResolvesParentByNameIncludingRowsCreatedInFile() {
    when(departmentMapper.listActiveByTenant("tenant-1")).thenReturn(List.of());

    ImportResultResponse result = departmentService.importDepartments(sheet(List.of(
        List.of("部门名称*", "上级部门名称"),
        List.of("采购中心", ""),
        List.of("寻源组", "采购中心"),
        List.of("孤儿组", "不存在的部门"),
        List.of("采购中心", ""))));

    assertThat(result.successCount()).isEqualTo(2);
    assertThat(result.failures()).hasSize(2);
    assertThat(result.failures().get(0).message()).contains("上级部门不存在");
    assertThat(result.failures().get(1).message()).contains("已存在");
    // 寻源组的 parentId 来自文件内先建的「采购中心」行(非 null)。
    verify(departmentMapper).insert(anyString(), eq("tenant-1"), eq("寻源组"), anyString(), anyString());
  }

  @Test
  void invitationImportSkipsPendingDuplicatesByName() {
    when(invitationMapper.listByTenant("tenant-1")).thenReturn(List.of(
        new SupplierInvitation("inv-0", "tenant-1", null, "既有待回复公司", null, null, null,
            "待回复", null, null, null)));

    ImportResultResponse result = invitationService.importInvitations(sheet(List.of(
        List.of("供应商名称*", "联系方式", "主营品类", "备注"),
        List.of("新供应商甲", "李经理", "机电", ""),
        List.of("既有待回复公司", "", "", ""),
        List.of("", "只有联系方式", "", ""))));

    assertThat(result.successCount()).isEqualTo(1);
    assertThat(result.failures()).hasSize(2);
    verify(invitationMapper, times(1)).insert(
        anyString(), eq("tenant-1"), eq(null), eq("新供应商甲"),
        eq("李经理"), eq("机电"), eq(null), eq("待回复"));
    verify(invitationMapper, never()).insert(
        anyString(), anyString(), any(), eq("既有待回复公司"), any(), any(), any(), anyString());
  }

  @Test
  void templatesRoundTripThroughReader() {
    List<List<String>> rows = ExcelSheets.readFirstSheet(materialService.importTemplate(), 501);
    assertThat(rows.get(0).get(0)).isEqualTo("物料编码*");
    assertThat(ExcelSheets.readFirstSheet(departmentService.importTemplate(), 201).get(0))
        .containsExactly("部门名称*", "上级部门名称");
    assertThat(ExcelSheets.readFirstSheet(invitationService.importTemplate(), 501).get(1).get(0))
        .isNotBlank();
  }
}
