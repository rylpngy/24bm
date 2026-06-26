package com.procurement.supplier.api;

// 寻源发现:平台上可被采购方纳入私域的供应商企业(尚未在本租户私域库中)。
public record DiscoverableSupplierResponse(
    String supplierId,
    String name,
    String industry,
    String creditCode,
    String verifiedStatus,
    String profileStatus) {}
