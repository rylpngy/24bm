package com.procurement;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.supplier.api.ConfirmCooperationTierRequest;
import com.procurement.supplier.application.SupplierEvaluationApplicationService;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierEvaluationMapper;
import com.procurement.supplier.application.SupplierFulfillmentMetricsService;
import com.procurement.supplier.application.SupplierEvaluationTemplateService;
import java.math.BigDecimal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SupplierEvaluationIsolationTests {
  private final BuyerSupplierRelationMapper relations = mock(BuyerSupplierRelationMapper.class);
  private final SupplierEvaluationMapper evaluations = mock(SupplierEvaluationMapper.class);
  private final SupplierFulfillmentMetricsService metrics = mock(SupplierFulfillmentMetricsService.class);
  private final SupplierEvaluationTemplateService templates = mock(SupplierEvaluationTemplateService.class);
  private final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  private final SupplierEvaluationApplicationService service =
      new SupplierEvaluationApplicationService(evaluations, relations, metrics, audit, templates);

  @BeforeEach void context() { TenantContext.set("tenant-a", null, "reviewer-a"); }
  @AfterEach void clear() { TenantContext.clear(); }

  private void ownRelation() {
    when(relations.findByTenantAndId("tenant-a", "relation-a")).thenReturn(new BuyerSupplierRelation(
        "relation-a", "tenant-a", "supplier", "供应商", "已准入", "A", "[]", BigDecimal.ZERO,
        null, null, null, null, null, null, null, null, null, null));
  }

  @Test void foreignRelationCannotReadScoreHistoryOrChangeTier() {
    assertThrows(IllegalArgumentException.class, () -> service.listEvaluations("relation-b"));
    assertThrows(IllegalArgumentException.class, () -> service.autoScore("relation-b"));
    assertThrows(IllegalArgumentException.class, () -> service.confirmTier("relation-b", new ConfirmCooperationTierRequest("优选", BigDecimal.TEN)));
    verifyNoInteractions(evaluations, metrics, audit);
    verify(relations, never()).updateCooperationTier(any(), any(), any(), any());
  }

  @Test void invalidScoresCannotPersistOrProduceAudit() {
    ownRelation();
    for (int score : new int[] {-1, 101}) {
      assertThrows(IllegalArgumentException.class, () -> service.confirmTier("relation-a", new ConfirmCooperationTierRequest("优选", BigDecimal.valueOf(score))));
    }
    verify(relations, never()).updateCooperationTier(any(), any(), any(), any());
    verifyNoInteractions(audit);
  }

  @Test void validTierChangeRetainsTenantAndAuditDetail() {
    ownRelation();
    service.confirmTier("relation-a", new ConfirmCooperationTierRequest("优选", BigDecimal.valueOf(95)));
    verify(relations).updateCooperationTier("tenant-a", "relation-a", "优选", BigDecimal.valueOf(95));
    verify(audit).recordCurrentTenantAction("supplier_cooperation_tier.confirmed", "buyer_supplier_relation", "relation-a", "合作层级=优选，依据分数=95");
  }
}
