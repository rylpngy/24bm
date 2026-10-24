package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;

/** 已完成表示提交买方确认,须先受理并填写回复及凭据;拒绝必须说明理由。 */
public record HandleAfterSalesRequest(@NotBlank String status, String reply, String evidenceNo) {
  public HandleAfterSalesRequest(String status, String reply) {
    this(status, reply, null);
  }
}
