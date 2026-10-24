package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.storage.ObjectStorageService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.PermissionService;
import com.procurement.mall.application.MallProductMediaApplicationService;
import com.procurement.mall.infrastructure.MallProductMediaMapper;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MallProductMediaTests {
  private final MallProductMediaMapper mapper = mock(MallProductMediaMapper.class);
  private final ObjectStorageService storage = mock(ObjectStorageService.class);
  private final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  private final PermissionService permissions = mock(PermissionService.class);
  private final MallProductMediaApplicationService service = new MallProductMediaApplicationService(mapper,storage,audit,permissions);
  private final MallProductMediaMapper.Product product = new MallProductMediaMapper.Product("p","s","t","tenant","在架",null);

  @BeforeEach void setup() {
    TenantContext.set(null,"s","u");
    when(mapper.own("s","p")).thenReturn(product);
    when(mapper.lockOwn("s","p")).thenReturn(product);
    when(mapper.list("p")).thenReturn(List.of());
  }
  @AfterEach void clear() { TenantContext.clear(); }
  private static String hash(byte[] bytes) throws Exception { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }

  @Test void foreignProductCannotIssueTicketOrReadObject() {
    assertThatThrownBy(() -> service.ticket("foreign","photo.png")).hasMessageContaining("不属于");
    assertThatThrownBy(() -> service.image("foreign","m",false)).hasMessageContaining("不属于");
    verifyNoInteractions(storage);
  }

  @Test void reusedExpiredOrIncorrectTicketCannotWriteObject() throws Exception {
    when(mapper.upload("key","p","s","u")).thenReturn(new MallProductMediaMapper.Upload("key","p","s","u","photo.png","issued",null,null,null));
    when(mapper.claim(eq("key"),eq("p"),eq("s"),eq("u"),anyString())).thenReturn(0);
    assertThatThrownBy(() -> service.upload("p","key","wrong",MallProductImagePolicyTests.png(1,1))).hasMessageContaining("票据");
    verifyNoInteractions(storage);
  }

  @Test void validUploadClaimsBeforeStorageAndRecordsActualSanitizedFingerprint() throws Exception {
    byte[] bytes = MallProductImagePolicyTests.png(1,1);
    when(mapper.upload("key","p","s","u")).thenReturn(new MallProductMediaMapper.Upload("key","p","s","u","photo.png","issued",null,null,null));
    when(mapper.claim(eq("key"),eq("p"),eq("s"),eq("u"),anyString())).thenReturn(1);
    when(mapper.uploaded(eq("key"),eq("p"),eq("s"),eq("u"),eq("image/png"),eq((long)bytes.length),eq(hash(bytes)))).thenReturn(1);
    service.upload("p","key","token",new java.io.ByteArrayInputStream(bytes),-1);
    var sequence = inOrder(mapper,storage);
    sequence.verify(mapper).claim(eq("key"),eq("p"),eq("s"),eq("u"),anyString());
    sequence.verify(storage).put(eq("key"),eq(bytes),eq("image/png"));
    sequence.verify(mapper).uploaded("key","p","s","u","image/png",bytes.length,hash(bytes));
  }

  @Test void registrationConsumesTicketUnderProductLockAndRevokesPublication() throws Exception {
    byte[] bytes = MallProductImagePolicyTests.png(1,1);
    when(mapper.upload("key","p","s","u")).thenReturn(new MallProductMediaMapper.Upload("key","p","s","u","photo.png","uploaded","image/png",(long)bytes.length,hash(bytes)));
    when(storage.get("key")).thenReturn(new ObjectStorageService.StoredObject(bytes,"image/png"));
    when(mapper.consume("key","p","s","u")).thenReturn(1);
    service.register("p","key");
    var sequence = inOrder(mapper);
    sequence.verify(mapper).lockOwn("s","p");
    sequence.verify(mapper).consume("key","p","s","u");
    sequence.verify(mapper).insert(anyString(),eq("p"),eq("key"));
    sequence.verify(mapper).invalidate("s","p");
    verify(audit).recordTenantAction("t","mall_product.media_uploaded","mall_product","p");
  }

  @Test void bytesAreNeverReadWithoutCurrentProductVisibilityAndRegisteredOwnership() {
    TenantContext.set("other",null,"buyer");
    assertThatThrownBy(() -> service.image("p","m",true)).hasMessageContaining("可见范围");
    verifyNoInteractions(storage);
    when(mapper.visible("other","p")).thenReturn(product);
    assertThatThrownBy(() -> service.image("p","foreign-media",true)).hasMessageContaining("未通过上传登记");
    verifyNoInteractions(storage);
  }

  @Test void tamperedObjectIsBlockedEvenIfMetadataStillExists() throws Exception {
    byte[] bytes = MallProductImagePolicyTests.png(1,1);
    when(mapper.media("p","m")).thenReturn(new MallProductMediaMapper.Media("m","key","photo.png","image/png",bytes.length,hash(bytes),0,true));
    when(storage.get("key")).thenReturn(new ObjectStorageService.StoredObject(new byte[bytes.length],"image/png"));
    assertThatThrownBy(() -> service.image("p","m",false)).hasMessageContaining("完整性");
  }

  @Test void platformPreviewRejectsTenantAndSupplierContextsAndRequiresExplicitPlatformPermission() {
    assertThatThrownBy(() -> service.listPublicReview("p")).hasMessageContaining("Platform context");
    TenantContext.set(null,null,"admin");
    when(mapper.publicPending("p")).thenReturn(new MallProductMediaMapper.Product("p","s",null,"public","待审核",null));
    service.listPublicReview("p"); verify(permissions).require("platform:*");
  }

  @Test void invalidTicketDoesNotReadRequestStream() {
    var stream = mock(java.io.InputStream.class);
    assertThatThrownBy(() -> service.upload("p","unknown","token",stream,-1)).hasMessageContaining("票据");
    verifyNoInteractions(stream,storage);
  }

  @Test void declaredOversizeReturns413BeforeReadingAnyBytes() {
    when(mapper.upload("key","p","s","u")).thenReturn(new MallProductMediaMapper.Upload("key","p","s","u","photo.png","issued",null,null,null));
    when(mapper.claim(eq("key"),eq("p"),eq("s"),eq("u"),anyString())).thenReturn(1);
    var stream = mock(java.io.InputStream.class);
    assertThatThrownBy(() -> service.upload("p","key","token",stream,6L*1024*1024))
        .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
        .satisfies(error -> assertThat(((org.springframework.web.server.ResponseStatusException)error).getStatusCode().value()).isEqualTo(413));
    verifyNoInteractions(stream,storage);
    verify(mapper).failed("key","p","s","u");
  }

  @Test void chunkedStreamIsLimitedToMaxPlusOneAndReturns413WithoutStorageWrite() {
    when(mapper.upload("key","p","s","u")).thenReturn(new MallProductMediaMapper.Upload("key","p","s","u","photo.png","issued",null,null,null));
    when(mapper.claim(eq("key"),eq("p"),eq("s"),eq("u"),anyString())).thenReturn(1);
    var read = new java.util.concurrent.atomic.AtomicInteger();
    var stream = new java.io.InputStream() {
      @Override public int read() { read.incrementAndGet(); return 0; }
      @Override public int read(byte[] bytes,int offset,int length) {
        java.util.Arrays.fill(bytes,offset,offset+length,(byte)0); read.addAndGet(length); return length;
      }
    };
    assertThatThrownBy(() -> service.upload("p","key","token",stream,-1))
        .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
        .satisfies(error -> assertThat(((org.springframework.web.server.ResponseStatusException)error).getStatusCode().value()).isEqualTo(413));
    assertThat(read.get()).isEqualTo(com.procurement.mall.domain.MallProductImagePolicy.MAX_BYTES+1);
    verifyNoInteractions(storage); verify(mapper).failed("key","p","s","u");
  }

  @Test void ownPendingImagesRequireManageAndCannotCrossTenantOrPublicScope() {
    TenantContext.set("t",null,"reviewer");
    var pending = new MallProductMediaMapper.Product("p","s","t","tenant","待审核",null);
    when(mapper.pendingForTenant("t","p")).thenReturn(pending);
    assertThatThrownBy(() -> service.listBuyer("p")).hasMessageContaining("可见范围");
    when(permissions.currentUserHas("buyer:mall:manage")).thenReturn(true);
    assertThat(service.listBuyer("p")).isEmpty();
    assertThat(service.listBuyerReview("p")).isEmpty(); verify(permissions).require("buyer:mall:manage");
    TenantContext.set("other",null,"reviewer");
    assertThatThrownBy(() -> service.listBuyerReview("p")).hasMessageContaining("本企业私域");
    assertThatThrownBy(() -> service.listBuyerReview("public-product")).hasMessageContaining("本企业私域");
    verifyNoInteractions(storage);
  }

  @Test void uploadOpenApiKeepsBinaryBodyWithoutEagerByteArrayBinding() throws Exception {
    var method = com.procurement.mall.api.SupplierMallProductMediaController.class.getMethod("upload",
        String.class,String.class,String.class,jakarta.servlet.http.HttpServletRequest.class);
    var content = method.getAnnotation(io.swagger.v3.oas.annotations.Operation.class).requestBody().content()[0];
    assertThat(content.mediaType()).isEqualTo("application/octet-stream");
    assertThat(content.schema().type()).isEqualTo("string");
    assertThat(content.schema().format()).isEqualTo("binary");
    assertThat(java.util.Arrays.stream(method.getParameters()).anyMatch(parameter ->
        parameter.isAnnotationPresent(org.springframework.web.bind.annotation.RequestBody.class))).isFalse();
  }
}
