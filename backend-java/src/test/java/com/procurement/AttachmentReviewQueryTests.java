package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.procurement.attachment.application.AttachmentReviewQuery;
import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.common.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class AttachmentReviewQueryTests {
  final AttachmentMapper mapper = mock(AttachmentMapper.class);
  final AttachmentReviewQuery query = new AttachmentReviewQuery(mapper);
  @AfterEach void clear() { TenantContext.clear(); }
  @Test void preservesFingerprintSerializationIncludingLegacyNull() {
    TenantContext.set("tenant", null, "reviewer");
    var fingerprint = new AttachmentMapper.Fingerprint(42L, "hash");
    when(mapper.fingerprint("tenant", "a")).thenReturn(fingerprint);
    assertThat(query.fingerprint("tenant", "a")).isEqualTo(fingerprint.toString());
    assertThat(query.fingerprint("tenant", "legacy")).isEqualTo("null");
  }
  @Test void rejectsForeignTenantBeforeQueryingStorage() {
    TenantContext.set("tenant", null, "reviewer");
    assertThatThrownBy(() -> query.fingerprint("other", "a")).hasMessageContaining("当前租户");
    assertThatThrownBy(() -> query.listActiveByTenantAndOwner("other", "tender", "t")).hasMessageContaining("当前租户");
    verifyNoInteractions(mapper);
  }
}
