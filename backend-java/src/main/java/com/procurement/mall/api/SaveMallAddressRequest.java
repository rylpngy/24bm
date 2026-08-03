package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;

/** 新增收货地址(M-2)。首个地址自动设为默认。 */
public record SaveMallAddressRequest(
    @NotBlank String receiver,
    @NotBlank String phone,
    String province,
    String city,
    String district,
    @NotBlank String detail,
    Boolean isDefault) {
}
