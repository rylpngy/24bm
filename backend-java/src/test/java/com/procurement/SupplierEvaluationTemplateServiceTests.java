package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.infrastructure.AuditLogMapper;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.api.SupplierEvaluationScoring;
import com.procurement.supplier.api.SupplierEvaluationTemplateRequests.Definition;
import com.procurement.supplier.application.SupplierEvaluationTemplateService;
import com.procurement.supplier.infrastructure.SupplierEvaluationTemplateMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.*;

class SupplierEvaluationTemplateServiceTests {
  final SupplierEvaluationTemplateMapper mapper = mock(SupplierEvaluationTemplateMapper.class);
  final PermissionService permissions = mock(PermissionService.class);
  final AuditLogMapper auditMapper = mock(AuditLogMapper.class);
  final SupplierEvaluationTemplateService service = new SupplierEvaluationTemplateService(
      mapper,permissions,new ObjectMapper(),new AuditLogApplicationService(auditMapper));
  @BeforeEach void context() { TenantContext.set("a",null,"u"); }
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void invalidDefinitionDoesNotReachPersistence() {
    assertThatThrownBy(() -> service.create(new Definition("Invalid",BigDecimal.ONE,BigDecimal.ONE,BigDecimal.ONE,BigDecimal.ONE)))
        .isInstanceOf(IllegalArgumentException.class);
    verify(permissions).require("buyer:supplier:manage");
    verifyNoInteractions(mapper,auditMapper);
  }

  @Test void missingGroupCannotAppendVersionsOrChangeEnabledState() {
    var definition = new Definition("T",BigDecimal.valueOf(100),BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO);
    assertThatThrownBy(() -> service.version("foreign",definition)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.enabled("foreign",false)).isInstanceOf(IllegalArgumentException.class);
    verify(mapper,times(2)).lock("a","foreign");
    verify(mapper,never()).insertVersion(any(),any(),any(),anyInt(),any());
    verify(mapper,never()).enabled(any(),any(),anyBoolean());
    verifyNoInteractions(auditMapper);
  }

  @Test void nullEnabledCannotBeInterpretedAsDisable() {
    assertThatThrownBy(() -> service.enabled("t",null)).isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(mapper);
  }

  @Test void snapshotsRoundTripAndMissingHistoricalSnapshotMeansLegacy() {
    var legacy = SupplierEvaluationScoring.legacy();
    assertThat(service.readSnapshot(null)).isEqualTo(legacy);
    assertThat(service.readSnapshot(service.snapshot(legacy))).isEqualTo(legacy);
    assertThatThrownBy(() -> service.readSnapshot("broken")).isInstanceOf(IllegalStateException.class);
  }

  @Test void listRequiresReadPermissionAndUsesCurrentTenantOnly() {
    service.list();
    verify(permissions).require("buyer:supplier:read");
    verify(mapper).list("a");
    verifyNoInteractions(auditMapper);
  }

  @Test void enableAndDisableAuditUsesTheActualCurrentActor() {
    when(mapper.lock("a","t")).thenReturn("t");
    service.enabled("t",false);
    verify(auditMapper).insert(anyString(),eq("a"),eq("u"),eq("supplier_evaluation_template.disabled"),
        eq("supplier_evaluation_template"),eq("t"),eq("enabled=false"));
    TenantContext.set("a",null,"second-manager");
    service.enabled("t",true);
    verify(auditMapper).insert(anyString(),eq("a"),eq("second-manager"),eq("supplier_evaluation_template.enabled"),
        eq("supplier_evaluation_template"),eq("t"),eq("enabled=true"));
  }
}
