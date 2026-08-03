package com.procurement.mall.domain;

import java.time.OffsetDateTime;

/**
 * 商城商品聚合(M-1)。
 *
 * <p>scope=tenant 私域协议价商品(价格按租户隔离);scope=public 公开专区标准品。
 */
public record MallProduct(
    String id,
    String scope,
    String tenantId,
    String supplierId,
    String supplierName,
    String categoryId,
    String categoryName,
    String name,
    String brand,
    String descriptionHtml,
    String mainImageKey,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
