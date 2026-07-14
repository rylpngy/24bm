package com.procurement.sourcing.api;

import java.math.BigDecimal;

/**
 * 采购清单行:项目要采购什么、要多少(源自关联需求的物资明细,物料主数据在服务端解析)。
 * 供应商按此清单逐行报价——品名/规格/单位/数量由采购方给定,供应商只报单价。
 */
public record RfqItemResponse(
    String demandItemId,
    String materialId,
    String materialName,
    String specification,
    String unit,
    BigDecimal quantity) {
}
