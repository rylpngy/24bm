package com.procurement.mall.domain;

import java.time.OffsetDateTime;

/** 商城分类:tenantId 为空=平台级标准分类,非空=租户自建。 */
public record MallCategory(
    String id,
    String tenantId,
    String parentId,
    String name,
    int sortOrder,
    OffsetDateTime createdAt) {
}
