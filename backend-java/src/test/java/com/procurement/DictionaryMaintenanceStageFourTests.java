package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.dictionary.api.SaveDictionaryEntryRequest;
import com.procurement.dictionary.application.DictionaryApplicationService;
import com.procurement.dictionary.domain.DictionaryEntry;
import com.procurement.dictionary.infrastructure.DictionaryMapper;
import org.junit.jupiter.api.Test;

class DictionaryMaintenanceStageFourTests {
  final DictionaryMapper mapper = mock(DictionaryMapper.class);
  final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  final DictionaryApplicationService service = new DictionaryApplicationService(mapper, audit, new ObjectMapper());

  @Test void omittedStatusDoesNotReactivateAnInactiveHistoricalEntry() {
    when(mapper.lock("announcement_audience", "buyer"))
        .thenReturn(new DictionaryEntry("announcement_audience", "buyer", "旧标签", 10, "inactive"));
    when(mapper.update(eq("announcement_audience"), eq("buyer"), eq("采购企业"), eq(10), anyString())).thenReturn(1);
    assertThat(service.update("announcement_audience", "buyer",
        new SaveDictionaryEntryRequest("announcement_audience", "buyer", "采购企业", null, null)).status())
        .isEqualTo("inactive");
    verify(audit).recordTenantAction(isNull(), eq("dictionary.updated"), eq("dictionary"), eq("announcement_audience/buyer"),
        argThat(detail -> detail.contains("旧标签") && detail.contains("采购企业") && detail.contains("before") && detail.contains("after")));
  }

  @Test void supportedBusinessItemsCanBeAddedWithAuditAndNoDelete() {
    service.create(new SaveDictionaryEntryRequest("business_category", "services", "服务", 20, null));
    verify(mapper).insert("business_category", "services", "服务", 20, "active");
    verify(audit).recordTenantAction(isNull(), eq("dictionary.created"), eq("dictionary"), eq("business_category/services"),
        contains("服务"));
  }

  @Test void historyReadRetainsDisabledLabelsWithoutMakingThemNewChoices() {
    when(mapper.listAllByType("announcement_audience")).thenReturn(java.util.List.of(
        new DictionaryEntry("announcement_audience", "buyer", "历史采购企业", 10, "inactive")));
    assertThat(service.listWithHistory("announcement_audience")).extracting(e -> e.label()).containsExactly("历史采购企业");
    assertThat(service.listByType("announcement_audience")).isEmpty();
  }

  @Test void mismatchedIdentityFailsBeforeReadingOrWriting() {
    assertThatThrownBy(() -> service.update("announcement_audience", "buyer",
        new SaveDictionaryEntryRequest("announcement_audience", "supplier", "名称", 10, "active")))
        .isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(mapper, audit);
  }
}
