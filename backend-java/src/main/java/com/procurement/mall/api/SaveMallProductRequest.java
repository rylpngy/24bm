package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;

/**
 * 供应商建/改商品(M-1)。
 *
 * <p>scope 由端点决定而非请求体指定,避免供应商越权把商品发到公开专区。
 * tenantId 是上架目标采购方(与既有货架发布同口径),仅新建时使用且校验准入。
 */
public record SaveMallProductRequest(
    String tenantId,
    @NotBlank String name,
    String brand,
    String descriptionHtml,
    String categoryId,
    String mainImageKey) {
}
