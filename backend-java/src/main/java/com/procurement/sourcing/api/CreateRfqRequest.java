package com.procurement.sourcing.api;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

// demandIds 与 directItems 二选一:基于需求合并立项,或采购部门直录(系统自动反登「直录登记」需求保闭环)。
public record CreateRfqRequest(
    @NotBlank String title,
    List<String> demandIds,
    List<String> invitedSupplierIds,
    @Future(message = "报价/竞价截止时间须晚于当前时间") OffsetDateTime deadlineAt,
    String quoteRequirement,
    String deliveryRequirement,
    String evaluationMethod,
    String method,
    // 竞价专属:起拍价(竞价必填)与最小降价步长(可选,缺省 0)。
    java.math.BigDecimal auctionStartPrice,
    java.math.BigDecimal auctionMinDecrement,
    // 单一来源专属:来源说明(必填,审批留痕)。
    String singleSourceReason,
    // true=保存为草稿(建项步骤),供应商与发布在后续步骤完成;缺省沿用创建即发布。
    Boolean saveAsDraft,
    // 直录模式:不基于既有需求,直接录入采购内容;系统反向登记「直录登记」需求并挂链。
    List<DirectRfqItemRequest> directItems,
    String directDepartmentId,
    java.math.BigDecimal directBudget,
    // 竞价规则配置(可选,仅竞价方式使用)
    BigDecimal auctionReservePrice,
    OffsetDateTime auctionPlannedStart,
    Integer auctionSoftCloseTriggerMinutes,
    Integer auctionSoftCloseExtendMinutes,
    Boolean auctionShowRank,
    Boolean auctionShowLowest,
    Boolean auctionShowCompetitorNames) {
}
