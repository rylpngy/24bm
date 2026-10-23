package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import com.procurement.supplier.api.PerformanceEvidenceController;
import com.procurement.supplier.application.PerformanceEvidenceService;
import org.junit.jupiter.api.Test;

class PerformanceEvidenceControllerTests {
  @Test void oversizedStreamIsBoundedBeforeBusinessService() {
    var service = mock(PerformanceEvidenceService.class);
    var stream = new java.io.InputStream() {
      int consumed;
      @Override public int read() { consumed++; return 1; }
    };
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> new PerformanceEvidenceController(service).upload("task", 2, "huge.pdf", stream))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(stream.consumed).isEqualTo(10 * 1024 * 1024 + 1);
    verifyNoInteractions(service);
  }
  @Test void chineseFileNameUsesExtendedDispositionWithoutEncodedWordFallback() {
    var service = mock(PerformanceEvidenceService.class);
    when(service.downloadSupplier("task", "file")).thenReturn(new PerformanceEvidenceService.Download("第二轮证明.pdf", new byte[]{1}));
    var result = new PerformanceEvidenceController(service).supplierDownload("task", "file");
    assertThat(result.getHeaders().getFirst("Content-Disposition"))
        .startsWith("attachment; filename*=UTF-8''").doesNotContain("filename=", "=?");
    assertThat(result.getHeaders().getCacheControl()).isEqualTo("no-store");
    assertThat(result.getBody()).containsExactly((byte) 1);
  }
}
