package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.procurement.mall.api.SupplierMallProductMediaController;
import com.procurement.mall.application.MallProductMediaApplicationService;
import java.io.InputStream;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

class MallMediaHttpErrorTests {
  @Test void payloadLimitReturnsJsonDirectlyWithoutSecurityErrorRedispatch() throws Exception {
    var service=mock(MallProductMediaApplicationService.class);
    doThrow(new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"商品图片不能超过5MB"))
        .when(service).upload(eq("product"),eq("key"),eq("token"),any(InputStream.class),anyLong());
    var mvc=MockMvcBuilders.standaloneSetup(new SupplierMallProductMediaController(service)).build();
    var result=mvc.perform(post("/api/v1/supplier/mall/products/product/media/upload-sink")
        .param("storageKey","key").param("token","token").contentType(MediaType.APPLICATION_OCTET_STREAM).content(new byte[]{1}))
        .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("商品图片不能超过5MB")).andReturn();
    assertThat(result.getResponse().getErrorMessage()).isNull();
  }
}
