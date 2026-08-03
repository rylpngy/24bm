package com.procurement.mall.api;

/** 收货地址(M-2)。 */
public record MallAddressResponse(
    String id,
    String receiver,
    String phone,
    String province,
    String city,
    String district,
    String detail,
    boolean isDefault) {
}
