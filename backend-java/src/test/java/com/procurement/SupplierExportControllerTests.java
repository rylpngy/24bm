package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.procurement.supplier.api.SupplierExportController;
import com.procurement.supplier.application.SupplierExportService;
import org.junit.jupiter.api.Test;

class SupplierExportControllerTests {
  @Test void returnsXlsxWithChineseExtendedFilenameAndNoStore() {
    var service = mock(SupplierExportService.class);
    var export = new SupplierExportService.Export("供应商档案.xlsx", new byte[]{1, 2});
    when(service.export("profiles", null)).thenReturn(export);
    var response = new SupplierExportController(service).export("profiles", null);
    assertThat(response.getHeaders().getContentType().toString())
        .isEqualTo("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assertThat(response.getHeaders().getFirst("Content-Disposition"))
        .startsWith("attachment; filename*=UTF-8''%E4%BE%9B").endsWith(".xlsx")
        .doesNotContain("=?", "filename=");
    assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
    assertThat(response.getBody()).containsExactly((byte) 1, (byte) 2);
  }
}
