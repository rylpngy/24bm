package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.attachment.domain.AttachmentVisibility;
import org.junit.jupiter.api.Test;

class AttachmentVisibilityTests {
  @Test
  void normalizesBlankVisibilityToTenantDefault() {
    assertThat(AttachmentVisibility.normalize(null)).isEqualTo(AttachmentVisibility.TENANT);
    assertThat(AttachmentVisibility.normalize("")).isEqualTo(AttachmentVisibility.TENANT);
    assertThat(AttachmentVisibility.normalize("  ")).isEqualTo(AttachmentVisibility.TENANT);
  }

  @Test
  void acceptsSupportedVisibilityValues() {
    assertThat(AttachmentVisibility.normalize(AttachmentVisibility.TENANT))
        .isEqualTo(AttachmentVisibility.TENANT);
    assertThat(AttachmentVisibility.normalize(AttachmentVisibility.BUYER_INTERNAL))
        .isEqualTo(AttachmentVisibility.BUYER_INTERNAL);
    assertThat(AttachmentVisibility.normalize(AttachmentVisibility.SUPPLIER_SHARED))
        .isEqualTo(AttachmentVisibility.SUPPLIER_SHARED);
  }

  @Test
  void rejectsUnsupportedVisibility() {
    assertThatThrownBy(() -> AttachmentVisibility.normalize("public"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported attachment visibility");
  }
}
