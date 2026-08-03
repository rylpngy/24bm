package com.procurement.mall.api;

/** 商城分类项;platformLevel=true 表示平台级标准分类(所有租户可见)。 */
public record MallCategoryResponse(String id, String parentId, String name, boolean platformLevel) {
}
