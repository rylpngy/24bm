package com.procurement.mall.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.storage.ObjectStorageService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.identity.application.PermissionService;
import com.procurement.mall.api.MallProductMediaResponse;
import com.procurement.mall.domain.MallProductImagePolicy;
import com.procurement.mall.infrastructure.MallProductMediaMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MallProductMediaApplicationService {
  public record Ticket(String storageKey, String token, OffsetDateTime expiresAt) {}
  private final MallProductMediaMapper mapper;
  private final ObjectStorageService storage;
  private final AuditLogApplicationService audit;
  private final PermissionService permissions;

  public MallProductMediaApplicationService(MallProductMediaMapper mapper, ObjectStorageService storage,
      AuditLogApplicationService audit, PermissionService permissions) {
    this.mapper = mapper; this.storage = storage; this.audit = audit; this.permissions = permissions;
  }

  public Ticket ticket(String product, String fileName) {
    own(product, false);
    MallProductImagePolicy.requireFileName(fileName);
    String supplier = supplier(), user = user();
    String key = "mall-product-media/" + UUID.randomUUID();
    String token = UUID.randomUUID().toString();
    OffsetDateTime expires = OffsetDateTime.now().plusMinutes(15);
    mapper.issue(key, product, supplier, user, fileName, hash(token.getBytes(StandardCharsets.UTF_8)), expires);
    return new Ticket(key, token, expires);
  }

  // Claim commits before object I/O; a failed/crashed upload cannot rewrite the same object key.
  @Transactional(propagation=Propagation.NOT_SUPPORTED)
  public void upload(String product, String key, String token, byte[] bytes) {
    upload(product,key,token,new java.io.ByteArrayInputStream(bytes == null ? new byte[0] : bytes),bytes == null ? 0 : bytes.length);
  }

  @Transactional(propagation=Propagation.NOT_SUPPORTED)
  public void upload(String product, String key, String token, java.io.InputStream stream, long contentLength) {
    own(product, false);
    String supplier = supplier(), user = user();
    var ticket = mapper.upload(key, product, supplier, user);
    if (ticket == null || token == null || token.isBlank()) throw new PermissionDeniedException("无效的商品图片上传票据");
    if (mapper.claim(key, product, supplier, user, hash(token.getBytes(StandardCharsets.UTF_8))) != 1) {
      throw new PermissionDeniedException("图片票据已过期、已使用或不属于当前商品及用户");
    }
    try {
      if (contentLength > MallProductImagePolicy.MAX_BYTES) throw payloadTooLarge();
      // MAX+1 also bounds chunked/unknown-length requests before decode or MinIO allocation.
      byte[] bytes = stream.readNBytes(MallProductImagePolicy.MAX_BYTES + 1);
      if (bytes.length > MallProductImagePolicy.MAX_BYTES) throw payloadTooLarge();
      var image = MallProductImagePolicy.validate(bytes);
      boolean png = ticket.fileName().toLowerCase(java.util.Locale.ROOT).endsWith(".png");
      if (png != image.contentType().equals("image/png")) throw new IllegalArgumentException("图片内容与文件扩展名不一致");
      storage.put(key, image.data(), image.contentType());
      if (mapper.uploaded(key, product, supplier, user, image.contentType(), image.data().length, hash(image.data())) != 1) {
        throw new IllegalStateException("图片上传登记失败，请重新上传");
      }
    } catch (java.io.IOException error) {
      mapper.failed(key, product, supplier, user); throw new IllegalArgumentException("读取商品图片失败，请重新上传",error);
    } catch (RuntimeException error) { mapper.failed(key, product, supplier, user); throw error; }
  }

  private static org.springframework.web.server.ResponseStatusException payloadTooLarge() {
    return new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE,"商品图片不能超过5MB");
  }

  @Transactional
  public List<MallProductMediaResponse> register(String product, String key) {
    var owner = own(product, true);
    var uploaded = mapper.upload(key, product, supplier(), user());
    if (uploaded == null || !"uploaded".equals(uploaded.state()) || uploaded.contentSize() == null
        || uploaded.contentSha256() == null) throw new PermissionDeniedException("图片尚未合法上传");
    if (mapper.list(product).size() >= 8) throw new IllegalStateException("每件商品最多8张图片");
    requireIntegrity(key, uploaded.contentSize(), uploaded.contentSha256(), uploaded.contentType());
    if (mapper.consume(key, product, supplier(), user()) != 1) throw new PermissionDeniedException("图片票据已失效或已登记");
    mapper.insert("mpm-" + UUID.randomUUID(), product, key);
    // No synthesized main image: the first successfully uploaded real image becomes the main image.
    if (owner.mainImageKey() == null || mapper.list(product).stream().noneMatch(MallProductMediaMapper.Media::main)) {
      mapper.main(supplier(), product, key);
    }
    changed(owner, "mall_product.media_uploaded");
    return listSupplier(product);
  }

  @Transactional
  public List<MallProductMediaResponse> setMain(String product, String mediaId) {
    var owner = own(product, true);
    var media = requireMedia(product, mediaId);
    if (!media.main()) {
      mapper.main(supplier(), product, media.storageKey());
      changed(owner, "mall_product.media_main_changed");
    }
    return listSupplier(product);
  }

  @Transactional
  public List<MallProductMediaResponse> delete(String product, String mediaId) {
    var owner = own(product, true);
    var media = requireMedia(product, mediaId);
    if (mapper.delete(product, mediaId) != 1) throw new IllegalStateException("商品图片已变化，请刷新");
    if (media.main()) {
      var remaining = mapper.list(product);
      mapper.main(supplier(), product, remaining.isEmpty() ? null : remaining.getFirst().storageKey());
    }
    changed(owner, "mall_product.media_removed");
    return listSupplier(product);
  }

  public List<MallProductMediaResponse> listSupplier(String product) {
    own(product, false);
    return responses(product, "supplier");
  }

  public List<MallProductMediaResponse> listBuyer(String product) {
    visible(product);
    return responses(product, "buyer");
  }

  public List<MallProductMediaResponse> listBuyerReview(String product) {
    requireBuyerReviewer(product);
    return responses(product,"buyer",true);
  }

  public ObjectStorageService.StoredObject buyerReviewImage(String product,String mediaId) {
    requireBuyerReviewer(product);
    var media = requireMedia(product,mediaId);
    return requireIntegrity(media.storageKey(),media.contentSize(),media.contentSha256(),media.contentType());
  }

  private void requireBuyerReviewer(String product) {
    permissions.require("buyer:mall:manage");
    if (mapper.pendingForTenant(TenantAccessGuard.requireTenantId("buyer mall image review"),product) == null) {
      throw new PermissionDeniedException("商品不在本企业私域待审核队列");
    }
  }

  public ObjectStorageService.StoredObject image(String product, String mediaId, boolean buyer) {
    if (buyer) visible(product); else own(product, false);
    var media = requireMedia(product, mediaId);
    return requireIntegrity(media.storageKey(), media.contentSize(), media.contentSha256(), media.contentType());
  }

  public List<MallProductMediaResponse> listPublicReview(String product) {
    requirePublicReviewer(product);
    return responses(product, "platform");
  }

  public ObjectStorageService.StoredObject publicReviewImage(String product, String mediaId) {
    requirePublicReviewer(product);
    var media = requireMedia(product, mediaId);
    return requireIntegrity(media.storageKey(), media.contentSize(), media.contentSha256(), media.contentType());
  }

  private void requirePublicReviewer(String product) {
    TenantAccessGuard.requirePlatformUserId("public product image review");
    permissions.require("platform:*");
    if (mapper.publicPending(product) == null) throw new PermissionDeniedException("商品不在公开审核队列");
  }

  private ObjectStorageService.StoredObject requireIntegrity(String key, long size, String sha, String type) {
    if (sha == null || size <= 0 || size > MallProductImagePolicy.MAX_BYTES
        || !("image/png".equals(type) || "image/jpeg".equals(type))) {
      throw new IllegalStateException("图片缺少有效上传依据，禁止读取");
    }
    var object = storage.get(key);
    if (object == null || object.data() == null || object.data().length != size || !sha.equals(hash(object.data()))) {
      throw new IllegalStateException("商品图片完整性核验失败");
    }
    return new ObjectStorageService.StoredObject(object.data(), type);
  }

  private MallProductMediaMapper.Media requireMedia(String product, String id) {
    var media = mapper.media(product, id);
    if (media == null) throw new PermissionDeniedException("商品图片不存在或未通过上传登记");
    return media;
  }

  private MallProductMediaMapper.Product own(String product, boolean lock) {
    var owner = lock ? mapper.lockOwn(supplier(), product) : mapper.own(supplier(), product);
    if (owner == null) throw new PermissionDeniedException("商品不存在或不属于本供应商");
    return owner;
  }

  private void visible(String product) {
    String tenant = TenantAccessGuard.requireTenantId("buyer mall images");
    if (mapper.visible(tenant, product) == null
        && (!permissions.currentUserHas("buyer:mall:manage") || mapper.pendingForTenant(tenant,product) == null)) {
      throw new PermissionDeniedException("商品不可采购或不在当前企业可见范围");
    }
  }

  private List<MallProductMediaResponse> responses(String product, String scope) {
    return responses(product,scope,false);
  }

  private List<MallProductMediaResponse> responses(String product, String scope, boolean review) {
    return mapper.list(product).stream().map(m -> new MallProductMediaResponse(m.id(),m.fileName(),m.contentType(),
        m.contentSize(),m.sortOrder(),m.main(),"/api/v1/" + scope + "/mall/products/" + encode(product)
            + (review ? "/review-media/" : "/media/") + encode(m.id()) + "/content")).toList();
  }

  private void changed(MallProductMediaMapper.Product product, String action) {
    mapper.invalidate(supplier(), product.id());
    audit.recordTenantAction(product.tenantId(), action, "mall_product", product.id());
  }

  private String supplier() { return TenantAccessGuard.requireSupplierId("supplier mall images"); }
  private String user() { return TenantAccessGuard.requireUserId("supplier mall images"); }
  private static String encode(String value) { return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20"); }
  private static String hash(byte[] value) {
    try { return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value)); }
    catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
  }
}
