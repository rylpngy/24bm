package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.dictionary.application.DictionaryApplicationService;
import com.procurement.dictionary.domain.DictionaryEntry;
import com.procurement.dictionary.infrastructure.DictionaryMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class DictionaryListingTests {

  private final DictionaryMapper dictionaryMapper = org.mockito.Mockito.mock(DictionaryMapper.class);
  private final DictionaryApplicationService dictionaryApplicationService =
      new DictionaryApplicationService(dictionaryMapper);

  @Test
  void listActiveDictionaryEntriesByType() {
    when(dictionaryMapper.listActiveByType("payment_status")).thenReturn(List.of(
        new DictionaryEntry("payment_status", "pending", "待付款", 10, "active")));

    org.assertj.core.api.Assertions.assertThat(
            dictionaryApplicationService.listByType("payment_status"))
        .hasSize(1)
        .first()
        .satisfies(entry -> {
          org.assertj.core.api.Assertions.assertThat(entry.type()).isEqualTo("payment_status");
          org.assertj.core.api.Assertions.assertThat(entry.code()).isEqualTo("pending");
          org.assertj.core.api.Assertions.assertThat(entry.label()).isEqualTo("待付款");
        });

    verify(dictionaryMapper).listActiveByType("payment_status");
  }
}
