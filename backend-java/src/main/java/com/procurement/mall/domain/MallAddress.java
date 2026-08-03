package com.procurement.mall.domain;

/** 收货地址簿(M-2):租户级共享,结算时选用。 */
public record MallAddress(
    String id,
    String tenantId,
    String receiver,
    String phone,
    String province,
    String city,
    String district,
    String detail,
    boolean isDefault) {
}
