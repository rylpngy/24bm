package com.procurement.sourcing.api;

// 中标通知书验签结果:valid=true 表示签名与当前内容一致(未被篡改)。
public record AwardNoticeVerifyResponse(
    String rfqId,
    boolean issued,
    boolean valid,
    String algorithm,
    String signature) {
}
