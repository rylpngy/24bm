package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.attachment.domain.AttachmentStatus;
import org.junit.jupiter.api.Test;

class AttachmentStatusTests {

  @Test
  void definesActiveAttachmentStatus() {
    assertThat(AttachmentStatus.ACTIVE).isEqualTo("active");
  }
}
