package com.procurement.mall.domain;

/** 商品图集条目:storageKey 指向对象存储。 */
public record MallProductMedia(String id, String productId, String storageKey, int sortOrder) {
}
